// PARISA MEMORY PORTAL — Service Worker v3.1
// Offline-first with Range support: full files cached, seekable offline
const CACHE_NAME  = "parisa-v3.1";
const MEDIA_CACHE = "parisa-media-v3.1";

const STATIC_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.svg",
];

// Serve a byte-range from a cached full Response
async function serveRange(cachedResp, rangeHeader) {
  const buf  = await cachedResp.arrayBuffer();
  const m    = rangeHeader.match(/bytes=(\d*)-(\d*)/);
  if (!m) return new Response("Range Not Satisfiable", { status: 416 });
  const total = buf.byteLength;
  const start = m[1] !== "" ? parseInt(m[1], 10) : total - parseInt(m[2], 10);
  const end   = m[2] !== "" ? parseInt(m[2], 10) : total - 1;
  const s = Math.max(0, start);
  const e = Math.min(end, total - 1);
  return new Response(buf.slice(s, e + 1), {
    status: 206,
    headers: {
      "Content-Type":   cachedResp.headers.get("content-type") || "application/octet-stream",
      "Content-Range":  `bytes ${s}-${e}/${total}`,
      "Content-Length": String(e - s + 1),
      "Accept-Ranges":  "bytes",
    },
  });
}

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((c) => c.addAll(STATIC_ASSETS))
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
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // ── Drive media proxy — stale-while-revalidate + Range-from-cache ─────────
  if (
    url.pathname.startsWith("/api/drive/proxy/") ||
    url.pathname.startsWith("/api/drive/prefetch/")
  ) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then(async (cache) => {
        // Canonical key without Range header (so all Range requests hit same entry)
        const cacheKey = new Request(url.href, { method: "GET" });
        const rangeHdr = event.request.headers.get("range");

        // Check for cached FULL response
        const cachedFull = await cache.match(cacheKey);

        if (cachedFull) {
          // ── Cache hit: serve range from cached full file ────────────────
          // This enables seeking in video/audio even when offline
          if (rangeHdr) return serveRange(cachedFull.clone(), rangeHdr);
          return cachedFull.clone();
        }

        // ── Cache miss: forward ORIGINAL request to server ─────────────────
        // IMPORTANT: pass event.request (not cacheKey) so Range headers reach server
        // This allows the browser to start streaming immediately
        try {
          const resp = await fetch(event.request);
          if (resp.ok && resp.status === 200) {
            // Cache the full response for offline/seeking later
            cache.put(cacheKey, resp.clone());
          }
          // 206 partial responses are forwarded as-is (not cached individually)
          return resp;
        } catch {
          // Offline and nothing in cache
          return new Response("Media offline", {
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

// ── Prefetch media on demand ──────────────────────────────────────────────────
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
      } catch { /* skip failed prefetches */ }
    }
  });
});
