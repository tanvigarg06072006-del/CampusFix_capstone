const express = require("express");
const pool = require("../supabase");
const { authenticateToken, requireRole } = require("../middleware/auth");
const multer = require("multer");
const { randomUUID } = require("crypto");
const supabaseStorage = require("../supabaseStorage");

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, callback) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            callback(null, true);
        } else {
            callback(new Error("Only JPG, PNG and WEBP images are allowed"));
        }
    }
});

const statuses = [
    "PENDING", "REVIEWED", "ASSIGNED",
    "IN_PROGRESS", "RESOLVED", "CONFIRMED", "REJECTED"
];

const categories = [
    "Electrical", "Plumbing", "Furniture", "Cleanliness",
    "Internet", "Classroom Equipment", "Laboratory Equipment",
    "Hostel", "Security", "Other"
];

const priorities = ["LOW", "MEDIUM", "HIGH"];

async function recordActivity(issueId, oldStatus, description, userId) {
    try {
        await pool.query(
            `INSERT INTO issue_history
                (issue_id, old_status, new_status, changed_by)
             VALUES ($1, $2, $3, $4)`,
            [issueId, oldStatus, description, userId]
        );
    } catch (error) {
        console.error("Activity history failed:", error.message);
    }
}

async function attachPhotoUrls(issues) {
    return Promise.all(
        issues.map(async (issue) => {
            if (!issue.image) {
                return { ...issue, photoUrl: null };
            }

            if (issue.image.startsWith("http")) {
                return { ...issue, photoUrl: issue.image };
            }

            try {
                const { data, error } = await supabaseStorage
                    .storage
                    .from("complaint-photos")
                    .createSignedUrl(issue.image, 3600);

                if (error) {
                    console.error("Could not generate photo URL:", error.message);
                    return { ...issue, photoUrl: null };
                }

                return {
                    ...issue,
                    photoUrl: data.signedUrl
                };
            } catch (err) {
                return { ...issue, photoUrl: null };
            }
        })
    );
}

router.use(authenticateToken);


router.get("/", async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));

        const result = await pool.query(
            `SELECT i.*,
                u.name AS reporter_name,
                u.email AS reporter_email,
                a.name AS assignee_name,
                d.name AS department_name,
                (SELECT COUNT(*)
                 FROM issue_votes iv
                 WHERE iv.issue_id = i.id) AS vote_count
             FROM issues i
             JOIN users u ON u.id = i.reported_by
             LEFT JOIN users a ON a.id = i.assigned_to
             LEFT JOIN departments d ON d.id = i.department_id
             WHERE ($1::text IS NULL OR i.status = $1)
               AND ($2::text IS NULL OR i.category = $2)
               AND (
                   $3::text = 'admin'
                   OR i.reported_by = $4
               )
             ORDER BY i.created_at DESC
             LIMIT $5 OFFSET $6`,
            [
                req.query.status || null,
                req.query.category || null,
                req.user.role,
                req.user.id,
                limit,
                (page - 1) * limit
            ]
        );

        const issuesWithPhotos = await attachPhotoUrls(result.rows);

        res.json({
            page,
            limit,
            issues: issuesWithPhotos
        });

    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Could not retrieve issues" });
    }
});


