const express = require("express");
const pool = require("../supabase");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

router.use(authenticateToken);

async function findAccessibleIssue(user, issueId) {
    const result = await pool.query(
        "SELECT id, reported_by, title FROM issues WHERE id = $1",
        [issueId]
    );

    if (!result.rows.length) {
        return { status: 404, message: "Issue not found" };
    }

    const issue = result.rows[0];
    const owner = String(issue.reported_by) === String(user.id);

    if (user.role !== "admin" && !owner) {
        return { status: 403, message: "You cannot access this complaint" };
    }

    return { issue };
}

router.get("/issue/:issueId", async (req, res) => {
    try {
        const access = await findAccessibleIssue(req.user, req.params.issueId);

        if (!access.issue) {
            return res.status(access.status).json({ message: access.message });
        }

        const result = await pool.query(
            `SELECT c.id, c.issue_id, c.user_id, c.comment,
                    c.created_at, c.updated_at, u.name AS user_name
             FROM comments c
             JOIN users u ON u.id = c.user_id
             WHERE c.issue_id = $1
             ORDER BY c.created_at ASC`,
            [req.params.issueId]
        );

        res.json({ comments: result.rows });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Could not retrieve comments" });
    }
});

router.post("/issue/:issueId", async (req, res) => {
    try {
        const { comment } = req.body;

        if (typeof comment !== "string" || !comment.trim()) {
            return res.status(400).json({ message: "Comment cannot be empty" });
        }

        const access = await findAccessibleIssue(req.user, req.params.issueId);

        if (!access.issue) {
            return res.status(access.status).json({ message: access.message });
        }

        const result = await pool.query(
            `INSERT INTO comments (issue_id, user_id, comment)
             VALUES ($1, $2, $3)
             RETURNING id, issue_id, user_id, comment, created_at, updated_at`,
            [req.params.issueId, req.user.id, comment.trim()]
        );

        const issue = access.issue;

        try {
            if (String(issue.reported_by) !== String(req.user.id)) {
                await pool.query(
                    `INSERT INTO notifications
                        (user_id, issue_id, title, message, type)
                     VALUES ($1, $2, 'New Comment', $3, 'comment')`,
                    [
                        issue.reported_by,
                        issue.id,
                        `${req.user.name} commented on "${issue.title}".`
                    ]
                );
            } else {
                await pool.query(
                    `INSERT INTO notifications
                        (user_id, issue_id, title, message, type)
                     SELECT id, $1, 'New Comment', $2, 'comment'
                     FROM users
                     WHERE role = 'admin' AND id <> $3`,
                    [
                        issue.id,
                        `${req.user.name} commented on "${issue.title}".`,
                        req.user.id
                    ]
                );
            }
        } catch (notificationError) {
            console.error("Notification creation failed:", notificationError.message);
        }

        res.status(201).json({
            comment: {
                ...result.rows[0],
                user_name: req.user.name
            }
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Could not add comment" });
    }
});

module.exports = router;
