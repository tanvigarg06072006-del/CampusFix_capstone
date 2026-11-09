const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config();

let authInstance = null;

function initializeFirebaseAdmin() {
    if (getApps().length > 0) {
        return getAuth(getApps()[0]);
    }

    let credentialConfig = null;

    // 1. Try raw JSON or base64 JSON from environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        try {
            const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
            const jsonString = rawKey.startsWith("{")
                ? rawKey
                : Buffer.from(rawKey, "base64").toString("utf8");
            credentialConfig = cert(JSON.parse(jsonString));
        } catch (parseError) {
            console.error("Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON:", parseError.message);
        }
    }

    // 2. Try GOOGLE_APPLICATION_CREDENTIALS path
    if (!credentialConfig && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        const credPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
        if (fs.existsSync(credPath)) {
            try {
                credentialConfig = cert(require(credPath));
            } catch (err) {
                console.error("Could not load GOOGLE_APPLICATION_CREDENTIALS:", err.message);
            }
        }
    }

    // 3. Fallback to local file in backend directory if present
    if (!credentialConfig) {
        const localPath = path.join(__dirname, "firebase-service-account.json");
        if (fs.existsSync(localPath)) {
            try {
                credentialConfig = cert(require(localPath));
            } catch (err) {
                console.error("Could not load local firebase-service-account.json:", err.message);
            }
        }
    }

    if (!credentialConfig) {
        console.warn(
            "[CampusFix Warning] Firebase Admin credentials not found. Provide FIREBASE_SERVICE_ACCOUNT_KEY in .env or place firebase-service-account.json in backend/."
        );
        return {
            verifyIdToken: async () => {
                throw new Error("Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY in .env");
            }
        };
    }

    const app = initializeApp({ credential: credentialConfig });
    return getAuth(app);
}

authInstance = initializeFirebaseAdmin();

module.exports = { auth: authInstance };
