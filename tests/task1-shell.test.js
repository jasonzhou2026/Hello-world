import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

test("service worker fetches from the current cache and cleans older caches", async () => {
  const source = await readFile("service-worker.js", "utf8");

  assert.match(source, /self\.addEventListener\("activate"/);
  assert.match(source, /caches\s*\.\s*keys\(\)/);
  assert.match(source, /CACHE_PREFIX\s*=\s*"fitness-tracker-pwa-"/);
  assert.match(source, /cacheName\.startsWith\(CACHE_PREFIX\)/);
  assert.match(source, /cacheName !== CACHE_NAME/);
  assert.match(source, /caches\.delete\(cacheName\)/);
  assert.match(source, /self\.skipWaiting\(\)/);
  assert.match(source, /self\.clients\.claim\(\)/);
  assert.doesNotMatch(source, /\.filter\(\(cacheName\) => cacheName !== CACHE_NAME\)/);
  assert.doesNotMatch(source, /caches\.match\(event\.request\)/);
  assert.match(source, /caches\s*\.\s*open\(CACHE_NAME\)/);
  assert.match(source, /cache\.match\(event\.request\)/);
});

test("service worker precaches every static app module", async () => {
  const source = await readFile("service-worker.js", "utf8");
  const assetsBlock = source.match(/const APP_ASSETS = \[([\s\S]*?)\];/)?.[1] || "";
  const cachedAssets = new Set(
    [...assetsBlock.matchAll(/"([^"]+)"/g)].map((match) => match[1])
  );

  assert.deepEqual(
    [
      "./",
      "./assets/icon.svg",
      "./assets/icon-192.png",
      "./assets/icon-512.png",
      "./assets/icon-maskable.svg",
      "./assets/icon-maskable-512.png",
      "./index.html",
      "./manifest.webmanifest",
      "./src/styles.css?v=25",
      "./src/app.js?v=25",
      "./src/muscle-map.js?v=25",
      "./src/domain/backup.js?v=25",
      "./src/domain/nutrition.js?v=25",
      "./src/domain/overview.js?v=25",
      "./src/domain/reports.js?v=25",
      "./src/domain/training.js?v=25",
      "./src/export/xlsx.js?v=25",
      "./src/sampleData.js?v=25",
      "./src/storage/db.js?v=25",
      "./src/vendor/three.core.min.js",
      "./src/vendor/three.module.min.js"
    ].filter((asset) => !cachedAssets.has(asset)),
    []
  );
});

test("manifest declares install icons backed by local files", async () => {
  const manifest = JSON.parse(await readFile("manifest.webmanifest", "utf8"));

  assert.deepEqual(
    manifest.icons.map((icon) => ({
      src: icon.src,
      type: icon.type,
      purpose: icon.purpose
    })),
    [
      {
        src: "./assets/icon.svg",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "./assets/icon-192.png",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "./assets/icon-512.png",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "./assets/icon-maskable.svg",
        type: "image/svg+xml",
        purpose: "maskable"
      },
      {
        src: "./assets/icon-maskable-512.png",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  );

  await Promise.all(
    manifest.icons.map(async (icon) => {
      const source = await readFile(icon.src.replace("./", ""));
      if (icon.type === "image/svg+xml") assert.match(source.toString("utf8"), /<svg\b/);
      else assert.deepEqual([...source.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    })
  );
});

test("app root is not a full-screen live region", async () => {
  const html = await readFile("index.html", "utf8");

  assert.doesNotMatch(html, /<main[^>]*aria-live=/);
});

test("desktop bottom tabs use auto centering instead of negative margin math", async () => {
  const css = await readFile("src/styles.css", "utf8");

  assert.doesNotMatch(css, /margin-left:\s*-/);
  assert.doesNotMatch(css, /left:\s*50%/);
  assert.doesNotMatch(css, /right:\s*50%/);
  assert.match(css, /width:\s*min\(100%,\s*760px\)/);
  assert.match(css, /margin:\s*0 auto/);
});

test("screen bottom padding accounts for safe area", async () => {
  const css = await readFile("src/styles.css", "utf8");

  assert.match(css, /\.screen\s*{[^}]*env\(safe-area-inset-bottom\)/s);
});

test("service worker registration warns instead of throwing unhandled failures", async () => {
  const source = await readFile("src/app.js", "utf8");

  assert.match(
    source,
    /navigator\.serviceWorker\s*\.\s*register\("\.\/service-worker\.js"\)\s*\.\s*catch\(/
  );
  assert.match(source, /console\.warn\(/);
});
