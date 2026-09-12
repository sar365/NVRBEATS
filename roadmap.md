# Roadmap

## In progress
- [ ] Native Windows engine (Rust/Tauri): WASAPI loopback, WAV writing, tray, background recording
- [ ] Connect native commands to the app: startRecording, stopRecording, getRecordingStatus, getAudioLevels, getRecordingPath
- [ ] Move trim + export into the native engine (real WAV file)
- [ ] Real browser audio capture for preview meters (before the Windows engine exists)

## Next
- [ ] Add agent integrations (MCP server) to this app — public tools chosen; sign-in protection would require adding user accounts first

## Needs the user's Windows machine
- [ ] Build the desktop app and test against a real Traktor set
