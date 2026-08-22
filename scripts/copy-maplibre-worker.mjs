import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * MapLibre v6 resolves its web worker from `import.meta.url` at runtime, which
 * Turbopack cannot rewrite, so the map ends up with `new Worker("")` and silently
 * renders no tiles. We serve the worker ourselves and point `setWorkerUrl` at it.
 *
 * The worker imports `./maplibre-gl-shared.mjs` relative to itself, so both files
 * have to land in the same directory. Re-run on install so they never drift from
 * the installed maplibre-gl version.
 */
const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];
const OUT_DIR = new URL("../public/maplibre/", import.meta.url);

const require = createRequire(import.meta.url);
const distDir = join(dirname(require.resolve("maplibre-gl/package.json")), "dist");

await mkdir(OUT_DIR, { recursive: true });

for (const file of FILES) {
  await copyFile(join(distDir, file), new URL(file, OUT_DIR));
  console.log(`copied ${file}`);
}
