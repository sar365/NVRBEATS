import { test, expect } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyInstallers } from "./verify-windows-installers.mjs";

async function withBundle(run) {
  const root = await mkdtemp(join(tmpdir(), "dj-installers-"));
  try {
    await mkdir(join(root, "msi"));
    await mkdir(join(root, "nsis"));
    const msi = Buffer.alloc(2048);
    Buffer.from("d0cf11e0a1b11ae1", "hex").copy(msi);
    const exe = Buffer.alloc(2048);
    exe.write("MZ");
    await writeFile(join(root, "msi", "recorder.msi"), msi);
    await writeFile(join(root, "nsis", "recorder.exe"), exe);
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("release requires both MSI and EXE installer headers", async () => {
  await withBundle(async (root) => {
    expect((await verifyInstallers(root)).length).toBe(2);
  });
});

test("missing EXE prevents release", async () => {
  await withBundle(async (root) => {
    await rm(join(root, "nsis", "recorder.exe"));
    await expect(verifyInstallers(root)).rejects.toThrow("No .exe installer");
  });
});

test("invalid MSI prevents release", async () => {
  await withBundle(async (root) => {
    await writeFile(join(root, "msi", "recorder.msi"), Buffer.alloc(2048));
    await expect(verifyInstallers(root)).rejects.toThrow("Invalid or truncated .msi");
  });
});

test("truncated EXE prevents release", async () => {
  await withBundle(async (root) => {
    await writeFile(join(root, "nsis", "recorder.exe"), "MZ");
    await expect(verifyInstallers(root)).rejects.toThrow("Invalid or truncated .exe");
  });
});