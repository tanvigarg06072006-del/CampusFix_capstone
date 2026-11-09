
require("dotenv").config();

const { auth } = require("./firebaseAdmin");
const pool = require("./supabase");

async function syncFirebaseUsers() {
    try {
        let pageToken;

        do {
            const result = await auth.listUsers(1000, pageToken);

            for (const user of result.users) {
                if (!user.email) {
                    console.log("Skipping user without email:", user.uid);
                    continue;
                }

                const name =
                    user.displayName || user.email.split("@")[0];

                await pool.query(
                    `INSERT INTO public.users
                    (name, email, role, firebase_uid)
                    VALUES ($1, $2, 'student', $3)
                    ON CONFLICT (firebase_uid)
                    WHERE firebase_uid IS NOT NULL
                    DO UPDATE SET
                        name = EXCLUDED.name,
                        email = EXCLUDED.email`,
                    [name, user.email, user.uid]
                );

                console.log("Synced:", user.email);
            }

            pageToken = result.pageToken;
        } while (pageToken);

        console.log("Firebase to Supabase sync completed!");

    } catch (error) {
        console.error("Sync failed:", error.message);
    }
}

// Initial sync
syncFirebaseUsers();

// Check for newly registered Firebase users every 60 seconds
setInterval(syncFirebaseUsers, 60 * 1000);
