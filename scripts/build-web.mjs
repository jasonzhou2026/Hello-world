import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const destination = path.join(root, "dist");
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const asset of ["index.html", "privacy.html", "support.html", "manifest.webmanifest", "service-worker.js", "src", "assets"]) {
  await cp(path.join(root, asset), path.join(destination, asset), { recursive: true });
}

// Native builds use the same local UI and database as the PWA. No remote server URL.
await cp(path.join(root, "node_modules/@capacitor/core/dist/capacitor.js"), path.join(destination, "capacitor-runtime.js"));
await cp(path.join(root, "node_modules/@capacitor/core/LICENSE"), path.join(destination, "CAPACITOR-LICENSE.txt"));
const index = await readFile(path.join(destination, "index.html"), "utf8");
await writeFile(path.join(destination, "index.html"), index.replace("</head>", `    <script src="./capacitor-runtime.js"></script>
    <script>if (Capacitor.isNativePlatform()) Capacitor.registerPlugin("FitnessExport");</script>
  </head>`));
console.log("Bundled offline web assets in dist/.");
