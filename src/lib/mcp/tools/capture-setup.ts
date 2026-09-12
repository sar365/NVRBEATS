import { defineTool } from "@lovable.dev/mcp-js";

const STEPS = [
  "In Windows, set the output you actually listen through (speakers or interface) as the Default Device under Sound settings.",
  "In Traktor Pro 4, open Preferences > Audio Setup and select that same Windows output. Use WASAPI or DirectSound in shared mode.",
  "Avoid exclusive-mode ASIO for the master output: exclusive mode bypasses the Windows mixer, so there is nothing for the recorder to tap.",
  "Open DJ Set Recorder. The input meter moves as soon as Traktor plays, which confirms the capture path.",
  "Press Record. You can close the window — the recorder keeps running from the system tray.",
  "Press Stop (in the app or from the tray). The file is finalized as a WAV in your recording folder.",
];

export default defineTool({
  name: "get_capture_setup",
  title: "Get capture setup steps",
  description:
    "Step-by-step setup for recording a Traktor Pro 4 set through the Windows default output using WASAPI loopback.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [
      {
        type: "text" as const,
        text: `Capture path: Traktor Pro 4 -> Windows Audio -> PC Default Output -> WASAPI loopback -> DJ Set Recorder -> WAV.\n\n${STEPS.map(
          (step, index) => `${index + 1}. ${step}`,
        ).join("\n")}`,
      },
    ],
    structuredContent: { steps: STEPS },
  }),
});
