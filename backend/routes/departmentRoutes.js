const express = require("express");
const pool = require("../supabase");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticateToken, requireRole("admin"), async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM departments ORDER BY name"
        );

        res.json({ departments: result.rows });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Could not retrieve departments" });
    }
});

router.post("/", authenticateToken, requireRole("admin"), async (req, res) => {
    try {
        const { name, description = "" } = req.body;

        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({ message: "Department name is required" });
        }

        const result = await pool.query(
            `INSERT INTO departments (name, description)
             VALUES ($1, $2)
             RETURNING *`,
            [name.trim(), description]
        );

        res.status(201).json({ department: result.rows[0] });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ message: "Department already exists" });
        }

        console.error(error.message);
        res.status(500).json({ message: "Could not create department" });
    }
});

module.exports = router;