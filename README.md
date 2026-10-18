# NVRBEATS

A lightweight Windows desktop recorder for Traktor Pro 4.

NVRBEATS is designed for users running Native Instruments Traktor Pro 4 and listening through their computer's normal Windows audio output.

CRITICAL: DO NOT BUILD THIS AS A PURE WEB AUDIO RECORDER

The defining technical requirement is capturing the Windows PC Default Audio Output digitally using Windows WASAPI loopback.

The intended audio path is:

Traktor Pro 4 → Windows Audio → PC Default Output → WASAPI Loopback → Local Recorder → WAV

Do not use:

Microphone capture

Browser MediaRecorder

Web Audio API as the recording engine

Screen recording

OBS

Virtual microphone routing

Cloud audio recording

Server-side audio capture

The finished product must ultimately run as a Windows desktop application.

Lovable should build the application interface, data model, settings, recording-library experience, and native-bridge architecture, while clearly separating anything that must be implemented in native Windows code.

Do not waste credits pretending that browser JavaScript can perform native WASAPI loopback capture.

1. PRODUCT GOAL

The user's workflow should be:

Open NVRBEATS.

See the current Windows PC Default Output.

Press RECORD.

Minimize the application.

DJ normally in Traktor Pro 4.

Traktor continues sending audio to the Windows default speakers/headphones.

The native Windows recording component captures that digital output using WASAPI loopback.

Recording continues in the background.

User returns to the application.

Presses STOP.

The recording is finalized and saved locally.

The finished set appears in the recording library.

The application must require no microphone and no physical audio cable.

2. IMPORTANT LOVABLE SCOPE

Lovable should NOT attempt to fake native Windows functionality.

Build the project in a way that clearly separates:

Frontend/UI

Lovable should build:

Dashboard

Record screen

Recording status

Timer

Stereo meters UI

Recording library

Recording details

Metadata editor

Settings

File-management interface

Notifications

Dark DJ interface

Native Windows layer

Mark these as requiring native implementation:

WASAPI loopback capture

Windows default-output detection

system-tray integration

background recording

local PCM/WAV writing

Windows audio-device monitoring

crash recovery

native filesystem access where required

Tauri/native commands

Do NOT create fake browser implementations for these features.

Instead, create a clean Native Audio Bridge interface that the eventual Tauri/native Windows component will implement.

3. NATIVE AUDIO BRIDGE

Create a clearly separated abstraction such as:

NativeAudioBridge

It should expose the following conceptual functions:

getDefaultOutputDevice()
getAvailableOutputDevices()
startRecording()
stopRecording()
getRecordingStatus()
getRecordingDuration()
getRecordingFileSize()
getAudioLevels()
getRecordingPath()
recoverIncompleteRecording()
getDeviceStatus()

The Lovable frontend should communicate with this abstraction.

For the initial web-development environment, create a clearly labeled Development Mock Adapter only so the UI can be previewed.

Do NOT pretend the mock adapter records real audio.

Clearly label it:

Development Mode — Native Windows Audio Engine Required

4. MAIN DASHBOARD

Create a polished dark interface designed for DJs.

Application name:

NVRBEATS

Subtitle:

Record What You Hear

Main dashboard:

NVRBEATS

PC DEFAULT OUTPUT

Speakers (Realtek(R) Audio)

L █████████████
R █████████████

READY

        ● RECORD

When recording:

RECORDING

PC DEFAULT OUTPUT

Speakers (Realtek(R) Audio)

L █████████████
R █████████████

01:37:42

WAV • 48 kHz • 24-bit

        ■ STOP

Keep the design clean and professional.

Avoid unnecessary animations.

Do not build waveform visualizations.

Do not build spectrum analyzers.

The application is a recording utility, not a visualizer.

5. RECORDING SOURCE

Display:

Recording Source

PC Default Output

Then display the actual detected Windows device:

Speakers (Realtek(R) Audio)

