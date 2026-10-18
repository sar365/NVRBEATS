import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, FileAudio2, FolderOpen, Pencil, Play, Repeat, Share } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRecordings } from "@/hooks/useRecordings";
import { formatBytes, formatDate, formatDuration } from "@/lib/format";
import { getBridge } from "@/lib/native";
import type { AudioFormat, RecordingMeta } from "@/lib/native/types";
import { playRecording } from "@/lib/player";
import { exportRecording } from "@/lib/export";
import { toast } from "sonner";

export const Route = createFileRoute("/library/$id")({
  head: () => ({
    meta: [
      { title: "Set Details — DJ Set Recorder" },
      {
        name: "description",
        content:
          "Full metadata and file information for a recorded DJ set: artist, genre, format, sample rate, bit depth and local path.",
      },
      { property: "og:title", content: "Set Details — DJ Set Recorder" },
      {
        property: "og:description",
        content: "Edit set metadata, open the local folder, convert or play a recorded DJ set.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DetailPage,
});

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

function DetailPage() {
  const { id } = useParams({ from: "/library/$id" });
  const { recordings, save } = useRecordings();
  const bridge = getBridge();
  const recording = recordings.find((r) => r.id === id);

  if (!recording) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Recording not found.</p>
        <Button className="mt-3" variant="secondary" asChild>
          <Link to="/library">Back to library</Link>
        </Button>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link
        to="/library"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> My DJ Sets
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{recording.set_name}</h1>
          <p className="text-sm text-muted-foreground">
            {recording.artist || "Unknown artist"} • {formatDate(recording.date)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => playRecording(recording, recordings)}>
            <Play className="size-3.5" /> Play
          </Button>
          <EditDialog recording={recording} onSave={save} />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void bridge.openRecordingFolder(recording.filepath)}
          >
            <FolderOpen className="size-3.5" /> Open Folder
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void exportRecording(recording)}>
            <Share className="size-3.5" /> Export
          </Button>
          <ConvertDialog recording={recording} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="label-caps">Set Information</h2>
          <div className="mt-3">
            <Row label="Artist" value={recording.artist} />
            <Row label="Set Name" value={recording.set_name} />
            <Row label="Date" value={formatDate(recording.date)} />
            <Row label="Genre" value={recording.genre} />
            <Row label="Location" value={recording.location} />
            <Row label="Tags" value={recording.tags.join(", ")} />
            <Row label="Notes" value={recording.notes} />
            <Row label="Artwork" value={recording.artwork_path ?? "None"} />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="label-caps">File Information</h2>
          <div className="mt-3">
            <Row label="Format" value={recording.format} />
            <Row label="Sample Rate" value={`${recording.sample_rate / 1000} kHz`} />
            <Row label="Bit Depth" value={`${recording.bit_depth}-bit`} />
            <Row label="Duration" value={formatDuration(recording.duration)} />
            <Row label="File Size" value={formatBytes(recording.file_size)} />
          </div>
          <p className="mt-3 break-all font-mono text-[11px] text-muted-foreground">
            <FileAudio2 className="mr-1 inline size-3" />
            {recording.filepath}
          </p>
        </section>
      </div>
    </AppShell>
  );
}

function EditDialog({
  recording,
  onSave,
}: {
  recording: RecordingMeta;
  onSave: (r: RecordingMeta) => void;
}) {
  const [draft, setDraft] = useState(recording);
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" onClick={() => setDraft(recording)}>
          <Pencil className="size-3.5" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit set metadata</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {(
            [
              ["set_name", "Set name"],
              ["artist", "Artist"],
              ["genre", "Genre"],
              ["location", "Location"],
              ["date", "Date"],
              ["artwork_path", "Artwork path"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="grid gap-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                value={(draft[key] as string | null) ?? ""}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            </div>
          ))}
          <div className="grid gap-1.5">
            <Label htmlFor="tags">Tags (comma separated)</Label>
            <Input
              id="tags"
              value={draft.tags.join(", ")}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  tags: e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              onSave(draft);
              setOpen(false);
              toast.success("Metadata saved");
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConvertDialog({ recording }: { recording: RecordingMeta }) {
  const bridge = getBridge();
  const [format, setFormat] = useState<AudioFormat>("MP3");
  const [quality, setQuality] = useState<"HIGH" | "STANDARD" | "SMALL">("HIGH");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Repeat className="size-3.5" /> Convert
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert Recording</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Conversion runs locally with bundled FFmpeg in the Windows desktop build. Nothing is
          uploaded.
        </p>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as AudioFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["WAV", "FLAC", "MP3", "AAC"] as AudioFormat[]).map((f) => (
                  <SelectItem key={f} value={f}>
                    {f === "AAC" ? "AAC / M4A" : f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Quality</Label>
            <Select value={quality} onValueChange={(v) => setQuality(v as typeof quality)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="STANDARD">Standard</SelectItem>
                <SelectItem value="SMALL">Small file</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await bridge.convertRecording({
                  recordingId: recording.id,
                  filepath: recording.filepath,
                  format,
                  quality,
                });
                toast.success(`Conversion queued: ${result.outputPath}`);
              } catch {
                toast.error("The Windows audio engine is not connected.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Converting…" : "Start Conversion"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
