import { CircleAlert, FolderOpen, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  DeviceChangeEvent,
  IncompleteRecording,
  RecorderError,
} from "@/lib/native/types";
import { formatBytes, formatDuration } from "@/lib/format";

const COPY: Record<RecorderError["code"], { title: string; body: string }> = {
  NO_AUDIO_DEVICE: {
    title: "No audio device",
    body: "No Windows playback device detected.",
  },
  DEVICE_DISCONNECTED: {
    title: "Device disconnected",
    body: "Your recording output device was disconnected.",
  },
  DISK_FULL: {
    title: "Disk full",
    body: "There isn't enough storage space to continue recording.",
  },
  NATIVE_ENGINE_UNAVAILABLE: {
    title: "Native engine unavailable",
    body: "The Windows audio engine is not connected.",
  },
  RECORDING_FAILED: {
    title: "Recording failure",
    body: "Audio recording could not be started.",
  },
};

export function ErrorPanel({
  error,
  onDismiss,
}: {
  error: RecorderError;
  onDismiss?: () => void;
}) {
  const copy = COPY[error.code];
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-destructive">{copy.title}</p>
          <p className="mt-1 text-sm text-foreground/90">{error.message || copy.body}</p>
          {error.code === "NATIVE_ENGINE_UNAVAILABLE" ? (
            <p className="mt-1 text-xs text-muted-foreground">
              The web preview cannot access WASAPI. Install/run the Windows desktop version to
              record real system audio.
            </p>
          ) : null}
          {error.detail ? (
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">{error.detail}</p>
          ) : null}
        </div>
        {onDismiss ? (
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function DeviceChangedPanel({
  change,
  onDismiss,
}: {
  change: DeviceChangeEvent;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-lg border border-warn/40 bg-warn/10 p-4">
      <p className="text-sm font-semibold text-warn">Audio Output Changed</p>
      <p className="mt-1 text-sm">Windows changed your default playback device.</p>
      <dl className="mt-2 grid gap-1 text-xs text-muted-foreground">
        <div className="flex gap-2">
          <dt className="w-16">Previous:</dt>
          <dd className="text-foreground">{change.previous.name}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16">New:</dt>
          <dd className="text-foreground">{change.next.name}</dd>
        </div>
      </dl>
      <Button className="mt-3" size="sm" variant="secondary" onClick={onDismiss}>
        Got it
      </Button>
    </div>
  );
}

export function RecoveryPanel({
  recovery,
  onRecover,
  onDelete,
  onOpenFolder,
}: {
  recovery: IncompleteRecording;
  onRecover: () => void;
  onDelete: () => void;
  onOpenFolder: () => void;
}) {
  return (
    <div className="rounded-lg border border-warn/40 bg-surface p-4">
      <p className="text-sm font-semibold">Incomplete Recording Found</p>
      <p className="mt-1 text-sm text-muted-foreground">
        An unfinished DJ recording was detected. Nothing is deleted automatically.
      </p>
      <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">{recovery.path}</p>
      <p className="mt-1 font-mono text-xs">
        {formatDuration(recovery.durationSec)} • {formatBytes(recovery.fileSizeBytes)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onRecover}>
          <RotateCcw className="size-3.5" /> Recover Recording
        </Button>
        <Button size="sm" variant="secondary" onClick={onOpenFolder}>
          <FolderOpen className="size-3.5" /> Open Folder
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="size-3.5" /> Delete
        </Button>
      </div>
    </div>
  );
}