The UI should make it extremely clear that the application is recording the computer's playback output.

Include an information tooltip:

Record What You Hear

Records the digital audio being sent to your Windows default playback device. No microphone or additional cables are required.

6. RECORD BUTTON

Create one very obvious primary control.

Ready:

● RECORD

Recording:

■ STOP

Do not bury the recording controls in menus.

When Record is clicked:

request the native recording engine to start

change UI state to RECORDING

start timer

display recording source

display recording format

display audio meters

When Stop is clicked:

request native engine to stop

show finalization state

wait for confirmation that the file is safely written

display Recording Complete

7. RECORDING STATES

Implement a clear state machine.

States:

READY
STARTING
RECORDING
STOPPING
FINALIZING
COMPLETED
ERROR
RECOVERY_AVAILABLE
DEVICE_DISCONNECTED

The UI must react appropriately to each state.

Never show "Recording" unless the native layer confirms recording has actually started.

8. RECORDING TIMER

Show elapsed time:

00:00:00

Update efficiently.

The timer should be UI-only.

The authoritative recording duration must come from the native recorder.

9. AUDIO LEVEL METERS

Create lightweight stereo meters:

L

R

The native layer should eventually provide level information.

For the Lovable preview, use mock levels.

Clearly separate:

Development Mock Audio Levels

from real native audio levels.

The UI should update approximately 10–20 times per second.

Do not process individual audio samples in the frontend.

10. RECORDING FORMAT UI

Default:

WAV

Display:

WAV • 48 kHz • 24-bit

Settings should allow:

44.1 kHz

48 kHz

16-bit

24-bit

The native recorder will ultimately be responsible for implementing these settings.

Do not implement browser-side WAV encoding.

11. LOW-CPU DESIGN

The application must be designed around extremely low CPU usage while Traktor is running.

The frontend must not:

process audio

encode audio

render waveforms

perform DSP

analyze the complete recording

upload audio

continuously poll at high frequency

The native recorder should use:

WASAPI capture
↓
bounded audio buffer
↓
asynchronous disk writer
↓
WAV

The UI only receives lightweight status information.

12. BACKGROUND RECORDING

The architecture must support:

Minimize to System Tray

The recording continues when:

application is minimized

Traktor is focused

another application is focused

main window is hidden

This functionality requires the eventual native Windows/Tauri implementation.

Do not fake system-tray functionality in the browser.

Create the UI state and native bridge contract now.

13. RECORDING LIBRARY

Create a local-first recording library interface.

Each recording should contain:

filename

set name

artist

date

duration

file size

format

genre

location

notes

tags

artwork

local file path

Interface:

My DJ Sets

Search bar:

Search recordings...

Filters:

All

Recent

Longest

Shortest

WAV

FLAC

MP3

Each recording should have:

Play

Edit

Open Folder

Delete

14. RECORDING DETAILS

Create a detailed recording page.

Display:

Set Information

Artist

Set Name

Date

Genre

Location

Tags

Notes

Artwork

File Information

Format

Sample Rate

Bit Depth

Duration

File Size

File Location

Buttons:

Play

Edit

Open Folder

Convert

15. LOCAL DATABASE

Design the application around a local SQLite database.

Store metadata such as:

id
filename
filepath
artist
set_name
date
duration
format
sample_rate
bit_depth
file_size
genre
location
notes
tags
artwork_path
created_at
updated_at

Do not require a cloud database for the core recorder.

Do not require user accounts.

16. FILE STORAGE

The actual audio recordings should remain on the user's computer.

Default folder:

Music/DJ Sets

Allow users to choose a different folder.

The native Windows layer will ultimately handle file access.

The Lovable frontend should display:

Recording Folder

Music/DJ Sets

Button:

Choose Folder

17. CRASH RECOVERY UI

Design support for incomplete recordings.

If the native layer reports:

RECOVERY_AVAILABLE

