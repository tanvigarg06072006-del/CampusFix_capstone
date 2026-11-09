const express = require("express");
const pool = require("../supabase");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

router.use(authenticateToken);

// Get notifications for the logged-in user
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         issue_id,
         title,
         message,
         type,
         COALESCE(is_read, false) AS is_read,
         created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    res.json({ notifications: result.rows });
  } catch (error) {
    console.error("Could not fetch notifications:", error.message);
    res.status(500).json({ message: "Could not fetch notifications" });
  }
});

// Mark one notification as read
router.patch("/:id/read", async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE notifications
       SET is_read = true
       WHERE id = $1 AND user_id = $2
       RETURNING id, is_read`,
      [req.params.id, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({
      message: "Notification marked as read",
      notification: result.rows[0]
    });
  } catch (error) {
    console.error("Could not update notification:", error.message);
    res.status(500).json({ message: "Could not update notification" });
  }
});

module.exports = router;