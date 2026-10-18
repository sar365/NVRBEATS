/**
 * Desktop start page generator (run with bun).
 *
 * The Tauri Windows build loads the UI from disk — there is no Node server in
 * the desktop app. TanStack Start only emits a server bundle, so this renders
 * the "/" route once through that bundle and writes the result as a static
 * .output/public/index.html. The client bundle hydrates it and all further
 * navigation happens client-side.
 */
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const serverEntry = pathToFileURL(resolve(".output/server/index.mjs")).href;
const mod = await import(serverEntry);
const handler = mod.default;
if (!handler?.fetch) {
  throw new Error("Server bundle not found — run `vite build` first.");
}

const res = await handler.fetch(new Request("http://localhost/"), {}, {
  waitUntil() {},
  passThroughOnException() {},
});
if (!res.ok) {
  throw new Error(`Rendering "/" failed with status ${res.status}`);
}
const html = await res.text();
await writeFile(".output/public/index.html", html);
console.log(`Wrote .output/public/index.html (${html.length} bytes)`);
