// Minimal, safe service worker for AvenueOS.
// Network-first for everything (the app is dynamic + auth-gated), with a tiny
// offline fallback for navigations. Never caches API/auth responses.
const CACHE = "avenueos-v1";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // never touch API / auth / next data
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/login")) return;

  // Cache static assets (icons, _next/static) cache-first.
  const isStatic =
    url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons");
  if (isStatic) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Navigations: network-first, fall back to cache if offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r || caches.match("/"))),
    );
  }
});
