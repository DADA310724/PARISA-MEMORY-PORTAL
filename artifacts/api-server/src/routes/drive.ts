import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";

export const driveRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

let _serviceAccount: ServiceAccount | null = null;
function getServiceAccount(): ServiceAccount | null {
  if (_serviceAccount) return _serviceAccount;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
  if (!raw) return null;
  try {
    _serviceAccount = JSON.parse(raw) as ServiceAccount;
    return _serviceAccount;
  } catch {
    return null;
  }
}

// ── JWT / access-token helpers ──────────────────────────────────────────────

function base64url(data: string): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function signRS256(payload: string, privateKey: string): Promise<string> {
  const { createSign } = await import("node:crypto");
  const sign = createSign("RSA-SHA256");
  sign.update(payload);
  sign.end();
  return sign.sign(privateKey, "base64url");
}

let _tokenCache: { token: string; exp: number } | null = null;

// ── Media chunk cache ─────────────────────────────────────────────────────
// Caches the first CHUNK_BYTES of each media file so first-play is instant.
const CHUNK_BYTES = 2 * 1024 * 1024; // 2 MB per file
const MAX_CACHE_ENTRIES = 15;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

interface CachedChunk {
  data: Buffer;
  contentType: string;
  totalSize: number;
  ts: number;
}
const mediaChunkCache = new Map<string, CachedChunk>();

function evictCache() {
  const now = Date.now();
  for (const [k, v] of mediaChunkCache) {
    if (now - v.ts > CACHE_TTL_MS) mediaChunkCache.delete(k);
  }
  if (mediaChunkCache.size > MAX_CACHE_ENTRIES) {
    const sorted = [...mediaChunkCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    sorted.slice(0, mediaChunkCache.size - MAX_CACHE_ENTRIES).forEach(([k]) => mediaChunkCache.delete(k));
  }
}

async function fetchAndCacheChunk(id: string): Promise<CachedChunk | null> {
  try {
    const token = await getAccessToken();
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${id}?alt=media&acknowledgeAbuse=true`;
    const resp = await fetch(driveUrl, {
      headers: { Authorization: `Bearer ${token}`, Range: `bytes=0-${CHUNK_BYTES - 1}` },
    });
    if (!resp.ok && resp.status !== 206) return null;
    const ct = resp.headers.get("content-type") ?? "application/octet-stream";
    if (ct.includes("text/html")) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    const rangeMatch = resp.headers.get("content-range")?.match(/\/(\d+)/);
    const totalSize = rangeMatch ? parseInt(rangeMatch[1]) : buf.length;
    const chunk: CachedChunk = { data: buf, contentType: ct, totalSize, ts: Date.now() };
    evictCache();
    mediaChunkCache.set(id, chunk);
    return chunk;
  } catch {
    return null;
  }
}

async function getAccessToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.exp) return _tokenCache.token;

  const sa = getServiceAccount();
  if (!sa) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimSet = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claimSet}`;
  const signature = await signRS256(signingInput, sa.private_key);
  const jwt = `${signingInput}.${signature}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token exchange failed: ${text}`);
  }
  const data = await resp.json() as { access_token: string; expires_in: number };
  _tokenCache = { token: data.access_token, exp: (now + data.expires_in - 60) * 1000 };
  return _tokenCache.token;
}

