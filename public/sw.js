const CACHE = "podfiy-shell-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        c.addAll([
          "/offline.html",
          "/icons/icon-192.png",
          "/icons/icon-512.png",
        ]),
      ),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const r = event.request,
    u = new URL(r.url);
  if (
    r.method !== "GET" ||
    u.origin !== self.location.origin ||
    u.pathname.startsWith("/api/") ||
    r.headers.has("RSC") ||
    u.searchParams.has("_rsc")
  )
    return;
  if (r.mode === "navigate") {
    event.respondWith(fetch(r).catch(() => caches.match("/offline.html")));
    return;
  }
  if (
    u.pathname.startsWith("/_next/static/") ||
    u.pathname.startsWith("/icons/")
  )
    event.respondWith(
      caches.match(r).then(
        (hit) =>
          hit ||
          fetch(r).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              void caches.open(CACHE).then((c) => c.put(r, copy));
            }
            return res;
          }),
      ),
    );
});
