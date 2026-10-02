# Windows Build & Real Traktor Test Walkthrough

The desktop build can only run on the user's Windows PC (WASAPI is Windows-only; this sandbox cannot compile the MSVC build or hear Traktor). This plan turns that into a guided, step-by-step document the user follows, with verification and troubleshooting at each stage.

## What gets created

### 1. New guide: `docs/WINDOWS-SETUP.md`

A plain-language walkthrough in four parts:

**Part 1 — One-time setup (about 20 minutes)**
- Install Bun for Windows (or npm/pnpm alternative — note the scripts use `bun`).
- Install Rust via rustup.rs (default options).
- Install Microsoft C++ Build Tools (the "Desktop development with C++" workload) — required for the MSVC linker; explain the build fails without it.
- WebView2 runtime (preinstalled on Windows 11; link to the evergreen installer for Windows 10).
- Clone/copy the project folder to the PC (note: it must be the full project, including `src-tauri/`).

**Part 2 — Build**
- Open a terminal in the project folder.
- `bun install`
- `bun run desktop:dev` — quickest first check: the desktop window opens and shows the dashboard. Use this for the first Traktor test before bothering with an installer.
- `bun run desktop:build` — produces the installer in `src-tauri/target/release/bundle/` (MSI and NSIS `.exe`); note the first build takes 10–30 minutes because it compiles all Rust dependencies.
- Expected failure table: missing C++ tools ("linker link.exe not found"), missing WebView2, stale `node_modules` — each with the fix.

**Part 3 — Traktor configuration (critical)**
- Traktor Pro 4 → Preferences → Audio Setup → set Audio Device to the Windows default output using WASAPI (shared) or DirectSound — **not** exclusive-mode ASIO, which bypasses the loopback tap and yields silence.
- Windows Sound settings: confirm the same device is the system default output.
- Quick sanity check: play a track in Traktor; the app's input meter should move before pressing Record.

**Part 4 — Record a real set (test checklist)**
- Press Record (or `R`), play 5+ minutes.
- Watch input/output meters move and elapsed time/file size grow.
- Close the window mid-set → recording continues; Stop from the system tray.
- Stop → trim dialog → set start/end → save.
- Library shows the recording with real duration, sample rate, file size; play it back; use Export to copy it to another folder; open the folder in Explorer.
- Crash-recovery check: kill the app mid-recording once, relaunch, and confirm the recovery flow repairs the `.part` file.

**Troubleshooting section**
- Meters flat → exclusive ASIO in Traktor, or wrong Windows default device.
- "Device disconnected" error → how to reselect the default output.
- Where the WAV files live (default `Music/DJ Sets`) and where logs are.

### 2. Link from `NATIVE.md`

Replace the short "Build and test on Windows" / "Testing against a real Traktor set" sections with a pointer to the new guide so there is one source of truth.

## Not changed

- No code changes — the engine, adapter wiring, and scripts (`desktop:dev`, `desktop:build`) are already in place and verified as far as this sandbox can verify them.
- I cannot run the build or hear the audio from here; any compile errors that appear only on Windows (MSVC toolchain quirks) get fixed in a follow-up turn when you paste the error.
