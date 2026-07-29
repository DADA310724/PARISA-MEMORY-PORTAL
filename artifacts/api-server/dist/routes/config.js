import { Router } from "express";
export const configRouter = Router();
function getSaEmail() {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
    if (!raw)
        return "";
    try {
        const sa = JSON.parse(raw);
        return sa.client_email ?? "";
    }
    catch {
        return "";
    }
}
configRouter.get("/", (_req, res) => {
    const e = process.env;
    const saEmail = getSaEmail();
    res.json({
        firebase: {
            apiKey: e.FIREBASE_API_KEY ?? "",
            authDomain: e.FIREBASE_AUTH_DOMAIN ?? "",
            databaseURL: e.FIREBASE_DATABASE_URL ?? "",
            projectId: e.FIREBASE_PROJECT_ID ?? "",
            storageBucket: e.FIREBASE_STORAGE_BUCKET ?? "",
            messagingSenderId: e.FIREBASE_MESSAGING_SENDER_ID ?? "",
            appId: e.FIREBASE_APP_ID ?? "",
            measurementId: e.FIREBASE_MEASUREMENT_ID ?? "",
        },
        logoUrl: e.PROFILE_LOGO_URL ?? "https://i.ibb.co/Z1WPYY7P/x.jpg",
        driveParentFolderId: e.GOOGLE_DRIVE_PARENT_FOLDER_ID ?? "",
        telegramLink: (() => {
            const c = e.TELEGRAM_CONTACT ?? "";
            if (!c)
                return "https://t.me/DADA310724";
            if (c.startsWith("http"))
                return c;
            if (c.startsWith("t.me/"))
                return `https://${c}`;
            return `https://t.me/${c}`;
        })(),
        oauthClientId: e.GOOGLE_OAUTH_CLIENT_ID ?? "",
        hasSA: !!saEmail,
        saEmail,
    });
});
//# sourceMappingURL=config.js.map