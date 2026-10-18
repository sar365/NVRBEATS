# Roadmap

## Current
- [ ] Diagnose the failed GitHub Windows build and fix installer release publishing

## Done
- [x] Native Windows engine (Rust/Tauri): WASAPI loopback, WAV writing, tray, background recording
- [x] Connect native commands to the app: start, stop, status, levels, path, settings sync
- [x] Trim + export run in the native engine on the real WAV file
- [x] Real browser audio capture for preview meters
- [x] Agent integrations (MCP): sign-in required (email/password + Google), consent screen, three tools
- [x] Desktop build fixes: static start page for the desktop window, RGBA icons, missing `disk` module, wasapi API call — host and Windows-target `cargo check` both clean

## Needs the user's Windows machine
- [ ] Run `bun run desktop:build` and test against a real Traktor set (see NATIVE.md)


## Possible next
- [ ] FLAC/MP3/AAC conversion in the native engine (bundled local FFmpeg)
