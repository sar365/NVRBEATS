# Windows Build & System-Audio Test Walkthrough

This guide takes you from a fresh Windows PC to recording audio from any application
that plays through the Windows default output using the native desktop app. Everything happens on your PC — the browser preview
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
against any app — play audio in a browser, media player, or other source for the first recording.

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

## Part 3 — Windows audio routing (critical)

The recorder captures the shared audio mix sent to the **Windows default playback
device**. It is not limited to a particular application: browsers, media players,
games, meeting apps, or DJ software can be captured when routed through that endpoint.

1. In **Windows Settings → System → Sound**, set the speakers, headphones, or
   interface you actually listen through as the **Default output device**.
2. In the source app's audio settings, choose **System Default** or that same output
   using shared-mode **WASAPI** or **DirectSound**.
3. Avoid **exclusive-mode WASAPI**, ASIO, or another direct-driver path for the
   source: those modes can bypass the Windows shared mixer and cannot be captured
   by endpoint loopback. Switch that app to shared/system output if needed.

**Sanity check before recording:** play audio in any source app. NVRBEATS' input
meter should move before you press Record. If the meter stays flat, check that the
app is using the default output shown in NVRBEATS and that Windows volume is not
muted. The recorder cannot capture sound routed to a different endpoint.
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
| Meters flat while audio plays | Source app uses another output or exclusive/direct-driver mode; wrong Windows default device | Redo Part 3 |
| "Device disconnected" error | Default output changed (headphones unplugged, etc.) | Set the default device in Windows Sound settings; the app follows it |
| Recording is silent but meters moved | The source app may be routing to another endpoint or muted bus | Check that app's output routing and master volume |
| Where are my files? | Default location is `Music\DJ Sets` | Settings page shows the recording folder; "Open folder" jumps to it |

If anything else goes wrong, copy the exact error message (or a screenshot) and
paste it back to me — Windows-only build quirks are fixed from there.
