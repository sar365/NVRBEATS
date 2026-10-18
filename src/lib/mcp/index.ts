import { auth, defineMcp } from "@lovable.dev/mcp-js";
import capabilitiesTool from "./tools/capabilities";
import captureSetupTool from "./tools/capture-setup";
import troubleshootTool from "./tools/troubleshoot";

// Must be the direct auth host: the published build rewrites SUPABASE_URL to a
// proxy that fails the OAuth issuer check. Vite inlines this literal at build time.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "traktor-companion",
  title: "Traktor Companion",
  version: "0.1.0",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  instructions:
    "Tools for NVRBEATS, a Windows app that records Traktor Pro 4 sets through WASAPI loopback. Use `get_capture_setup` for setup steps, `get_recorder_capabilities` for what the app supports, and `troubleshoot_recording` for common problems. These tools return general product guidance only; recordings and library data stay on the user's own machine.",
  tools: [captureSetupTool, capabilitiesTool, troubleshootTool],
});
