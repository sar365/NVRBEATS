# Native Windows Boundary

This repository contains the **control center UI** for DJ Set Recorder. It does not,
and must not, record audio in the browser. All capture happens in the native Windows
build (Rust + Tauri).

## Audio path

```text
TRAKTOR PRO 4 -> WINDOWS AUDIO ENGINE -> PC DEFAULT OUTPUT -> WASAPI LOOPBACK
  -> NATIVE WINDOWS ENGINE -> WAV -> LOCAL LIBRARY (SQLite) -> THIS UI
```

No microphone, no MediaRecorder, no Web Audio, no screen capture, no virtual cable,
no cloud, no server-side capture.

## Frontend contract

`src/lib/native/bridge.ts` defines `NativeAudioBridge`. Adapters:

- `src/lib/native/mock-adapter.ts` — Development Mock Adapter. Preview only, never records.
- `src/lib/native/tauri-adapter.ts` — maps each method to a Tauri command (see TODO list in file).
- `src/lib/native/index.ts` — selects the adapter by detecting the Tauri runtime.

## Must be implemented natively

| Area | Requirement |
| --- | --- |
| Capture | WASAPI loopback on the default render endpoint (`eRender`, `eConsole`) |
| Device | Default-output detection + `IMMNotificationClient` change monitoring |
| Pipeline | Capture thread -> bounded ring buffer -> async disk writer -> WAV |
| Format | 44.1/48 kHz, 16/24-bit, stereo; RIFF header patched on stop + fsync |
| Levels | Peak L/R computed on the capture thread, polled by the UI at ~15 Hz |
| Background | Recording continues while minimized, hidden, or with Traktor focused |
| Tray | System-tray icon, record/stop, restore window, Windows notifications |
| Recovery | `.part` files are never auto-deleted; repair into a playable WAV on request |
| Storage | Local SQLite `recordings` table; audio files under `Music/DJ Sets` by default |
| Files | Folder picker, open in Explorer, delete to Recycle Bin |
| Conversion | Bundled FFmpeg, local only (WAV/FLAC/MP3/AAC) |
| Playback | Native audio playback for library items |
| Auto record | Signal-threshold start / silence stop, evaluated in the capture thread |

## Low-CPU rules

The frontend never processes samples, encodes audio, renders waveforms, runs DSP,
or uploads anything. It polls lightweight status at ~5 Hz and meters at ~15 Hz, and
only while recording.

## Traktor

The recorder never controls or inspects Traktor. It only records what Windows sends
to the default playback device.

## The native engine is now implemented (`src-tauri/`)

| File | Responsibility |
| --- | --- |
| `src/capture.rs` | WASAPI loopback capture of the Windows default output, always-on peak meters, bounded queue, background WAV writer thread writing `<name>.part` |
| `src/wav.rs` | Sample-accurate trim of the real WAV file, export (copy) to a chosen folder, crash-recovery repair of a `.part` file |
| `src/devices.rs` | Default-output detection and endpoint enumeration |
| `src/disk.rs` | Free/total space on the recording volume |
| `src/tray.rs` | System tray: start, stop, reopen the window, quit — recording continues while the window is closed |
| `src/commands.rs` | The exact command surface the frontend `NativeAudioBridge` calls |
| `src/lib.rs` | App setup, state machine wiring, crash-recovery scan on launch, close-to-tray |

### Build and test on Windows

See **[docs/WINDOWS-SETUP.md](docs/WINDOWS-SETUP.md)** for the full walkthrough:
one-time setup (Bun, Rust, C++ Build Tools, WebView2), `bun run desktop:dev` /
`bun run desktop:build`, Traktor audio configuration, the real-set test checklist,
and troubleshooting.

Verified in CI-style checks on Linux: `cargo check` for the host target and
`cargo check --target x86_64-pc-windows-gnu` (which type-checks the WASAPI
loopback code) both pass, and the static `dist/client/index.html` hydrates with
no console errors. The final MSVC build and the real Traktor run must happen on
the Windows machine.
