import { spawnSync } from "node:child_process";

// Desktop bundles contain the local UI, not the hosted MCP HTTP server.
const env = { ...process.env, DESKTOP_BUILD: "1" };
for (const args of [["run", "build"], ["scripts/make-desktop-index.mjs"]]) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}