const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../supabase");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

function createToken(user) {
    return jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );
}

router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (
            typeof name !== "string" || !name.trim() ||
            typeof email !== "string" ||
            typeof password !== "string" || password.length < 8
        ) {
            return res.status(400).json({
                message: "Name, valid email and password of at least 8 characters are required"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `INSERT INTO users (name, email, password, role)
             VALUES ($1, $2, $3, 'student')
             RETURNING id, name, email, role`,
            [name.trim(), email.trim().toLowerCase(), hashedPassword]
        );

        const user = result.rows[0];

        res.status(201).json({
            message: "Registration successful",
            user,
            token: createToken(user)
        });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ message: "Email already registered" });
        }

        console.error(error.message);
        res.status(500).json({ message: "Registration failed" });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (typeof email !== "string" || typeof password !== "string") {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const result = await pool.query(
            "SELECT id, name, email, password, role FROM users WHERE email = $1",
            [email.trim().toLowerCase()]
        );

        if (
            !result.rows.length ||
            !(await bcrypt.compare(password, result.rows[0].password))
        ) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const { password: ignored, ...user } = result.rows[0];

        res.json({
            message: "Login successful",
            user,
            token: createToken(user)
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Login failed" });
    }
});

router.get("/me", authenticateToken, (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role
        }
    });
});

router.patch("/me", authenticateToken, async (req, res) => {
    try {
        if (req.body.role !== undefined || req.body.email !== undefined) {
            return res.status(403).json({
                message: "You cannot change your role or email"
            });
        }

        const name = typeof req.body.name === "string" ? req.body.name.trim() : "";

        if (name.length < 2 || name.length > 80) {
            return res.status(400).json({
                message: "Name must be between 2 and 80 characters"
            });
        }

        const result = await pool.query(
            `UPDATE public.users
             SET name = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING id, name, email, role`,
            [name, req.user.id]
        );

        res.json({
            message: "Profile updated",
            user: result.rows[0]
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Could not update profile" });
    }
});

router.post("/sync", authenticateToken, async (req, res) => {
    try {
        const firebaseUser = req.firebaseUser;

        if (!firebaseUser.email) {
            return res.status(400).json({
                message: "Firebase account has no email"
            });
        }

        const name =
            firebaseUser.name ||
            firebaseUser.email.split("@")[0];

        const role = firebaseUser.admin === true ? "admin" : "student";

        const existing = await pool.query(
            `SELECT id FROM users WHERE firebase_uid = $1 OR email = $2 LIMIT 1`,
            [firebaseUser.uid, firebaseUser.email.toLowerCase()]
        );

        let result;

        if (existing.rows.length) {
            result = await pool.query(
                `UPDATE users
                 SET firebase_uid = $1, name = $2, updated_at = NOW()
                 WHERE id = $3
                 RETURNING id, name, email, role, firebase_uid`,
                [firebaseUser.uid, name, existing.rows[0].id]
            );
        } else {
            result = await pool.query(
                `INSERT INTO users (name, email, role, firebase_uid)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, name, email, role, firebase_uid`,
                [name, firebaseUser.email.toLowerCase(), role, firebaseUser.uid]
            );
        }

        res.json({
            message: "Firebase user synchronized with Supabase",
            user: result.rows[0]
        });
    } catch (error) {
        console.error("User sync error:", error.message);
        res.status(500).json({ message: "User synchronization failed" });
    }
});

module.exports = router;