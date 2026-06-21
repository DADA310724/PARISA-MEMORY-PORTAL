import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { configRouter } from "./routes/config.js";
import { driveRouter } from "./routes/drive.js";
import { aiRouter } from "./routes/ai.js";
import { telegramRouter } from "./routes/telegram.js";
import { oauthRouter } from "./routes/oauth.js";
import { voiceRouter } from "./routes/voice.js";
import { chatRouter } from "./routes/chat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

app.use("/api/config", configRouter);
app.use("/api/drive", driveRouter);
app.use("/api/ai", aiRouter);
app.use("/api/telegram", telegramRouter);
app.use("/api/oauth", oauthRouter);
app.use("/api/voice", voiceRouter);
app.use("/api/chat", chatRouter);

app.get("/api/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? "Internal server error" });
});

// Serve frontend — must come AFTER all /api routes and error handler
const staticDir = path.resolve(__dirname, "../../parisa-portal/dist/public");
if (existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get("/{*splat}", (_req: Request, res: Response) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
  console.log(`Serving static files from ${staticDir}`);
} else {
  app.get("/", (_req: Request, res: Response) => {
    res.json({ status: "ok", note: "frontend not built" });
  });
}

const server = createServer(app);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`API server running on port ${PORT}`);
});
