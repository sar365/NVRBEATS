# Presentation Script: Unified Offline Configuration for NVRBEATS

**Audience:** product, engineering, and user-support stakeholders
**Length:** approximately 5 minutes
**Purpose:** explain the configuration architecture, current implementation, and safe rollout.

## 1. Opening — one settings source, on the user's PC

“Today I’m proposing a unified configuration system for NVRBEATS. The goal is straightforward: a user sets up audio capture once, and those preferences are available to the app, the native recorder, and recordings started from the system tray—even when the PC is offline.

“This is a local desktop configuration, not a cloud account. The native application owns the saved file, while the interface becomes a way to view and change it.”

## 2. The problem we are solving

“Right now, the interface stores preferences in WebView local storage, but the Rust side initializes its own defaults and only keeps the settings it receives in memory. This creates two sources of truth. It can also produce inconsistent behavior after restart or when recording is started outside the main window.

“We have another important product issue: the UI currently exposes choices such as AAC, MP3, and FLAC, while the native capture path writes WAV and conversion is not implemented yet. A preference should never promise behavior the engine cannot deliver.”

## 3. The unified model

“The new configuration separates concerns into clear sections:

- **Capture:** device policy, container, sample rate, bit depth, channel count, buffer preference, and behavior when the output device changes.
- **Recording:** local destination, filename template, and optional auto-record thresholds.
- **App:** theme, tray behavior, and launch-at-login preference.
- **Recovery and diagnostics:** whether incomplete recordings are retained and whether diagnostic logging is enabled.
- **Profile and schema version:** a readable profile name and a version number for future migrations.

“The data is local JSON under the current user's application-data folder. The format is versioned so future releases can migrate it deliberately.”

## 4. Ownership, saving, and recovery

“Rust owns the canonical configuration. On launch, it loads the primary file, validates it, and can recover from a last-known-good backup. Saves are written to a temporary file and flushed before replacing the main file; the previous valid file is retained as a backup.

“If a newer app version has written a schema this build does not understand, this build refuses to overwrite it. That protects user preferences during downgrade or rollback. If a file is invalid, the app can start with defaults while keeping the original file available for diagnosis.”

## 5. Validation and honest settings

“Validation happens in the native layer, not only in form controls. It checks supported sample rates and bit depths, stereo-only capture, valid buffer ranges, device IDs where required, filename safety, and sensible auto-record limits. Unsupported formats are rejected rather than silently recorded as WAV.

“Just as importantly, we should distinguish a saved preference from an effective runtime feature. The schema can preserve a buffer preference, for example, but we should not describe it as affecting capture until the engine actually uses it. The same applies to selecting a specific endpoint, auto-record behavior, startup registration, and compressed formats.”

## 6. Offline behavior and user control

“All configuration reads and writes happen locally. The design requires no sign-in, telemetry, or network request to open settings or save a profile. Recording files remain in the user's chosen folder. Import/export can be added as an explicit user action, allowing a person to back up or move a profile without automatic cloud synchronization.”

## 7. Rollout plan

“Rollout is staged to reduce risk:

1. Land the versioned Rust config types, validation, local persistence, backup recovery, and unit tests.
2. Add native get/save commands and temporarily translate the existing UI payload into the unified schema so current behavior continues to work.
3. Migrate the UI from local storage to those commands, including a one-time import of existing settings and a clear conflict rule.
4. Disable or label settings that do not yet have real native behavior; implement and test each feature before presenting it as active.
5. Test offline launch, persistence after restart, tray-started recording, device changes, invalid-config recovery, and actual WAV recordings on supported Windows builds.

“Each release should preserve a recoverable config backup, report unsupported settings clearly, and pass a real Windows audio test before we call the feature complete.”

## 8. Close

“The result is one understandable set of local preferences with a clear owner, safe validation, recovery, and no online dependency. It gives users room to customize their setup while keeping a firm line between options that are merely stored and features that are genuinely implemented.

“The implementation is a foundation—not a claim that every existing settings control already works. The next milestone is migrating the interface and connecting each supported preference to observable native behavior.”

## Presenter notes

- Current supported capture evidence is WASAPI loopback with stereo WAV writing. The current Rust writer handles 16- or 24-bit integer WAV output and sample-rate choices of 44.1 or 48 kHz.
- The source currently opens the Windows default output endpoint. A persisted specific-device preference is not yet wired to endpoint selection.
- The UI currently offers compressed formats even though the native conversion command reports that conversion is unavailable. The implementation should reject those values until support lands.
- The existing UI still reads WebView local storage. The compatibility `set_settings` command can persist the current UI settings while the frontend migration is completed; the new unified `get_unified_config` and `save_unified_config` commands provide the intended API.
- Before a public release, test the packaged Windows build on clean standard-user accounts, including offline startup and audio capture. Do not treat unit tests or a successful installer build as proof of recording quality.
