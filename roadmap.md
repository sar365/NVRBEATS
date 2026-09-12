# Roadmap

## Done
- [x] Native Windows engine (Rust/Tauri): WASAPI loopback, WAV writing, tray, background recording
- [x] Connect native commands to the app: start, stop, status, levels, path, settings sync
- [x] Trim + export run in the native engine on the real WAV file
- [x] Real browser audio capture for preview meters
- [x] Agent integrations (MCP): public tools for setup, capabilities, troubleshooting

## Needs the user's Windows machine
- [ ] Build the desktop app and test against a real Traktor set (see NATIVE.md)

## Possible next
- [ ] Sign-in protected agent tools (requires adding user accounts first)
- [ ] FLAC/MP3/AAC conversion in the native engine (bundled local FFmpeg)
