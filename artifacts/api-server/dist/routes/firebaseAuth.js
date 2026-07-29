import { Router } from "express";
import { generateFirebaseCustomToken } from "../lib/googleAuth.js";
export const firebaseAuthRouter = Router();
/**
 * GET /api/firebase/token
 * Returns a short-lived Firebase custom token for the frontend to sign in with.
 * This lets the frontend authenticate with Firebase without needing anonymous auth.
 * The token is valid for 1 hour; the frontend should call this once per session.
 */
firebaseAuthRouter.get("/token", async (_req, res) => {
    try {
        // Use a fixed UID for portal (read-only) users — all visitors share this identity
        const token = await generateFirebaseCustomToken("portal-visitor");
        res.json({ token });
    }
    catch (e) {
        console.error("Firebase custom token generation failed:", e);
        res.status(500).json({ error: "Could not generate Firebase token" });
    }
});
//# sourceMappingURL=firebaseAuth.js.map