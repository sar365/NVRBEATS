import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const ANSWERS: Record<string, string> = {
  silence:
    "A silent recording almost always means Traktor is not going through the Windows mixer. Switch Traktor's audio device away from exclusive-mode ASIO to the Windows default output (WASAPI/DirectSound shared). Then check that the input meter moves before you press Record.",
  no_meters:
    "If the meters never move: confirm Windows is actually playing through the device set as Default Device, and that the recorder was started after Traktor. Changing the Windows default output while recording can also stop the tap — check the device panel on the dashboard.",
  crackles:
    "Dropouts usually come from a too-small buffer or a busy disk. Raise the buffer in Settings > Advanced, record to a local drive rather than a network or USB drive, and keep a few GB of free space.",
  device_changed:
    "Plugging in headphones or a controller can change the Windows default output mid-set. Set the device-change behaviour in Settings so the recorder either keeps going, follows the new device, or stops cleanly.",
  crash:
    "If the app or PC crashed mid-set, the unfinished file is still on disk. Reopen the app: the recovery flow offers to repair it into a playable WAV, leave it untouched, or delete it.",
  file_missing:
    "Recordings are written to the folder set in Settings. Use Open folder from the library entry to jump straight to the file; an unfinished recording appears with a .part extension until it is finalized or repaired.",
};

export default defineTool({
  name: "troubleshoot_recording",
  title: "Troubleshoot a recording problem",
  description:
    "Guidance for common DJ Set Recorder problems: silent recordings, dead meters, dropouts, device changes, crashes, or a missing file.",
  inputSchema: {
    symptom: z
      .enum(["silence", "no_meters", "crackles", "device_changed", "crash", "file_missing"])
      .describe("The problem the user is seeing."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ symptom }) => ({
    content: [{ type: "text" as const, text: ANSWERS[symptom] ?? "No guidance for that symptom." }],
  }),
});
