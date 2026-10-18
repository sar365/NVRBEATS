import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FolderOpen, Pencil, Play, Search, Share, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRecordings } from "@/hooks/useRecordings";
import { formatBytes, formatDate, formatDuration } from "@/lib/format";
import { getBridge } from "@/lib/native";
import { playRecording } from "@/lib/player";
import { exportRecording } from "@/lib/export";

export const Route = createFileRoute("/library/")({
  head: () => ({
    meta: [
      { title: "My DJ Sets — Recording Library" },
      {
        name: "description",
        content:
          "Browse, search and manage every DJ set recorded locally: duration, format, file size and metadata.",
      },
      { property: "og:title", content: "My DJ Sets — Recording Library" },
      {
        property: "og:description",
        content: "Local-first library of your recorded DJ sets, stored on your own machine.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LibraryPage,
});

const FILTERS = ["All", "Recent", "Longest", "Shortest", "WAV", "FLAC", "MP3"] as const;
type Filter = (typeof FILTERS)[number];

function LibraryPage() {
  const { recordings, remove } = useRecordings();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const bridge = getBridge();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = recordings.filter((r) =>
      [r.set_name, r.artist, r.genre, r.location, ...r.tags]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
    if (["WAV", "FLAC", "MP3"].includes(filter)) rows = rows.filter((r) => r.format === filter);
    if (filter === "Longest") rows = [...rows].sort((a, b) => b.duration - a.duration);
    if (filter === "Shortest") rows = [...rows].sort((a, b) => a.duration - b.duration);
    if (filter === "Recent") rows = [...rows].sort((a, b) => b.date.localeCompare(a.date));
    return rows;
  }, [recordings, query, filter]);

  return (
    <AppShell>
      <h1 className="text-xl font-semibold">My DJ Sets</h1>

      <div className="mt-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search recordings..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                filter === f
                  ? "border-signal/50 bg-signal/15 text-signal"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-5 space-y-2">
        {visible.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded bg-surface-raised font-mono text-[10px] text-muted-foreground">
              {r.format}
            </div>
            <div className="min-w-40 flex-1">
              <Link
                to="/library/$id"
                params={{ id: r.id }}
                className="text-sm font-medium hover:text-signal"
              >
                {r.set_name}
              </Link>
              <p className="text-xs text-muted-foreground">
                {r.artist || "Unknown artist"} • {formatDate(r.date)} • {r.genre || "No genre"}
              </p>
              <p className="tnum mt-0.5 font-mono text-[11px] text-muted-foreground">
                {formatDuration(r.duration)} • {r.sample_rate / 1000} kHz • {r.bit_depth}-bit •{" "}
                {formatBytes(r.file_size)}
              </p>
            </div>
            <div className="tnum text-right font-mono text-xs text-muted-foreground">
              <div>{formatDuration(r.duration)}</div>
              <div>{formatBytes(r.file_size)}</div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Play"
                onClick={() => playRecording(r, visible)}
              >
                <Play className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" aria-label="Edit" asChild>
                <Link to="/library/$id" params={{ id: r.id }}>
                  <Pencil className="size-4" />
                </Link>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Export"
                onClick={() => void exportRecording(r)}
              >
                <Share className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Open folder"
                onClick={() => void bridge.openRecordingFolder(r.filepath)}
              >
                <FolderOpen className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Delete"
                onClick={() => remove(r.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
        {visible.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No recordings match your search.
          </li>
        ) : null}
      </ul>
    </AppShell>
  );
}
