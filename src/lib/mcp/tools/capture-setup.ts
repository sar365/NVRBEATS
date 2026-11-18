import { defineTool } from "@lovable.dev/mcp-js";

const STEPS = [
  "In Windows, set the output you actually listen through (speakers or interface) as the Default Device under Sound settings.",
  "In the app you want to record, choose the Windows default output or that same device in shared mode (WASAPI/DirectSound).",
  "Avoid exclusive-mode or direct-driver output (including ASIO): it bypasses the Windows shared audio mix, so WASAPI loopback cannot capture it.",
  "Open NVRBEATS and play audio in any app routed through that output. The input meter should move before you press Record.",
  "Press Record. You can close the window — the recorder keeps running from the system tray.",
  "Press Stop (in the app or from the tray). The file is finalized as a WAV in your recording folder.",
];

export default defineTool({
  name: "get_capture_setup",
  title: "Get capture setup steps",
  description:
    "Step-by-step setup for recording system audio from any app through the Windows default output using WASAPI loopback.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [
      {
        type: "text" as const,
        text: `Any app -> Windows Audio -> PC Default Output -> WASAPI loopback -> NVRBEATS -> WAV.\n\n${STEPS.map(
          (step, index) => `${index + 1}. ${step}`,
        ).join("\n")}`,
      },
    ],
    structuredContent: { steps: STEPS },
  }),
});
