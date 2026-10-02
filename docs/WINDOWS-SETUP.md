# Windows Build & Real Traktor Test Walkthrough

This guide takes you from a fresh Windows PC to recording a real Traktor Pro 4 set
with the native desktop app. Everything happens on your PC — the browser preview
cannot record audio.

---

## Part 1 — One-time setup (about 20 minutes)

You need four things installed once. If you already have some of them, skip ahead.

### 1. Bun (runs the build scripts)

Open **PowerShell** and run:

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Close and reopen PowerShell, then check it works:

```powershell
bun --version
```

### 2. Rust (compiles the audio engine)

1. Download and run the installer from <https://rustup.rs>.
2. Choose the default options (press Enter when asked).
3. Close and reopen PowerShell, then check:

```powershell
cargo --version
```

### 3. Microsoft C++ Build Tools (links the engine)

The build fails without this — the error mentions `link.exe`.

1. Download "Build Tools for Visual Studio" from
   <https://visualstudio.microsoft.com/visual-cpp-build-tools/>.
2. Run it and select the workload **"Desktop development with C++"**.
3. Install (several GB; grab a coffee).

### 4. WebView2 (the app window)

- **Windows 11:** already installed — skip this.
- **Windows 10:** install the "Evergreen Bootstrapper" from
  <https://developer.microsoft.com/microsoft-edge/webview2/>.

### 5. Get the project onto your PC

Copy the **entire project folder** (it must include `src-tauri/`) to your PC, or
clone it with Git if you have it connected. Put it somewhere simple like
`C:\dj-set-recorder`.

---

## Part 2 — Build the app

Open PowerShell **inside the project folder** (right-click the folder →
"Open in Terminal"), then:

```powershell
bun install
```

### First test run (recommended before making an installer)

```powershell
bun run desktop:dev
```

The desktop window opens showing the dashboard. This is the fastest way to test
against Traktor — do your first real recording here.

### Build the installer

```powershell
bun run desktop:build
```

- The **first build takes 10–30 minutes** — it compiles every Rust dependency.
  Later builds take a minute or two.
- When it finishes, the installers are in:

```text
src-tauri\target\release\bundle\
```

Look for the `.msi` and the NSIS `.exe` — either one installs the app like any
normal Windows program.

### If the build fails

| Error you see | Cause | Fix |
| --- | --- | --- |
| `linker link.exe not found` or `MSVC` errors | C++ Build Tools missing | Install Part 1.3, reopen PowerShell, retry |
| WebView2 not found when launching | WebView2 runtime missing | Install Part 1.4 |
| `bun: command not found` | PATH not refreshed | Close and reopen PowerShell |
| Weird module errors after copying the project | Stale `node_modules` | Delete `node_modules`, run `bun install` again |
| Rust compile error you don't recognize | — | Copy the full error text and paste it back to me |

---

## Part 3 — Traktor configuration (critical)

The recorder captures whatever Windows sends to the **default playback device**.
Traktor must use that same path.

1. In **Traktor Pro 4**: Preferences → **Audio Setup** → set **Audio Device** to
   your normal output using **WASAPI (shared)** or **DirectSound**.
2. **Do not use exclusive-mode ASIO.** ASIO bypasses the Windows audio engine,
   so there is nothing for the loopback to capture — the meters stay flat and the
   recording is silent.
3. In **Windows Settings → System → Sound**, confirm the same device is the
   default output.

**Sanity check before recording:** play a track in Traktor. The app's input meter
should move immediately — before you press Record. If it moves, the audio path is
correct.

---

## Part 4 — Record a real set (test checklist)

1. Press **Record** (or the `R` key) and play for at least 5 minutes.
2. Watch the input/output meters move and the elapsed time and file size grow.
3. **Close the window mid-set** — recording continues in the system tray.
4. Open the tray icon and press **Stop** (or reopen the window and press `S`).
5. The trim dialog appears — set start/end points if you want, then save.
6. Open the **Library**: the recording shows its real duration, sample rate, and
   file size. Play it back in the app.
7. Use **Export** to copy it to another folder, then **Open folder** to see the
   WAV in Explorer.
8. **Crash-recovery check:** start a recording, then kill the app from Task
   Manager. Relaunch — the recovery screen offers to repair the unfinished
   `.part` file into a playable WAV.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Meters flat while Traktor plays | Exclusive ASIO in Traktor, or wrong Windows default device | Redo Part 3 |
| "Device disconnected" error | Default output changed (headphones unplugged, etc.) | Set the default device in Windows Sound settings; the app follows it |
| Recording is silent but meters moved | Traktor master volume routed elsewhere | Check Traktor's output routing to the main output |
| Where are my files? | Default location is `Music\DJ Sets` | Settings page shows the recording folder; "Open folder" jumps to it |

If anything else goes wrong, copy the exact error message (or a screenshot) and
paste it back to me — Windows-only build quirks are fixed from there.
