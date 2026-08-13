import { Info, Speaker } from "lucide-react";
import type { OutputDevice } from "@/lib/native/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function DeviceStatus({ device }: { device: OutputDevice | null }) {
  const connected = device?.status === "CONNECTED";
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-1.5">
          <span className="label-caps">PC Default Output</span>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger aria-label="About Record What You Hear">
                <Info className="size-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-64">
                <p className="font-semibold">Record What You Hear</p>
                <p className="mt-1 text-xs">
                  Records the digital audio being sent to your Windows default playback device. No
                  microphone or additional cables are required.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="mt-1 flex items-center gap-2 text-base font-medium">
          <Speaker className="size-4 text-muted-foreground" />
          {device?.name ?? "No playback device detected"}
        </p>
      </div>
      <span
        className={`mt-4 flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
          connected
            ? "border-online/40 text-online"
            : "border-destructive/40 text-destructive"
        }`}
      >
        <span
          className={`size-1.5 rounded-full ${connected ? "bg-online" : "bg-destructive"}`}
        />
        {connected ? "Connected" : "Disconnected"}
      </span>
    </div>
  );
}
