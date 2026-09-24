const CACHE_PREFIX = "fitness-tracker-pwa-";
const CACHE_NAME = "fitness-tracker-pwa-v37";
const APP_ASSETS = [
  "./",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable.svg",
  "./assets/icon-maskable-512.png",
  "./index.html",
  "./manifest.webmanifest",
  "./src/styles.css?v=37",
  "./src/app.js?v=32",
  "./src/muscle-map.js?v=32",
  "./src/domain/backup.js?v=32",
  "./src/domain/nutrition.js?v=32",
  "./src/domain/overview.js?v=32",
  "./src/domain/reports.js?v=32",
  "./src/domain/training.js?v=32",
  "./src/domain/nutrition.js",
  "./src/domain/reports.js",
  "./src/domain/training.js",
  "./src/export/xlsx.js?v=32",
  "./src/sampleData.js?v=32",
  "./src/storage/db.js?v=32",
  "./src/vendor/three.core.min.js",
  "./src/vendor/three.module.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter(
                (cacheName) =>
                  cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME
              )
              .map((cacheName) => caches.delete(cacheName))
          )
        ),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.match(event.request))
      .then((cached) => cached || fetch(event.request))
  );
});
