/* =========================================================
   ParisiFinder — service-worker.js
   Caches the app shell + product data for offline use.
   Bump CACHE_NAME whenever any cached file changes so
   clients pick up the new version.
   ========================================================= */

const CACHE_NAME = "parisifinder-cache-v1";

// Paths are relative so this works whether the site is served
// from the domain root or a GitHub Pages project subpath.
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./script.js",
  "./data.json",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Strategy:
// - data.json: network-first (so warehouse data stays fresh when online),
//   falling back to cache when offline.
// - everything else (app shell): cache-first, falling back to network.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isDataFile = url.pathname.endsWith("data.json");

  if (isDataFile) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => cached);
    })
  );
});
