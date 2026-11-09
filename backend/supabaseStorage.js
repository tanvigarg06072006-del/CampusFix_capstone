const { createClient } = require("@supabase/supabase-js");
const path = require("path");

// Load backend/.env if present, fallback to process.cwd()
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config();

let supabaseStorage = null;

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
        "[CampusFix Warning] Supabase Storage credentials are missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
    supabaseStorage = {
        storage: {
            from: () => ({
                createSignedUrl: async () => ({
                    data: null,
                    error: new Error("Supabase Storage is not configured")
                }),
                upload: async () => ({
                    data: null,
                    error: new Error("Supabase Storage is not configured")
                }),
                remove: async () => ({
                    data: null,
                    error: new Error("Supabase Storage is not configured")
                })
            })
        }
    };
} else {
    supabaseStorage = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
}

module.exports = supabaseStorage;
