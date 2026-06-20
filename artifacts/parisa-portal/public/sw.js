// PARISA MEMORY PORTAL — Service Worker v3.0
// Full offline support: Range request caching for video/audio playback
const CACHE_NAME  = "parisa-v3.0";
const MEDIA_CACHE = "parisa-media-v3.0";

const STATIC_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.svg",
];

// Parse bytes=start-end header → {start, end}
function parseRange(header, total) {
  const m = header.match(/bytes=(\d*)-(\d*)/);
  if (!m) return null;
  const start = m[1] !== "" ? parseInt(m[1], 10) : total - parseInt(m[2], 10);
  const end   = m[2] !== "" ? parseInt(m[2], 10) : total - 1;
  return { start: Math.max(0, start), end: Math.min(end, total - 1) };
}

// Serve a slice of a (full) Response according to a Range header
async function serveRange(resp, rangeHeader) {
  const buf   = await resp.arrayBuffer();
  const range = parseRange(rangeHeader, buf.byteLength);
  if (!range) return new Response("Range Not Satisfiable", { status: 416 });
  const { start, end } = range;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type":   resp.headers.get("content-type") || "application/octet-stream",
      "Content-Range":  `bytes ${start}-${end}/${buf.byteLength}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges":  "bytes",
    },
  });
}

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME && k !== MEDIA_CACHE)
            .map((k)  => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // ── Drive media proxy — offline-first + Range support ────────────────────
  if (
    url.pathname.startsWith("/api/drive/proxy/") ||
    url.pathname.startsWith("/api/drive/prefetch/")
  ) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then(async (cache) => {
        // Canonical (range-free) key so all range sub-requests hit the same entry
        const cacheKey   = new Request(url.href, { method: "GET" });
        const rangeHdr   = event.request.headers.get("range");

        const cached = await cache.match(cacheKey);

        if (cached) {
          // Serve byte-range from the cached full file → enables seeking offline
          if (rangeHdr) return serveRange(cached.clone(), rangeHdr);
          return cached.clone();
        }

        // Not cached yet — fetch the full file (always, regardless of Range header)
        try {
          const fullResp = await fetch(cacheKey);
          if (fullResp.ok && fullResp.status === 200) {
            const forCache = fullResp.clone();
            // Store full file; don't await — let playback start immediately
            cache.put(cacheKey, forCache);
            if (rangeHdr) return serveRange(fullResp.clone(), rangeHdr);
            return fullResp;
          }
          // Non-200 from server — forward as-is (e.g. 401, 404)
          return fullResp;
        } catch {
          return new Response("Media offline — ক্যাশ নেই", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      })
    );
    return;
  }

  // ── Other API calls — never cache ─────────────────────────────────────────
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: "offline" }), {
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // ── HTML navigation — network-first ───────────────────────────────────────
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/").then((r) => r || caches.match(event.request))
      )
    );
    return;
  }

  // ── Static assets — cache-first ───────────────────────────────────────────
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((resp) => {
          if (resp.ok && event.request.method === "GET") {
            caches.open(CACHE_NAME).then((c) => c.put(event.request, resp.clone()));
          }
          return resp;
        })
        .catch(() => cached || new Response("Offline", { status: 503 }));
    })
  );
});

// ── Prefetch media on demand (from app) ──────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type !== "PREFETCH_MEDIA" || !Array.isArray(event.data.urls)) return;
  caches.open(MEDIA_CACHE).then(async (cache) => {
    for (const rawUrl of event.data.urls) {
      try {
        const cacheKey = new Request(rawUrl, { method: "GET" });
        const already  = await cache.match(cacheKey);
        if (!already) {
          const resp = await fetch(cacheKey);
          if (resp.ok && resp.status === 200) cache.put(cacheKey, resp);
        }
      } catch { /* ignore individual failures */ }
    }
  });
});