router.get("/community", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT i.*,
                u.name AS reporter_name,
                (SELECT COUNT(*)
                 FROM issue_votes iv
                 WHERE iv.issue_id = i.id) AS vote_count,
                EXISTS (
                    SELECT 1
                    FROM issue_votes iv
                    WHERE iv.issue_id = i.id
                    AND iv.user_id = $1
                ) AS has_voted
             FROM issues i
             JOIN users u ON u.id = i.reported_by
             WHERE i.status NOT IN ('RESOLVED', 'CONFIRMED', 'REJECTED')
             ORDER BY i.created_at DESC`,
            [req.user.id]
        );

        const communityWithPhotos = await attachPhotoUrls(result.rows);
        res.json({ issues: communityWithPhotos });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Could not retrieve community issues" });
    }
});



router.get("/:id", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT i.*,
                u.name AS reporter_name,
                u.email AS reporter_email,
                a.name AS assignee_name,
                d.name AS department_name
             FROM issues i
             JOIN users u ON u.id = i.reported_by
             LEFT JOIN users a ON a.id = i.assigned_to
             LEFT JOIN departments d ON d.id = i.department_id
             WHERE i.id = $1`,
            [req.params.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "Issue not found" });
        }

        const issue = result.rows[0];

        const privileged = req.user.role === "admin";
        const owner = String(issue.reported_by) === String(req.user.id);

        if (!privileged && !owner) {
            return res.status(403).json({
                message: "You cannot view this issue"
            });
        }

        issue.photoUrl = null;

        if (issue.image) {
            if (issue.image.startsWith("http")) {
                issue.photoUrl = issue.image;
            } else {
                const { data, error } = await supabaseStorage
                    .storage
                    .from("complaint-photos")
                    .createSignedUrl(issue.image, 3600);

                if (error) {
                    console.error("Could not generate photo URL:", error.message);
                } else {
                    issue.photoUrl = data.signedUrl;
                }
            }
        }

        res.json({ issue });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Could not retrieve issue" });
    }
});



router.post("/", (req, res, next) => {
    upload.single("photo")(req, res, (error) => {
        if (error) {
            return res.status(400).json({ message: error.message });
        }
        next();
    });
}, async (req, res) => {
    let uploadedPhotoPath = null;

    try {
        const { title, description, category, priority, location } = req.body;

        if (
            typeof title !== "string" || !title.trim() ||
            typeof description !== "string" ||
            typeof location !== "string" || !location.trim()
        ) {
            return res.status(400).json({
                message: "Title, description and location are required"
            });
        }

        if (category && !categories.includes(category)) {
            return res.status(400).json({ message: "Invalid category" });
        }

        const normalizedPriority = typeof priority === "string" ? priority.toUpperCase() : "MEDIUM";

        if (priority && !priorities.includes(normalizedPriority)) {
            return res.status(400).json({ message: "Invalid priority" });
        }

        if (req.file) {
            const extensionByType = {
                "image/jpeg": "jpg",
                "image/png": "png",
                "image/webp": "webp"
            };

            const extension = extensionByType[req.file.mimetype];

            uploadedPhotoPath = `${req.user.id}/${randomUUID()}.${extension}`;

            const { error: uploadError } = await supabaseStorage
                .storage
                .from("complaint-photos")
                .upload(uploadedPhotoPath, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: false
                });

            if (uploadError) throw uploadError;
        }

        const result = await pool.query(
            `INSERT INTO issues
                (title, description, category, priority, location, image, status, reported_by)
             VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)
             RETURNING *`,
            [
                title.trim(),
                description.trim(),
                category || "Other",
                normalizedPriority,
                location.trim(),
                uploadedPhotoPath,
                req.user.id
            ]
        );

        const newIssue = result.rows[0];

        try {
            await pool.query(
                `INSERT INTO notifications
                    (user_id, issue_id, title, message, type)
                 SELECT id, $1, 'New Complaint Received', $2, 'new_complaint'
                 FROM users
                 WHERE role = 'admin'`,
                [
                    newIssue.id,
                    `A new complaint "${newIssue.title}" has been submitted.`
                ]
            );
        } catch (notificationError) {
            console.error("Notification creation failed:", notificationError.message);
        }

        res.status(201).json({
            message: "Issue created",
            issue: newIssue
        });
    } catch (error) {
        if (uploadedPhotoPath) {
            const { error: cleanupError } = await supabaseStorage
                .storage
                .from("complaint-photos")
                .remove([uploadedPhotoPath]);

            if (cleanupError) {
                console.error("Photo cleanup failed:", cleanupError.message);
            }
        }

        console.error(error.message);
        res.status(500).json({ message: "Could not create issue" });
    }
});


