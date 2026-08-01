import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { Readable } from "node:stream";
import { getOAuthToken, SCOPE_DRIVE } from "../lib/googleAuth.js";

export const driveRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// Thin wrapper so callers don't need to pass the scope
async function getAccessToken(): Promise<string> {
  return getOAuthToken(SCOPE_DRIVE);
}

// ── Media chunk cache ─────────────────────────────────────────────────────
// Caches the first CHUNK_BYTES of each media file so first-play is instant.
const CHUNK_BYTES = 5 * 1024 * 1024; // 5 MB per file — larger buffer for smoother streaming
const MAX_CACHE_ENTRIES = 30;
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
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
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
      res.json({ ready: true, email: data.user?.emailAddress ?? "" });
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
    const allFiles: unknown[] = [];
    let pageToken: string | undefined;

    // Paginate through ALL files — Google Drive returns max 1000 per page
    do {
      const url = new URL("https://www.googleapis.com/drive/v3/files");
      url.searchParams.set("q", `'${folderId}' in parents and trashed=false`);
      url.searchParams.set("fields", "files(id,name,mimeType,size,modifiedTime,iconLink,thumbnailLink,webViewLink,webContentLink,parents),nextPageToken");
      url.searchParams.set("orderBy", "name");
      url.searchParams.set("pageSize", "1000");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const resp = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const text = await resp.text();
        res.status(resp.status).json({ error: text });
        return;
      }
      const data = await resp.json() as { files: unknown[]; nextPageToken?: string };
      allFiles.push(...(data.files ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    res.json({ files: allFiles });
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

  // AbortController: cancels Google Drive fetch immediately when browser
  // disconnects (seek, close, tab switch). Prevents resource exhaustion
  // that caused stream failures on autoscale/published deployments.
  const abortCtrl = new AbortController();
  req.on("close", () => { abortCtrl.abort(); });

  try {
    // Cold-start resilience: retry up to 4 times (500ms→1s→2s→3s) to cover Render/Railway wake-up.
    // On free-tier hosts the process restarts and secrets may inject a few seconds after start.
    let token!: string;
    const delays = [500, 1000, 2000, 3000];
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        token = await getAccessToken();
        break; // success
      } catch (e) {
        if (attempt < delays.length) {
          await new Promise(r => setTimeout(r, delays[attempt]));
        } else {
          throw e; // give up after 5th attempt
        }
      }
    }
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&acknowledgeAbuse=true`;

    const reqHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    // Forward Range header — critical for seeking and partial play
    const range = req.headers["range"];
    if (range) reqHeaders["Range"] = range;

    const driveResp = await fetch(driveUrl, {
      headers: reqHeaders,
      signal: abortCtrl.signal,
    });

    // Only reject true errors — 206 Partial Content is valid for range requests
    if (!driveResp.ok && driveResp.status !== 206) {
      if (!res.headersSent) res.status(driveResp.status).send("Google Drive error");
      return;
    }

    // Forward response headers the browser needs for proper streaming.
    // IMPORTANT: Always use Google Drive's actual status code — never override it.
    // Overriding (e.g. forcing 206 when Drive returned 200) breaks the
    // Content-Range contract and causes browsers to fire MediaError immediately.
    res.status(driveResp.status);
    const ct = driveResp.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    const cl = driveResp.headers.get("content-length");
    if (cl) res.setHeader("Content-Length", cl);
    const cr = driveResp.headers.get("content-range");
    if (cr) res.setHeader("Content-Range", cr);
    res.setHeader("Accept-Ranges", "bytes");
    // Allow browser to cache video/audio chunks — critical for smooth seeking & replay
    res.setHeader("Cache-Control", "private, max-age=3600");

    // Pipe directly — data flows from Google to browser with zero buffering in our process
    if (!driveResp.body) { res.end(); return; }
    const readable = Readable.fromWeb(driveResp.body as import("stream/web").ReadableStream);
    readable.on("error", () => { if (!res.writableEnded) res.destroy(); });
    // Destroy readable when client disconnects — prevents memory/connection leak
    res.on("close", () => { readable.destroy(); });
    readable.pipe(res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // AbortError is expected when browser disconnects — not a real error
    if (msg.includes("abort") || msg.toLowerCase().includes("aborted")) return;
    if (!res.headersSent) res.status(500).send(msg);
  }
});

// Backward-compat: mediaurl now returns our stream URL (not googleapis.com)
driveRouter.get("/mediaurl/:id", async (req: Request, res: Response) => {
  const id = String(req.params["id"]);
  res.setHeader("Cache-Control", "no-store");
  res.json({ url: `/api/drive/stream/${encodeURIComponent(id)}` });
});

// Proxy route for images, PDFs, HTML, audio, video — pipes content directly (no redirect)
// Supports Range requests so media seeking works correctly.
// This avoids X-Frame-Options and CORS blocks from googleapis.com
driveRouter.get("/proxy/:id", async (req: Request, res: Response) => {
  const id = String(req.params["id"]);
  const rangeHeader = req.headers["range"] as string | undefined;

  // NOTE: Server-side RAM cache reading was tested in V-42 but caused stall/retry
  // on large video files (40MB+): the first 5MB served from RAM plays through in
  // 1-2 seconds, then the transition to Drive streaming caused buffering stalls.
  // Fix: always stream directly from Drive for consistent playback speed.
  // Browser-level caching (Cache-Control: private, max-age=3600) handles replay/seek.

  const abort = new AbortController();
  res.on("close", () => abort.abort());
  try {
    const token = await getAccessToken();
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&acknowledgeAbuse=true`;
    const driveResp = await fetch(driveUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        // Forward Range header so Drive returns proper 206 for media seeking
        ...(rangeHeader ? { Range: rangeHeader } : {}),
      },
      signal: abort.signal,
    });
    if (!driveResp.ok) {
      res.status(driveResp.status).send("Google Drive error");
      return;
    }
    const ct = driveResp.headers.get("content-type") ?? "application/octet-stream";
    const isMedia = ct.startsWith("audio/") || ct.startsWith("video/");
    res.setHeader("Content-Type", ct);
    res.setHeader("Accept-Ranges", "bytes");
    // Audio/video: allow browser to cache chunks (faster seek, replay, no redundant Drive fetches)
    // Images/PDFs/other: no-cache (always fresh)
    res.setHeader("Cache-Control", isMedia ? "private, max-age=3600" : "no-store, no-cache");
    // Allow embedding in iframes — remove any restrictive framing headers
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.removeHeader("Content-Security-Policy");
    const cl = driveResp.headers.get("content-length");
    if (cl) res.setHeader("Content-Length", cl);
    // Forward Content-Range for 206 partial responses
    const cr = driveResp.headers.get("content-range");
    if (cr) res.setHeader("Content-Range", cr);
    // Use the actual status from Drive (200 full or 206 partial)
    res.status(driveResp.status);
    if (!driveResp.body) { res.end(); return; }
    const readable = Readable.fromWeb(driveResp.body as import("stream/web").ReadableStream);
    readable.on("error", () => { if (!res.writableEnded) res.destroy(); });
    res.on("close", () => { readable.destroy(); });
    readable.pipe(res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort") || msg.toLowerCase().includes("aborted")) return;
    if (!res.headersSent) res.status(500).json({ error: msg });
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
