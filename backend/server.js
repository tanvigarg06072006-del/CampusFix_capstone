const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config();

const pool = require("./supabase");
const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const issueRoutes = require("./routes/issueRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const commentRoutes = require("./routes/commentRoutes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/comments", commentRoutes);

app.get("/", (req, res) => {
    res.json({ success: true, message: "Welcome to CampusFix API" });
});

app.get("/api/db-health", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT current_database() AS database, NOW() AS time"
        );

        res.json({
            success: true,
            message: "Supabase PostgreSQL connected",
            database: result.rows[0].database,
            time: result.rows[0].time
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: "Database connection failed" });
    }
});

app.use((req, res) => {
    res.status(404).json({ message: "Endpoint not found" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`CampusFix server running on http://localhost:${PORT}`);
});