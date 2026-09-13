/**
 * Desktop shell generator.
 *
 * The Tauri Windows build loads the UI from disk (no Node server), but the
 * TanStack Start build only emits server-rendered HTML. This reads the build
 * manifest and writes a static `dist/client/index.html` that boots the same
 * client bundle in pure client-render mode.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const serverDir = "dist/server";
const clientDir = "dist/client";

const files = await readdir(serverDir);
const manifestFile = files.find((f) => f.startsWith("_tanstack-start-manifest_v-"));
if (!manifestFile) {
  throw new Error("Build manifest not found — run `bun run build` first.");
}
const manifest = await readFile(join(serverDir, manifestFile), "utf8");

const scripts = [...manifest.matchAll(/src:\s*"(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
const css = [...manifest.matchAll(/"(\/assets\/[^"]+\.css)"/g)].map((m) => m[1]);
const entry = scripts[0];
if (!entry) throw new Error("Client entry script not found in the build manifest.");

const uniqueCss = [...new Set(css)];
const html = `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>DJ Set Recorder</title>
    <link rel="icon" href="/favicon.png" type="image/png" />
${uniqueCss.map((href) => `    <link rel="stylesheet" href="${href}" />`).join("\n")}
  </head>
  <body>
    <script type="module" src="${entry}"></script>
  </body>
</html>
`;

await writeFile(join(clientDir, "index.html"), html);
console.log(`Wrote ${clientDir}/index.html (entry ${entry}, ${uniqueCss.length} stylesheet(s))`);