async function driveGet(path: string, params?: Record<string, string>): Promise<globalThis.Response> {
  const token = await getAccessToken();
  const url = new URL(`https://www.googleapis.com/drive/v3/${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  return fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Routes ───────────────────────────────────────────────────────────────────

driveRouter.get("/ready", async (_req: Request, res: Response) => {
  const sa = getServiceAccount();
  if (!sa) {
    res.json({ ready: false, reason: "GOOGLE_SERVICE_ACCOUNT_JSON not set" });
    return;
  }
  try {
    const token = await getAccessToken();
    const testResp = await fetch(
      "https://www.googleapis.com/drive/v3/about?fields=user",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (testResp.ok) {
      const data = await testResp.json() as { user?: { emailAddress?: string } };
      res.json({ ready: true, email: data.user?.emailAddress ?? sa.client_email });
    } else {
      res.json({ ready: false, reason: `Drive API error: ${testResp.status}` });
    }
  } catch (err) {
    res.json({ ready: false, reason: String(err) });
  }
});

async function countFilesRecursive(folderId: string, token: string, depth = 0): Promise<number> {
  if (depth > 4) return 0;
  let total = 0;
  let pageToken: string | undefined;
  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${folderId}' in parents and trashed=false`);
    url.searchParams.set("fields", "nextPageToken,files(id,mimeType)");
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) break;
    const data = await resp.json() as { files: { id: string; mimeType: string }[]; nextPageToken?: string };
    for (const file of data.files) {
      if (file.mimeType === "application/vnd.google-apps.folder") {
        total += await countFilesRecursive(file.id, token, depth + 1);
      } else {
        total++;
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return total;
}

driveRouter.post("/count-folders", async (req: Request, res: Response) => {
  const { folderIds } = req.body as { folderIds?: string[] };
  if (!Array.isArray(folderIds) || folderIds.length === 0) {
    res.status(400).json({ error: "folderIds array required" });
    return;
  }
  try {
    const token = await getAccessToken();
    const counts: Record<string, number> = {};
    await Promise.all(
      folderIds.map(async (folderId) => {
        try {
          counts[folderId] = await countFilesRecursive(folderId, token);
        } catch {
          counts[folderId] = 0;
        }
      }),
    );
    res.json({ counts });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

driveRouter.get("/list", async (req: Request, res: Response) => {
  const folderId = req.query.folderId as string | undefined;
  if (!folderId) { res.status(400).json({ error: "folderId required" }); return; }

  try {
    const token = await getAccessToken();
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${folderId}' in parents and trashed=false`);
    url.searchParams.set("fields", "files(id,name,mimeType,size,modifiedTime,iconLink,thumbnailLink,webViewLink,webContentLink,parents),nextPageToken");
    url.searchParams.set("orderBy", "name");
    url.searchParams.set("pageSize", "200");

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      const text = await resp.text();
      res.status(resp.status).json({ error: text });
      return;
    }
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

driveRouter.get("/file/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const resp = await driveGet(`files/${id}`, {
      fields: "id,name,mimeType,size,modifiedTime,iconLink,thumbnailLink,webViewLink,webContentLink,parents",
    });
    if (!resp.ok) { const t = await resp.text(); res.status(resp.status as number).json({ error: t }); return; }
    res.json(await resp.json());
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

driveRouter.get("/text/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const token = await getAccessToken();
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!resp.ok) { const t = await resp.text(); res.status(resp.status).json({ error: t }); return; }
    const text = await resp.text();
    res.json({ text });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Warm up the chunk cache in background — browser calls this silently when folder loads
driveRouter.get("/prefetch/:id", async (req: Request, res: Response) => {
  const id = String(req.params["id"]);
  res.json({ ok: true }); // respond immediately, cache in background
  if (!mediaChunkCache.has(id)) {
    fetchAndCacheChunk(id).catch(() => {});
  } else {
    // Refresh timestamp so entry doesn't expire
    const entry = mediaChunkCache.get(id);
    if (entry) entry.ts = Date.now();
  }
});

// ── Proper Range-forwarding stream proxy ─────────────────────────────────────
// Browser uses <video src="/api/drive/stream/ID"> directly.
// All Range requests (seek, resume, partial) are forwarded to Google Drive and
// piped back — no double-hop, no access_token in URL, no redirect chasing.
driveRouter.get("/stream/:id", async (req: Request, res: Response) => {
  const id = String(req.params["id"]);
  try {
    const token = await getAccessToken();
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&acknowledgeAbuse=true`;

    const reqHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    // Forward Range header — critical for seeking and partial play
    const range = req.headers["range"];
    if (range) reqHeaders["Range"] = range;

    const driveResp = await fetch(driveUrl, { headers: reqHeaders });

    // 206 Partial Content is expected for ranged requests
    if (!driveResp.ok && driveResp.status !== 206) {
      res.status(driveResp.status).send("Google Drive error");
      return;
    }

    // Forward response headers the browser needs for proper streaming
    res.status(range ? 206 : driveResp.status);
    const ct = driveResp.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    const cl = driveResp.headers.get("content-length");
    if (cl) res.setHeader("Content-Length", cl);
    const cr = driveResp.headers.get("content-range");
    if (cr) res.setHeader("Content-Range", cr);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "no-store");

    // Pipe directly — data flows from Google to browser with zero buffering in our process
    if (!driveResp.body) { res.end(); return; }
    const { Readable } = await import("node:stream");
    Readable.fromWeb(driveResp.body as import("stream/web").ReadableStream).pipe(res);
  } catch (err) {
    if (!res.headersSent) res.status(500).send(String(err));
  }
});

// Backward-compat: mediaurl now returns our stream URL (not googleapis.com)
driveRouter.get("/mediaurl/:id", async (req: Request, res: Response) => {
  const id = String(req.params["id"]);
  res.setHeader("Cache-Control", "no-store");
  res.json({ url: `/api/drive/stream/${encodeURIComponent(id)}` });
});

// Proxy route for images, PDFs, HTML — redirects are fine for non-streaming content
driveRouter.get("/proxy/:id", async (req: Request, res: Response) => {
  const id = String(req.params["id"]);
  try {
    const token = await getAccessToken();
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&acknowledgeAbuse=true&access_token=${encodeURIComponent(token)}`;
    res.setHeader("Cache-Control", "no-store, no-cache");
    res.redirect(302, driveUrl);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

driveRouter.post("/upload", upload.array("files"), async (req: Request, res: Response) => {
  const folderId = req.body.folderId as string | undefined;
  if (!folderId) { res.status(400).json({ error: "folderId required" }); return; }

  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) { res.status(400).json({ error: "no files" }); return; }

  try {
    const token = await getAccessToken();
    const results = await Promise.all(
      files.map(async (f) => {
        const metadata = JSON.stringify({ name: f.originalname, parents: [folderId] });
        const body = new FormData();
        body.append("metadata", new Blob([metadata], { type: "application/json" }));
        body.append("file", new Blob([f.buffer as unknown as ArrayBuffer], { type: f.mimetype }), f.originalname);

        const resp = await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType",
          { method: "POST", headers: { Authorization: `Bearer ${token}` }, body },
        );
        if (!resp.ok) return { error: await resp.text(), name: f.originalname };
        return resp.json();
      }),
    );
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

driveRouter.post("/copy-from-drive", async (req: Request, res: Response) => {
  const { sourceFileId, destFolderId, name } = req.body as {
    sourceFileId: string; destFolderId: string; name?: string;
  };
  if (!sourceFileId || !destFolderId) {
    res.status(400).json({ error: "sourceFileId and destFolderId required" }); return;
  }
  try {
    const token = await getAccessToken();
    const body: Record<string, unknown> = { parents: [destFolderId] };
    if (name) body.name = name;
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${sourceFileId}/copy?fields=id,name,mimeType`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!resp.ok) { const t = await resp.text(); res.status(resp.status).json({ error: t }); return; }
    res.json(await resp.json());
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

driveRouter.get("/find-file", async (req: Request, res: Response) => {
  const folder_id = req.query.folder_id as string;
  const name = req.query.name as string;
  if (!folder_id || !name) { res.status(400).json({ error: "folder_id and name required" }); return; }
  try {
    const safeName = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const listResp = await driveGet("files", {
      q: `'${folder_id}' in parents and name='${safeName}' and trashed=false`,
      fields: "files(id,name,mimeType,thumbnailLink)",
      pageSize: "5",
    });
    if (!listResp.ok) { res.status(404).json({ error: "Not found" }); return; }
    const data = await listResp.json() as { files: Array<{id:string;name:string;mimeType:string;thumbnailLink?:string}> };
    if (!data.files?.length) { res.status(404).json({ error: "File not found" }); return; }
    res.json(data.files[0]);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

driveRouter.get("/list-screenshots", async (req: Request, res: Response) => {
  const rootFolderId = req.query.folderId as string | undefined;
  if (!rootFolderId) { res.status(400).json({ error: "folderId required" }); return; }
  try {
    const token = await getAccessToken();

    // Fetch root-level images AND subfolders in parallel
    const [subResp, rootImgResp] = await Promise.all([
      fetch(
        (() => { const u = new URL("https://www.googleapis.com/drive/v3/files"); u.searchParams.set("q", `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`); u.searchParams.set("fields", "files(id,name)"); u.searchParams.set("pageSize", "20"); return u.toString(); })(),
        { headers: { Authorization: `Bearer ${token}` } }
      ),
      fetch(
        (() => { const u = new URL("https://www.googleapis.com/drive/v3/files"); u.searchParams.set("q", `'${rootFolderId}' in parents and mimeType contains 'image/' and trashed=false`); u.searchParams.set("fields", "files(id,name,modifiedTime)"); u.searchParams.set("orderBy", "modifiedTime desc"); u.searchParams.set("pageSize", "200"); return u.toString(); })(),
        { headers: { Authorization: `Bearer ${token}` } }
      ),
    ]);

    if (!subResp.ok) { res.status(subResp.status).json({ error: await subResp.text() }); return; }
    const subData = await subResp.json() as { files: Array<{ id: string; name: string }> };

    const result: Record<string, Array<{ id: string; name: string; modifiedTime: string }>> = {};

    // Include root-level images directly in the folder (e.g. Photos folder with no subfolders)
    if (rootImgResp.ok) {
      const rootImgData = await rootImgResp.json() as { files: Array<{ id: string; name: string; modifiedTime: string }> };
      if (rootImgData.files.length > 0) result["__root__"] = rootImgData.files;
    }

    // Include subfolder images
    await Promise.all(
      subData.files.map(async (folder) => {
        const fileUrl = new URL("https://www.googleapis.com/drive/v3/files");
        fileUrl.searchParams.set("q", `'${folder.id}' in parents and mimeType contains 'image/' and trashed=false`);
        fileUrl.searchParams.set("fields", "files(id,name,modifiedTime)");
        fileUrl.searchParams.set("orderBy", "modifiedTime desc");
        fileUrl.searchParams.set("pageSize", "200");
        const fileResp = await fetch(fileUrl.toString(), { headers: { Authorization: `Bearer ${token}` } });
        if (!fileResp.ok) return;
        const fileData = await fileResp.json() as { files: Array<{ id: string; name: string; modifiedTime: string }> };
        if (fileData.files.length > 0) result[folder.name] = fileData.files;
      })
    );
    res.json({ subfolders: result });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

driveRouter.post("/create-folder", async (req: Request, res: Response) => {
  const { name, parentId } = req.body as { name: string; parentId: string };
  if (!name || !parentId) { res.status(400).json({ error: "name and parentId required" }); return; }
  try {
    const token = await getAccessToken();
    const resp = await fetch(
      "https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentId],
        }),
      },
    );
    if (!resp.ok) { const t = await resp.text(); res.status(resp.status).json({ error: t }); return; }
    res.json(await resp.json());
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
