import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function verifyInstallers(bundleDir) {
  const formats = [
    { dir: "msi", extension: ".msi", signature: Buffer.from("d0cf11e0a1b11ae1", "hex") },
    { dir: "nsis", extension: ".exe", signature: Buffer.from("MZ") },
  ];
  const verified = [];
  for (const format of formats) {
    const folder = resolve(bundleDir, format.dir);
    const entries = await readdir(folder);
    const files = entries.filter((name) => name.toLowerCase().endsWith(format.extension));
    if (!files.length) throw new Error(`No ${format.extension} installer found in ${folder}`);
    for (const name of files) {
      const file = resolve(folder, name);
      const bytes = await readFile(file);
      if (bytes.length < 1024 || !bytes.subarray(0, format.signature.length).equals(format.signature)) {
        throw new Error(`Invalid or truncated ${format.extension} installer: ${file}`);
      }
      verified.push(file);
    }
  }
  return verified;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const files = await verifyInstallers(resolve("src-tauri/target/release/bundle"));
  console.log("Verified installer file headers (installation testing still required):\n" + files.join("\n"));
}