display:

Incomplete Recording Found

An unfinished DJ recording was detected.

Buttons:

Recover Recording

Delete

Open Folder

Never automatically delete incomplete recordings.

18. DEFAULT OUTPUT DEVICE UI

Create a device status component.

Example:

PC DEFAULT OUTPUT

Speakers (Realtek(R) Audio)

Status:

CONNECTED

If unavailable:

DISCONNECTED

If Windows changes the default output during recording:

show:

Audio Output Changed

Windows changed your default playback device.

Show:

Previous: Speakers

New: Headphones

The native layer will handle the actual device behavior.

19. AUTO RECORD

Add an optional feature:

Auto Record

Default:

OFF

Settings:

Enable Auto Record

Start Threshold

Stop After Silence

Minimum Recording Length

The frontend should expose the settings.

The native audio engine will eventually implement the actual signal detection.

Do not attempt to perform audio detection in browser JavaScript.

20. SETTINGS

Create a Settings page with:

Recording

Recording format

Sample rate

Bit depth

Recording folder

Filename template

Audio

PC Default Output

Follow Windows Default Output

Device-change behavior

Auto Record

Enable

Start threshold

Silence duration

Appearance

Dark mode

Light mode

Minimize to tray

Startup

Start with Windows

Advanced

Buffer size

Recovery settings

Diagnostic logging

21. FILE NAMING

Default:

DJ Set - YYYY-MM-DD - HH-mm-ss.wav

Allow:

{artist} - {setname} - {date}.wav

Supported variables:

date

time

artist

setname

genre

location

22. POST-RECORDING CONVERSION

Design the interface for optional local conversion:

WAV

FLAC

MP3

AAC/M4A

The frontend should provide:

Convert Recording

Then:

Format

Quality

Start Conversion

The actual conversion should eventually be performed locally using FFmpeg/native code.

Do not send recordings to a cloud service.

23. LOCAL PLAYBACK

Create a basic player interface.

Controls:

Play

Pause

Seek

Volume

Duration

Previous

Next

The native desktop implementation should ultimately use a local audio playback mechanism.

The browser preview can use mock/sample audio only.

24. PRIVACY

The core application should work without:

account

cloud storage

cloud database

analytics

telemetry

audio uploads

microphone

The user's recordings remain local.

25. ERROR STATES

Create polished error components for:

No audio device

No Windows playback device detected.

Device disconnected

Your recording output device was disconnected.

Disk full

There isn't enough storage space to continue recording.

Native engine unavailable

The Windows audio engine is not connected.

Secondary text:

The web preview cannot access WASAPI. Install/run the Windows desktop version to record real system audio.

Recording failure

Audio recording could not be started.

Do not silently fail.

26. DEVELOPMENT MODE

Because Lovable cannot directly perform Windows WASAPI capture inside a browser preview, create a clearly isolated development mode.

At the top or in Settings:

Development Mode

Native Windows Audio Engine: Not Connected

Provide:

Simulate Recording

This should only allow testing:

UI

timer

state transitions

library

metadata

settings

error states

It must never imply that real Traktor audio is being captured.

When the native Windows application is connected, replace the mock adapter with the real adapter.

27. NATIVE BRIDGE CONTRACT

Create a clearly documented interface between the frontend and native application.

Conceptually:

NativeAudioBridge

getDefaultOutputDevice()

getOutputDevices()

startRecording(settings)

stopRecording()

getRecordingStatus()

getRecordingDuration()

getRecordingFileSize()

getAudioLevels()

getCurrentOutputDevice()

getDiskSpace()

recoverRecording()

openRecordingFolder()

playRecording()

convertRecording()

Use clean typed interfaces.

Keep the frontend independent from the native implementation.

28. Tauri INTEGRATION

Structure the application so it can eventually be packaged using Tauri.

The native Tauri layer should eventually provide:

Windows system-tray

native filesystem access

