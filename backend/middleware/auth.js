const { auth } = require("../firebaseAdmin");
const pool = require("../supabase");

function getAdminEmails() {
    return (process.env.ADMIN_EMAILS || "")
        .toLowerCase()
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean);
}

async function authenticateToken(req, res, next) {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ")
        ? header.slice(7)
        : null;

    if (!token) {
        return res.status(401).json({
            message: "Firebase token required"
        });
    }

    // Step 1: Verify Firebase login token
    let decoded;

    try {
        decoded = await auth.verifyIdToken(token);
    } catch (error) {
        console.error("Firebase authentication error:", error.message);
        return res.status(401).json({
            message: "Invalid Firebase token"
        });
    }

    if (!decoded.email) {
        return res.status(400).json({
            message: "Firebase account must have an email"
        });
    }

    const email = decoded.email.toLowerCase();
    const adminEmails = getAdminEmails();
    const isConfiguredAdmin = adminEmails.includes(email);

    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        // Prevent simultaneous requests creating duplicate users
        await client.query(
            "SELECT pg_advisory_xact_lock(hashtext($1))",
            [email]
        );

        // Step 2: Look for existing user by Firebase UID
        let result = await client.query(
            `SELECT id, name, email, role, firebase_uid
             FROM public.users
             WHERE firebase_uid = $1`,
            [decoded.uid]
        );

        if (result.rows.length) {
            const user = result.rows[0];

            // If user is designated as admin server-side but not marked admin yet, promote them
            if (isConfiguredAdmin && user.role !== "admin") {
                result = await client.query(
                    `UPDATE public.users
                     SET role = 'admin'
                     WHERE id = $1
                     RETURNING id, name, email, role`,
                    [user.id]
                );
            }
        } else {
            // Step 3: Check whether user exists by email
            result = await client.query(
                `SELECT id, name, email, role, firebase_uid
                 FROM public.users
                 WHERE LOWER(email) = $1
                 LIMIT 1
                 FOR UPDATE`,
                [email]
            );

            if (result.rows.length) {
                const existingUser = result.rows[0];

                if (
                    existingUser.firebase_uid &&
                    existingUser.firebase_uid !== decoded.uid
                ) {
                    await client.query("ROLLBACK");
                    return res.status(409).json({
                        message: "This email is linked to another account"
                    });
                }

                const targetRole = isConfiguredAdmin
                    ? "admin"
                    : (existingUser.role || "student");

                // Link existing database record to Firebase and apply role
                result = await client.query(
                    `UPDATE public.users
                     SET firebase_uid = $1, role = $2
                     WHERE id = $3
                     RETURNING id, name, email, role`,
                    [decoded.uid, targetRole, existingUser.id]
                );
            } else {
                // Step 4: Create new record automatically
                const initialRole = isConfiguredAdmin ? "admin" : "student";

                result = await client.query(
                    `INSERT INTO public.users
                        (name, email, role, firebase_uid)
                     VALUES ($1, $2, $3, $4)
                     RETURNING id, name, email, role`,
                    [
                        decoded.name || email.split("@")[0],
                        email,
                        initialRole,
                        decoded.uid
                    ]
                );
            }
        }

        await client.query("COMMIT");

        req.firebaseUser = decoded;
        req.user = result.rows[0];

        return next();

    } catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }

        console.error("Database user sync error:", error.message);

        return res.status(500).json({
            message: "Could not synchronise user with database"
        });

    } finally {
        if (client) {
            client.release();
        }
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                message: "Access denied"
            });
        }

        next();
    };
}

module.exports = { authenticateToken, requireRole };
