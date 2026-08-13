- DJ Set Recorder — UI, State Machine & Native Bridge

Build the control-center frontend for a Windows desktop recorder. All real audio work (WASAPI loopback, tray, disk writing) stays behind an explicit native boundary — no browser audio capture, no cloud, no auth, no AI.

## What gets built now

**Dashboard (/)** — Dark, utilitarian DJ interface. "DJ SET RECORDER / Record What You Hear". Shows PC DEFAULT OUTPUT with the detected device name and CONNECTED/DISCONNECTED status, stereo L/R level meters, big single RECORD / STOP control, elapsed timer, and format line (`WAV • 48 kHz • 24-bit`) while recording. Info tooltip explaining "Record What You Hear". No waveforms, no spectrum analyzer, minimal motion.

**Library (/library)** — "My DJ Sets" list with search and filters (All, Recent, Longest, Shortest, WAV, FLAC, MP3). Each row: artwork, set name, artist, date, duration, size, format, and Play / Edit / Open Folder / Delete actions.

**Recording detail (/library/$id)** — Set Information (artist, set name, date, genre, location, tags, notes, artwork) and File Information (format, sample rate, bit depth, duration, size, path). Buttons: Play, Edit, Open Folder, Convert. Metadata editor dialog. Convert dialog (format + quality + Start Conversion) that calls the bridge.

**Player** — Persistent bottom bar: play/pause, seek, volume, duration, previous/next. Preview uses a mock/sample source only.

**Settings (/settings)** — Recording (format, sample rate 44.1/48, bit depth 16/24, recording folder + Choose Folder, filename template with `{date} {time} {artist} {setname} {genre} {location}`), Audio (default output, follow Windows default, device-change behavior), Auto Record (off by default: enable, start threshold, silence duration, minimum length), Appearance (dark/light, minimize to tray), Startup (start with Windows), Advanced (buffer size, recovery, diagnostic logging).

**States & errors** — State machine: READY, STARTING, RECORDING, STOPPING, FINALIZING, COMPLETED, ERROR, RECOVERY_AVAILABLE, DEVICE_DISCONNECTED. RECORDING is only shown after the bridge confirms it. Polished error panels for no device, device disconnected, disk full, native engine unavailable ("The web preview cannot access WASAPI…"), and recording failure. Device-changed banner showing previous vs new output. Crash-recovery panel: "Incomplete Recording Found" with Recover / Delete / Open Folder — never auto-deletes.

**Development mode** — Persistent labeled banner: "Development Mode — Native Windows Audio Engine: Not Connected", with a Simulate Recording toggle. Mock levels are labeled "Development Mock Audio Levels". Nothing implies real capture.

## Technical section

- `src/lib/native/bridge.ts` — typed `NativeAudioBridge` interface: `getDefaultOutputDevice`, `getOutputDevices`, `startRecording(settings)`, `stopRecording`, `getRecordingStatus`, `getRecordingDuration`, `getRecordingFileSize`, `getAudioLevels`, `getCurrentOutputDevice`, `getDiskSpace`, `recoverRecording`, `openRecordingFolder`, `playRecording`, `convertRecording`, plus device/status event subscriptions. Shared domain types (`RecorderState`, `RecordingSettings`, `AudioLevels`, `OutputDevice`, `RecordingMeta`) live in `src/lib/native/types.ts`.
- `src/lib/native/mock-adapter.ts` — clearly commented development-only adapter. `src/lib/native/tauri-adapter.ts` — thin stub mapping each method to a future Tauri `invoke` command, with a TODO header listing the required Rust commands. `src/lib/native/index.ts` picks the adapter by detecting `window.__TAURI__`.
- Recording state lives in a `useRecorder` hook: polls bridge status ~5 Hz and levels ~15 Hz, timer is UI-only, authoritative duration comes from the bridge. No audio samples touched in the frontend.
- Local data model mirrors the SQLite schema (`id, filename, filepath, artist, set_name, date, duration, format, sample_rate, bit_depth, file_size, genre, location, notes, tags, artwork_path, created_at, updated_at`). A `RecordingRepository` interface has a browser localStorage implementation for preview and a documented SQLite-backed native implementation slot. Settings persist the same way.
- Design system: dark-first tokens in `src/styles.css` (near-black surfaces, one accent for record/armed states, condensed technical type, tabular-nums timer). No hardcoded color utilities.
- TanStack routes: `/`, `/library`, `/library/$id`, `/settings`, each with its own `head()` metadata.
- `NATIVE.md` documents the native boundary: WASAPI loopback, default-output detection/monitoring, bounded buffer + async WAV writer, tray, background operation, crash recovery, FFmpeg conversion, native playback.

## Not in scope

No Lovable Cloud, auth, analytics, AI, payments, browser audio capture, or WAV encoding in JS. Phase 4 (Rust/Tauri WASAPI implementation) and Phase 5 (Traktor testing) happen outside Lovable.