WASAPI integration

native audio capture

background operation

Windows notifications

startup behavior

FFmpeg/native conversion

native playback

Do not attempt to implement those features as fake browser functionality.

29. TRAKTOR COMPATIBILITY

The application should NOT attempt to control Traktor.

Do not interact with:

Traktor decks

Traktor mixer

Traktor effects

Traktor volume

Traktor playback

Traktor configuration

The recorder is completely independent.

It simply records what Windows is sending to the default playback device.

30. AI FEATURES

Do not add AI features to the first version.

Do not integrate OpenRouter yet.

AI is not required for recording.

Do not waste Lovable credits implementing:

AI chat

AI set analysis

AI track identification

AI social posts

AI recommendations

Those can be added later.

The first priority is:

Reliable recording.

31. NO UNNECESSARY SERVICES

Do not add:

Supabase unless genuinely required

Firebase

authentication

Stripe

cloud storage

analytics

OpenRouter

external audio APIs

The initial version should be as local and inexpensive as possible.

32. IMPLEMENTATION ORDER

Build only what Lovable can genuinely implement first.

Phase 1 — UI

Build:

dashboard

Record/Stop

timer

source display

level meters

settings

library

recording details

Phase 2 — State architecture

Implement:

READY

STARTING

RECORDING

STOPPING

FINALIZING

COMPLETED

ERROR

RECOVERY_AVAILABLE

DEVICE_DISCONNECTED

Phase 3 — Native bridge

Create the typed native bridge interface.

Implement a development mock adapter for browser preview.

Clearly label it as a mock.

Phase 4 — Tauri/native implementation

This is where the actual Windows-specific code must be added:

WASAPI loopback

default output detection

WAV recording

background operation

system tray

local file handling

Phase 5 — Testing

Test the native Windows implementation with actual Traktor Pro 4.

33. DO NOT WASTE CREDITS

Before implementing anything, follow these rules:

Do not build fake WASAPI functionality.

Do not build microphone recording.

Do not build browser-based system-audio capture and call it complete.

Do not add authentication.

Do not add cloud storage.

Do not add AI.

Do not add payments.

Do not add social features.

Do not add unnecessary APIs.

Do not spend development effort on features that are impossible inside Lovable's browser environment.

If a feature requires native Windows access, create the correct interface and clearly mark the native implementation boundary.

34. FINAL TARGET ARCHITECTURE

The finished application should ultimately look like:

              TRAKTOR PRO 4
                     │
                     ▼
          WINDOWS AUDIO ENGINE
                     │
                     ▼
          PC DEFAULT OUTPUT
                     │
                     ▼
            WASAPI LOOPBACK
                     │
                     ▼
          NATIVE WINDOWS ENGINE
                     │
                     ▼
                  WAV
                     │
                     ▼
             LOCAL LIBRARY
                     │
                     ▼
               LOVABLE UI

The Lovable frontend is the control center.

The native Windows component is the actual recorder.

35. DEFINITION OF SUCCESS

The first usable version is successful when the Windows desktop build can do this:

Detect the Windows PC Default Output.

Display it in the application.

Start native WASAPI loopback capture.

Record Traktor Pro 4's audio.

Continue recording while minimized.

Write audio continuously to a local WAV file.

Stop safely.

Finalize the WAV.

Display the recording in the library.

Play the recording back.

Recover an incomplete recording after a crash.

The browser preview does NOT need to perform real WASAPI recording.

It only needs to demonstrate the UI and native-bridge architecture.

Do not claim the application is production-ready until the native Windows WASAPI component has been tested against actual Traktor Pro 4 audio.

Start by building the UI, state machine, local-first data model, and NativeAudioBridge interface only. Keep the native Windows/WASAPI boundary explicit so that no Lovable credits are wasted trying to implement functionality that requires a native Windows environment.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4c8d4f3b-99a9-4a05-8242-9ebfd429891f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
