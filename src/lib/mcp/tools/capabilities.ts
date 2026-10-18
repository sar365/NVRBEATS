import { defineTool } from "@lovable.dev/mcp-js";

const CAPABILITIES = {
  captureMethod: "Windows WASAPI loopback of the PC default output",
  neverUses: ["microphone input", "Web Audio recording", "cloud or server capture"],
  formats: { writtenNatively: ["WAV"], planned: ["FLAC", "MP3", "AAC"] },
  sampleRates: [44100, 48000],
  bitDepths: [16, 24],
  features: [
    "Background recording while the window is closed (system tray)",
    "Crash recovery of an unfinished recording",
    "Sample-accurate trim on the finalized WAV file",
    "Export a copy to any folder",
    "Local recording library with metadata editing",
    "Keyboard shortcuts: R record, S stop, M minimize/restore",
  ],
  recorderStates: [
    "READY",
    "STARTING",
    "RECORDING",
    "STOPPING",
    "FINALIZING",
    "COMPLETED",
    "ERROR",
    "RECOVERY_AVAILABLE",
    "DEVICE_DISCONNECTED",
  ],
  storage: "Local only — recordings and metadata stay on the user's own machine.",
};

export default defineTool({
  name: "get_recorder_capabilities",
  title: "Get recorder capabilities",
  description:
    "What NVRBEATS can do: capture method, supported formats and rates, features, and recorder states.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text" as const, text: JSON.stringify(CAPABILITIES, null, 2) }],
    structuredContent: CAPABILITIES,
  }),
});
