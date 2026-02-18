/// <reference lib="webworker" />

const CACHE_NAME = "cubis-v1";
const PRECACHE_URLS = ["/", "/whiteboards"];

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => sw.skipWaiting())
  );
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => sw.clients.claim())
  );
});

sw.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, API calls, and socket.io
  if (request.method !== "GET" || url.pathname.startsWith("/api/") || url.pathname.includes("socket.io")) return;

  // Network-first for navigations, stale-while-revalidate for assets
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        return res;
      }).catch(() => caches.match(request).then((r) => r || caches.match("/") as Promise<Response>))
    );
  } else {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        }).catch(() => cached as Response);
        return cached || fetchPromise;
      })
    );
  }
});