router.post("/:id/vote", async (req, res) => {
    try {
        const issueResult = await pool.query(
            `SELECT id, reported_by, status
             FROM issues
             WHERE id = $1`,
            [req.params.id]
        );

        if (!issueResult.rows.length) {
            return res.status(404).json({ message: "Issue not found" });
        }

        const issue = issueResult.rows[0];

        if (String(issue.reported_by) === String(req.user.id)) {
            return res.status(403).json({
                message: "You cannot vote for your own complaint"
            });
        }

        if (["RESOLVED", "CONFIRMED", "REJECTED"].includes(issue.status)) {
            return res.status(400).json({
                message: "This complaint is no longer open for votes"
            });
        }

        const voteResult = await pool.query(
            `INSERT INTO issue_votes (issue_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (issue_id, user_id) DO NOTHING
             RETURNING id`,
            [req.params.id, req.user.id]
        );

        if (!voteResult.rows.length) {
            return res.status(409).json({
                message: "You have already supported this complaint"
            });
        }

        const countResult = await pool.query(
            "SELECT COUNT(*) AS vote_count FROM issue_votes WHERE issue_id = $1",
            [req.params.id]
        );

        res.status(201).json({
            message: "Your support has been recorded",
            vote_count: countResult.rows[0].vote_count
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Could not record your vote" });
    }
});


router.get("/:id/history", async (req, res) => {
    try {
        const issueResult = await pool.query(
            `SELECT id, reported_by, created_at
             FROM issues
             WHERE id = $1`,
            [req.params.id]
        );

        if (!issueResult.rows.length) {
            return res.status(404).json({ message: "Issue not found" });
        }

        const issue = issueResult.rows[0];
        const owner = String(issue.reported_by) === String(req.user.id);

        if (req.user.role !== "admin" && !owner) {
            return res.status(403).json({ message: "You cannot view this complaint" });
        }

        const history = await pool.query(
            `SELECT id, new_status, changed_at
             FROM issue_history
             WHERE issue_id = $1
             ORDER BY changed_at ASC, id ASC`,
            [req.params.id]
        );

        res.json({
            events: [
                {
                    id: `submitted-${issue.id}`,
                    description: "Complaint submitted",
                    occurred_at: issue.created_at
                },
                ...history.rows.map((event) => ({
                    id: event.id,
                    description: event.new_status,
                    occurred_at: event.changed_at
                }))
            ]
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Could not retrieve complaint activity" });
    }
});

router.patch("/:id/priority", requireRole("admin"), async (req, res) => {
    try {
        const priority = typeof req.body.priority === "string"
            ? req.body.priority.toUpperCase()
            : "";

        if (!priorities.includes(priority)) {
            return res.status(400).json({
                message: "Priority must be LOW, MEDIUM or HIGH"
            });
        }

        const result = await pool.query(
            `UPDATE issues
             SET priority = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [priority, req.params.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "Issue not found" });
        }

        res.json({
            message: "Priority updated",
            issue: result.rows[0]
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Could not update priority" });
    }
});

router.patch("/:id/status", requireRole("admin"), async (req, res) => {
    try {
        const { status } = req.body;

        if (!statuses.includes(status)) {
            return res.status(400).json({ message: "Invalid issue status" });
        }

        // Find the complaint and its owner
        const existing = await pool.query(
            `SELECT id, reported_by, title, status
             FROM issues
             WHERE id = $1`,
            [req.params.id]
        );

        if (!existing.rows.length) {
            return res.status(404).json({ message: "Issue not found" });
        }

        const oldIssue = existing.rows[0];

        // Update complaint status
        const result = await pool.query(
            `UPDATE issues
             SET status = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [status, req.params.id]
        );

        // Create notification only when status actually changes
        if (oldIssue.status !== status) {
            if (status === "IN_PROGRESS") {
                await recordActivity(
                    oldIssue.id,
                    oldIssue.status,
                    "Complaint marked In Progress",
                    req.user.id
                );
            }

            if (status === "RESOLVED") {
                await recordActivity(
                    oldIssue.id,
                    oldIssue.status,
                    "Complaint marked Resolved",
                    req.user.id
                );
            }

            try {
                await pool.query(
                    `INSERT INTO notifications
                        (user_id, issue_id, title, message, type)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        oldIssue.reported_by,
                        oldIssue.id,
                        "Complaint Status Updated",
                        `Your complaint "${oldIssue.title}" is now ${status.replace(/_/g, " ")}.`,
                        "status"
                    ]
                );
            } catch (notificationError) {
                console.error("Notification creation failed:", notificationError.message);
            }
        }

        res.json({
            message: "Status updated",
            issue: result.rows[0]
        });

    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Could not update status" });
    }
});

router.patch("/:id/department", requireRole("admin"), async (req, res) => {
    try {
        let departmentId = req.body.department_id;

        if (departmentId === "" || departmentId === undefined || departmentId === null) {
            departmentId = null;
        }

        let departmentName = null;

        if (departmentId !== null) {
            if (!/^\d+$/.test(String(departmentId))) {
                return res.status(400).json({ message: "Invalid department" });
            }

            const department = await pool.query(
                "SELECT id, name FROM departments WHERE id = $1",
                [departmentId]
            );

            if (!department.rows.length) {
                return res.status(400).json({ message: "Department not found" });
            }

            departmentId = department.rows[0].id;
            departmentName = department.rows[0].name;
        }

        const existing = await pool.query(
            `SELECT id, reported_by, title, department_id
             FROM issues
             WHERE id = $1`,
            [req.params.id]
        );

        if (!existing.rows.length) {
            return res.status(404).json({ message: "Issue not found" });
        }

        const oldIssue = existing.rows[0];
        const previousId = oldIssue.department_id == null
            ? null
            : String(oldIssue.department_id);
        const nextId = departmentId == null ? null : String(departmentId);

        const result = await pool.query(
            `UPDATE issues
             SET department_id = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [departmentId, req.params.id]
        );

        if (previousId !== nextId) {
            let previousName = null;

            if (previousId) {
                const previousDepartment = await pool.query(
                    "SELECT name FROM departments WHERE id = $1",
                    [previousId]
                );
                previousName = previousDepartment.rows[0]?.name || null;
            }

            const description = !previousId
                ? `Department assigned to ${departmentName}`
                : nextId
                    ? `Department changed to ${departmentName}`
                    : "Department assignment removed";

            await recordActivity(
                oldIssue.id,
                previousName,
                description,
                req.user.id
            );

            const message = nextId
                ? `Your complaint "${oldIssue.title}" was assigned to ${departmentName}.`
                : `Your complaint "${oldIssue.title}" is no longer assigned to a department.`;

            try {
                await pool.query(
                    `INSERT INTO notifications
                        (user_id, issue_id, title, message, type)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        oldIssue.reported_by,
                        oldIssue.id,
                        "Department Updated",
                        message,
                        "department"
                    ]
                );
            } catch (notificationError) {
                console.error("Notification creation failed:", notificationError.message);
            }
        }

        res.json({
            message: "Department updated",
            issue: {
                ...result.rows[0],
                department_name: departmentName
            }
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Could not update department" });
    }
});

router.patch("/:id/assign", requireRole("admin"), (req, res) => {
    res.status(400).json({
        message: "Assign the complaint to a department"
    });
});

router.delete("/:id", async (req, res) => {
    try {
        const existing = await pool.query(
            "SELECT id, reported_by, status FROM issues WHERE id = $1",
            [req.params.id]
        );

        if (!existing.rows.length) {
            return res.status(404).json({ message: "Issue not found" });
        }

        const issue = existing.rows[0];
        const privileged = req.user.role === "admin";
        const owner = String(issue.reported_by) === String(req.user.id);

        if (!privileged && !(owner && issue.status === "PENDING")) {
            return res.status(403).json({ message: "You cannot delete this issue" });
        }

        await pool.query("DELETE FROM issues WHERE id = $1", [req.params.id]);

        res.json({ message: "Issue deleted" });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Could not delete issue" });
    }
});

module.exports = router;