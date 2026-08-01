// PARISA MEMORY PORTAL — Service Worker v3.8
// Media: direct pass-through (no caching) — eliminates arrayBuffer memory bottleneck
// Static: cache-first for offline shell
const CACHE_NAME  = "parisa-v3.8";
const MEDIA_CACHE = "parisa-media-v3.8";

const STATIC_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.svg",
];

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

  // ── Drive media proxy — direct pass-through (no SW cache) ─────────────────
  // IMPORTANT: must use event.respondWith(fetch(...)) — NOT plain "return;"
  // When a SW is registered, Chrome's media element requires the SW to explicitly
  // call event.respondWith(). A bare "return;" causes Chrome to fire onerror
  // immediately on audio/video elements (broken media pipeline).
  //
  // NO caching: the old approach cached full files then called arrayBuffer() for
  // every 64 KB Range slice — loading a 38 MB file into memory hundreds of times
  // per playback, causing stutter and freezes. Pass-through is faster and simpler.
  if (url.pathname.startsWith("/api/drive/proxy/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // ── Drive stream — same direct pass-through ───────────────────────────────
  if (url.pathname.startsWith("/api/drive/stream/")) {
    event.respondWith(fetch(event.request));
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
