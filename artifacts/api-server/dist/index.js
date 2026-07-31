import express from "express";
import { createServer } from "http";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { configRouter } from "./routes/config.js";
import { driveRouter } from "./routes/drive.js";
import aiRouter from "./routes/ai.js";
import { telegramRouter } from "./routes/telegram.js";
import { oauthRouter } from "./routes/oauth.js";
import voiceRouter from "./routes/voice.js";
import { chatRouter } from "./routes/chat.js";
import { folderLockRouter } from "./routes/folderLock.js";
import { firebaseAuthRouter } from "./routes/firebaseAuth.js";
import { prewarmTokens } from "./lib/googleAuth.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
    }
    next();
});
app.use("/api/config", configRouter);
app.use("/api/drive", driveRouter);
app.use("/api/ai", aiRouter);
app.use("/api/telegram", telegramRouter);
app.use("/api/oauth", oauthRouter);
app.use("/api/voice", voiceRouter);
app.use("/api/chat", chatRouter);
app.use("/api/folder-lock", folderLockRouter);
app.use("/api/firebase", firebaseAuthRouter);
app.get("/api/healthz", (_req, res) => {
    res.json({ status: "ok" });
});
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: err.message ?? "Internal server error" });
});
const staticDir = path.resolve(__dirname, "../../parisa-portal/dist/public");
if (existsSync(staticDir)) {
    // sw.js and manifest must never be cached — browsers must always get the latest version
    // so new Service Worker versions activate and old PWA caches are busted.
    app.get("/sw.js", (_req, res) => {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.sendFile(path.join(staticDir, "sw.js"));
    });
    app.get("/manifest.webmanifest", (_req, res) => {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.sendFile(path.join(staticDir, "manifest.webmanifest"));
    });
    // Static assets with content-hash in filename (e.g. index-C5ywwH2A.js) can be cached long-term.
    // index.html itself must never be cached — it references the latest hashed assets.
    app.use(express.static(staticDir, {
        setHeaders(res, filePath) {
            if (filePath.endsWith("index.html")) {
                res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
                res.setHeader("Pragma", "no-cache");
                res.setHeader("Expires", "0");
            }
        },
    }));
    app.get("/{*splat}", (_req, res) => {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.sendFile(path.join(staticDir, "index.html"));
    });
    console.log(`Serving static files from ${staticDir}`);
}
const server = createServer(app);
server.listen(PORT, "0.0.0.0", () => {
    console.log(`API server running on port ${PORT}`);
    // Pre-warm Google OAuth tokens so first media/password requests are instant
    prewarmTokens();
});
//# sourceMappingURL=index.js.map