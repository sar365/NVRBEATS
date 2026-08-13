import type { AudioLevels } from "@/lib/native/types";

const SEGMENTS = 28;

function Meter({ channel, value }: { channel: "L" | "R"; value: number }) {
  const lit = Math.round(value * SEGMENTS);
  return (
    <div className="flex items-center gap-3">
      <span className="w-3 font-mono text-xs text-muted-foreground">{channel}</span>
      <div className="flex h-3 flex-1 gap-[2px]">
        {Array.from({ length: SEGMENTS }).map((_, i) => {
          const on = i < lit;
          const color =
            i > SEGMENTS - 4
              ? "bg-meter-high"
              : i > SEGMENTS - 9
                ? "bg-meter-mid"
                : "bg-meter-low";
          return (
            <span
              key={i}
              className={`flex-1 rounded-[1px] ${on ? color : "bg-secondary"}`}
              aria-hidden
            />
          );
        })}
      </div>
    </div>
  );
}

export function LevelMeters({ levels }: { levels: AudioLevels }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="label-caps">Output Levels</span>
        {levels.mock ? (
          <span className="text-[10px] uppercase tracking-widest text-warn">
            Development Mock Audio Levels
          </span>
        ) : null}
      </div>
      <Meter channel="L" value={levels.left} />
      <Meter channel="R" value={levels.right} />
    </div>
  );
}
