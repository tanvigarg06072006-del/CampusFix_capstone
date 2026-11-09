
const pool = require("./supabase");

async function testConnection() {
    try {
        const result = await pool.query(
            "SELECT current_database(), NOW()"
        );

        console.log("Supabase connected successfully!");
        console.log(result.rows[0]);
    } catch (error) {
        console.error("Database connection failed:", error.message);
    } finally {
        await pool.end();
    }
}

testConnection();
