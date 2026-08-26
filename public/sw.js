// petra-v2: v1 pre-cached "/" and "/dashboard" HTML at install time and served
// them whenever a navigation fetch failed (flaky mobile network). That stale
// HTML referenced JS chunks deleted by later deploys → the recurring
// "קובץ שגיאה" reports. v2 caches only the offline fallback page; the cache
// name bump makes every client's poisoned v1 cache get deleted on activate.
const CACHE_NAME = "petra-v2";

// Cache only the offline fallback — never real pages (their chunk URLs rot)
const STATIC_ASSETS = ["/offline"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache API routes or auth routes
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/register") ||
    event.request.method !== "GET"
  ) {
    return;
  }

  // Navigations: network only, offline page as the fallback. Never serve a
  // stale HTML shell — it points at hashed chunks that no longer exist.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/offline").then((r) => r || Response.error())
      )
    );
  } else {
    // Static assets are content-hashed and immutable — cache-first is safe.
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});
