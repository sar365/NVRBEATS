import { TriangleAlert } from "lucide-react";
import { isNativeRuntime } from "@/lib/native";

/**
 * Development Mode banner. Visible whenever the native Windows audio engine
 * is not attached. The browser preview cannot perform WASAPI loopback capture.
 */
export function DevModeBanner() {
  if (isNativeRuntime()) return null;

  return (
    <div className="border-b border-warn/30 bg-warn/10">
      <div className="mx-auto flex max-w-5xl items-start gap-2.5 px-4 py-2 text-xs">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" />
        <p className="text-warn">
          <span className="font-semibold">Development Mode</span> — Native Windows Audio Engine:
          Not Connected.{" "}
          <span className="text-warn/80">
            No audio is being captured. Controls simulate UI state only; install the Windows desktop
            build to record real system audio via WASAPI loopback.
          </span>
        </p>
      </div>
    </div>
  );
}
