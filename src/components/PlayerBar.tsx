import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import { usePlayer } from "@/lib/player";
import { isNativeRuntime } from "@/lib/native";

/**
 * Local playback UI. The Windows desktop build routes these controls to native
 * playback; the browser preview only moves the transport position (mock).
 */
export function PlayerBar() {
  const { current, playing, toggle, next, previous, position, seek } = usePlayer();
  const [volume, setVolume] = useState(80);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted || !current) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-2.5">
        <div className="min-w-40 flex-1">
          <p className="truncate text-xs font-medium">{current.set_name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {current.artist} {isNativeRuntime() ? "" : "• preview transport only"}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={previous} aria-label="Previous">
            <SkipBack className="size-4" />
          </Button>
          <Button size="icon" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <Button size="icon" variant="ghost" onClick={next} aria-label="Next">
            <SkipForward className="size-4" />
          </Button>
        </div>

        <div className="flex min-w-56 flex-1 items-center gap-2">
          <span className="tnum font-mono text-[11px] text-muted-foreground">
            {formatDuration(position)}
          </span>
          <Slider
            value={[position]}
            max={current.duration}
            step={1}
            onValueChange={([v]) => seek(v ?? 0)}
            aria-label="Seek"
          />
          <span className="tnum font-mono text-[11px] text-muted-foreground">
            {formatDuration(current.duration)}
          </span>
        </div>

        <div className="flex w-28 items-center gap-2">
          <Volume2 className="size-3.5 text-muted-foreground" />
          <Slider
            value={[volume]}
            max={100}
            step={1}
            onValueChange={([v]) => setVolume(v ?? 0)}
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
}
