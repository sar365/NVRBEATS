/**
 * TrimDialog — set start/end points before a finished recording is added to the
 * library. The cut itself is performed natively (bridge.trimRecording); the UI
 * only chooses the points.
 */
import { useEffect, useState } from "react";
import { Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatDuration } from "@/lib/format";

export interface TrimResult {
  startSec: number;
  endSec: number;
}

export function TrimDialog({
  open,
  durationSec,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  durationSec: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (trim: TrimResult | null) => void;
}) {
  const total = Math.max(1, Math.round(durationSec));
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(total);

  useEffect(() => {
    if (open) {
      setStart(0);
      setEnd(total);
    }
  }, [open, total]);

  const kept = Math.max(0, end - start);

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onCancel() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="size-4" /> Trim before saving
          </DialogTitle>
          <DialogDescription>
            Cut the silence at the start and end of your set. Leave it untouched to keep the full
            recording.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="relative h-14 overflow-hidden rounded-md border border-border bg-surface-raised">
            <div
              className="absolute inset-y-0 bg-signal/20"
              style={{
                left: `${(start / total) * 100}%`,
                width: `${(kept / total) * 100}%`,
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-muted-foreground">
              {formatDuration(start)} → {formatDuration(end)}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="trim-start">Start point</Label>
            <input
              id="trim-start"
              type="range"
              min={0}
              max={total}
              step={1}
              value={start}
              onChange={(e) => setStart(Math.min(Number(e.target.value), end - 1))}
              className="w-full accent-[hsl(var(--signal))]"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="trim-end">End point</Label>
            <input
              id="trim-end"
              type="range"
              min={0}
              max={total}
              step={1}
              value={end}
              onChange={(e) => setEnd(Math.max(Number(e.target.value), start + 1))}
              className="w-full accent-[hsl(var(--signal))]"
            />
          </div>

          <p className="tnum font-mono text-xs text-muted-foreground">
            Kept length {formatDuration(kept)} of {formatDuration(total)}
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => onConfirm(null)}>
            Save full recording
          </Button>
          <Button
            disabled={busy || kept <= 0}
            onClick={() => onConfirm({ startSec: start, endSec: end })}
          >
            {busy ? "Trimming…" : "Trim and save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
