import { Router } from "express";
import type { Request, Response } from "express";

export const folderLockRouter = Router();

const DB_URL = () => (process.env.FIREBASE_DATABASE_URL ?? "").replace(/\/$/, "");

// ── SA token for writes ────────────────────────────────────────────────────

interface ServiceAccount { client_email: string; private_key: string; }
let _sa: ServiceAccount | null = null;
function getSA(): ServiceAccount | null {
  if (_sa) return _sa;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
  if (!raw) return null;
  try { _sa = JSON.parse(raw) as ServiceAccount; return _sa; } catch { return null; }
}

function base64url(data: string): string {
  return Buffer.from(data).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function signRS256(payload: string, privateKey: string): Promise<string> {
  const { createSign } = await import("node:crypto");
  const s = createSign("RSA-SHA256");
  s.update(payload); s.end();
  return s.sign(privateKey, "base64url");
}

let _tokenCache: { token: string; exp: number } | null = null;

async function getFirebaseToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.exp) return _tokenCache.token;
  const sa = getSA();
  if (!sa) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimSet = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  }));
  const sig = await signRS256(`${header}.${claimSet}`, sa.private_key);
  const jwt = `${header}.${claimSet}.${sig}`;
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!resp.ok) throw new Error(`Token fetch failed: ${resp.status}`);
  const data = await resp.json() as { access_token: string; expires_in: number };
  _tokenCache = { token: data.access_token, exp: (Date.now() + (data.expires_in - 60) * 1000) };
  return _tokenCache.token;
}

// ── GET /api/folder-lock/:folderId — public read ───────────────────────────
folderLockRouter.get("/:folderId", async (req: Request, res: Response): Promise<void> => {
  const folderId = req.params["folderId"] as string;
  const dbUrl = DB_URL();
  if (!dbUrl) { res.json({ locked: false }); return; }
  try {
    const url = `${dbUrl}/folder_passwords/${encodeURIComponent(folderId)}.json`;
    const r = await fetch(url);
    if (!r.ok) { res.json({ locked: false }); return; }
    const val = await r.json() as { password?: string; hint?: string; name?: string } | null;
    if (val?.password) {
      res.json({ locked: true, hint: val.hint ?? null, name: val.name ?? null });
    } else {
      res.json({ locked: false });
    }
  } catch {
    res.json({ locked: false });
  }
});

// ── POST /api/folder-lock/:folderId — save lock (admin only) ──────────────
folderLockRouter.post("/:folderId", async (req: Request, res: Response): Promise<void> => {
  const folderId = req.params["folderId"] as string;
  const { password, hint, name } = req.body as { password?: string; hint?: string; name?: string };
  const dbUrl = DB_URL();
  if (!dbUrl) { res.status(500).json({ error: "Firebase not configured" }); return; }
  if (!password?.trim()) { res.status(400).json({ error: "password required" }); return; }
  try {
    const token = await getFirebaseToken();
    const url = `${dbUrl}/folder_passwords/${encodeURIComponent(folderId)}.json?access_token=${token}`;
    const body = { folderId, password: password.trim(), hint: hint?.trim() ?? "", name: name?.trim() ?? folderId };
    const r = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) { const t = await r.text(); res.status(r.status).json({ error: t }); return; }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ── DELETE /api/folder-lock/:folderId — remove lock (admin only) ──────────
folderLockRouter.delete("/:folderId", async (req: Request, res: Response): Promise<void> => {
  const folderId = req.params["folderId"] as string;
  const dbUrl = DB_URL();
  if (!dbUrl) { res.status(500).json({ error: "Firebase not configured" }); return; }
  try {
    const token = await getFirebaseToken();
    const url = `${dbUrl}/folder_passwords/${encodeURIComponent(folderId)}.json?access_token=${token}`;
    const r = await fetch(url, { method: "DELETE" });
    if (!r.ok) { const t = await r.text(); res.status(r.status).json({ error: t }); return; }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ── POST /api/folder-lock/:folderId/verify — password verify ──────────────
folderLockRouter.post("/:folderId/verify", async (req: Request, res: Response): Promise<void> => {
  const folderId = req.params["folderId"] as string;
  const { password } = req.body as { password?: string };
  const dbUrl = DB_URL();
  if (!dbUrl) { res.json({ ok: false }); return; }
  try {
    const url = `${dbUrl}/folder_passwords/${encodeURIComponent(folderId)}.json`;
    const r = await fetch(url);
    if (!r.ok) { res.json({ ok: false }); return; }
    const val = await r.json() as { password?: string } | null;
    res.json({ ok: !!val?.password && val.password === password });
  } catch {
    res.json({ ok: false });
  }
});

// ── GET /api/folder-lock — read all locks (admin) ─────────────────────────
folderLockRouter.get("/", async (_req: Request, res: Response): Promise<void> => {
  const dbUrl = DB_URL();
  if (!dbUrl) { res.json({}); return; }
  try {
    const url = `${dbUrl}/folder_passwords.json`;
    const r = await fetch(url);
    if (!r.ok) { res.json({}); return; }
    const val = await r.json() as Record<string, { password?: string; hint?: string; name?: string }> | null;
    res.json(val ?? {});
  } catch {
    res.json({});
  }
});
