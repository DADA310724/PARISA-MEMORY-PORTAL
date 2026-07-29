import { Router } from "express";
export const oauthRouter = Router();
oauthRouter.get("/callback", async (req, res) => {
    const code = req.query.code;
    if (!code) {
        res.status(400).send("Missing code parameter");
        return;
    }
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "";
    const domain = process.env.REPLIT_DEV_DOMAIN ??
        process.env.REPLIT_DOMAINS?.split(",")[0] ??
        "localhost:8080";
    const redirectUri = `https://${domain}/api/oauth/callback`;
    try {
        const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
            }),
        });
        const tokenData = await tokenResp.json();
        if (tokenData.error) {
            res.status(400).json({ error: tokenData.error });
            return;
        }
        res.json({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
        });
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
//# sourceMappingURL=oauth.js.map