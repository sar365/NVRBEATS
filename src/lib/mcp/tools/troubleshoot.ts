import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const ANSWERS: Record<string, string> = {
  silence:
    "A silent recording usually means the source app is not feeding the Windows shared audio mix. Set that app to the Windows default playback device and use shared mode (WASAPI/DirectSound); exclusive or direct-driver modes such as ASIO bypass loopback. Check that the input meter moves before recording.",
  no_meters:
    "If the meters never move, confirm audio is playing through the Windows Default Device selected in the dashboard. Check the source app is not using a different endpoint or exclusive mode. Changing the Windows default output while recording may require restarting the capture.",
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
    "Guidance for common NVRBEATS problems: silent recordings, dead meters, dropouts, device changes, crashes, or a missing file.",
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
