const CACHE_PREFIX = "fitness-tracker-pwa-";
const CACHE_NAME = "fitness-tracker-pwa-v2";
const APP_ASSETS = [
  "./",
  "./assets/icon.svg",
  "./assets/icon-maskable.svg",
  "./index.html",
  "./manifest.webmanifest",
  "./src/styles.css",
  "./src/app.js",
  "./src/domain/nutrition.js",
  "./src/domain/reports.js",
  "./src/domain/training.js",
  "./src/export/xlsx.js",
  "./src/sampleData.js",
  "./src/storage/db.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
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
      )
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
