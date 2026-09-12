import { defineMcp } from "@lovable.dev/mcp-js";
import capabilitiesTool from "./tools/capabilities";
import captureSetupTool from "./tools/capture-setup";
import troubleshootTool from "./tools/troubleshoot";

export default defineMcp({
  name: "traktor-companion",
  title: "Traktor Companion",
  version: "0.1.0",
  instructions:
    "Tools for DJ Set Recorder, a Windows app that records Traktor Pro 4 sets through WASAPI loopback. Use `get_capture_setup` for setup steps, `get_recorder_capabilities` for what the app supports, and `troubleshoot_recording` for common problems. These tools return general product guidance only; recordings and library data stay on the user's own machine.",
  tools: [captureSetupTool, capabilitiesTool, troubleshootTool],
});
