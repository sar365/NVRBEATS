import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Circle, Square, CheckCircle2, Bug, Keyboard } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DeviceStatus } from "@/components/DeviceStatus";
import { LevelMeters } from "@/components/LevelMeters";
import { DeviceChangedPanel, ErrorPanel } from "@/components/ErrorPanels";
import { RecoveryFlow } from "@/components/RecoveryFlow";
import { TrimDialog, type TrimResult } from "@/components/TrimDialog";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useRecorder } from "@/hooks/useRecorder";
import { useRecordings } from "@/hooks/useRecordings";
import { useSettings } from "@/hooks/useSettings";
import { formatBytes, formatDuration, formatSpec } from "@/lib/format";
import { renderFilename } from "@/lib/store/settings";
import { isNativeRuntime, mockBridge } from "@/lib/native";
import type { OutputDevice, RecordingMeta, RecordingStatus } from "@/lib/native/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DJ Set Recorder — Record What You Hear" },
      {
        name: "description",
        content:
          "Record your Traktor Pro 4 sets straight from the Windows default output using WASAPI loopback. No microphone, no cables, no cloud.",
      },
      { property: "og:title", content: "DJ Set Recorder — Record What You Hear" },
      {
        property: "og:description",
        content:
          "A lightweight Windows recorder that captures the digital audio sent to your PC default output.",
      },
    ],
  }),
  component: RecorderPage,
});

const STATE_LABEL: Record<string, string> = {
  READY: "Ready",
  STARTING: "Starting",
  RECORDING: "Recording",
  STOPPING: "Stopping",
  FINALIZING: "Finalizing",
  COMPLETED: "Recording Complete",
  ERROR: "Error",
  RECOVERY_AVAILABLE: "Recovery Available",
  DEVICE_DISCONNECTED: "Device Disconnected",
};

function RecorderPage() {
  const { settings } = useSettings();
  const { status, levels, inputLevels, start, stop, acknowledge, bridge, refresh } = useRecorder();
  const { save } = useRecordings();
  const [device, setDevice] = useState<OutputDevice | null>(null);
  const [uiSeconds, setUiSeconds] = useState(0);
  const [dismissedRecovery, setDismissedRecovery] = useState<string | null>(null);
  const [pendingFinal, setPendingFinal] = useState<RecordingStatus | null>(null);
  const [trimBusy, setTrimBusy] = useState(false);


  useEffect(() => {
    void bridge.getDefaultOutputDevice().then(setDevice);
  }, [bridge]);

  // UI-only timer; the authoritative duration comes from the native recorder.
  useEffect(() => {
    setUiSeconds(status.durationSec);
    if (status.state !== "RECORDING") return;
    const id = window.setInterval(() => setUiSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [status.state, status.durationSec]);

  const recording = status.state === "RECORDING";
  const transitioning =
    status.state === "STARTING" || status.state === "STOPPING" || status.state === "FINALIZING";

  // Keyboard shortcuts: R record, S stop, M minimize/restore.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      )
        return;
      const key = e.key.toLowerCase();
      if (key === "r" && !recording && !transitioning) {
        e.preventDefault();
        void start(settings);
      } else if (key === "s" && recording) {
        e.preventDefault();
        void handleStop();
      } else if (key === "m") {
        e.preventDefault();
        setMinimized((prev) => {
          void (prev ? bridge.restoreWindow() : bridge.minimizeWindow());
          if (!isNativeRuntime()) {
            toast.message(prev ? "Window restored" : "Minimized to tray", {
              description: "Recording keeps running in the background.",
            });
          }
          return !prev;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, transitioning, settings, bridge, start]);

  async function handleStop() {
    const final = await stop();
    if (!final) return;
    setPendingFinal(final);
  }

  async function finalize(trim: TrimResult | null) {
    const final = pendingFinal;
    if (!final) return;
    let durationSec = final.durationSec;
    let fileSizeBytes = final.fileSizeBytes;
    let filepath = final.path;

    if (trim) {
      setTrimBusy(true);
      try {
        const trimmed = await bridge.trimRecording({
          path: final.path ?? "",
          startSec: trim.startSec,
          endSec: trim.endSec,
        });
        durationSec = trimmed.durationSec;
        fileSizeBytes = trimmed.fileSizeBytes;
        filepath = trimmed.path;
      } catch (error) {
        toast.error("The recording could not be trimmed.", { description: String(error) });
      } finally {
        setTrimBusy(false);
      }
    }

    const now = new Date();
    const filename = renderFilename(settings.filenameTemplate, {}, settings.format);
    const meta: RecordingMeta = {
      id: crypto.randomUUID(),
      filename,
      filepath: filepath ?? `${settings.folder}\\${filename}`,
      artist: "",
      set_name: filename.replace(/\.[^.]+$/, ""),
      date: now.toISOString().slice(0, 10),
      duration: Math.round(durationSec),
      format: settings.format,
      sample_rate: settings.sampleRate,
      bit_depth: settings.bitDepth,
      file_size: fileSizeBytes,
      genre: "",
      location: "",
      notes: "",
      tags: [],
      artwork_path: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    save(meta);
    setPendingFinal(null);
    toast.success(trim ? "Trimmed recording saved to your library." : "Recording saved to your library.");
  }

  return (
    <AppShell>
      <TrimDialog
        open={pendingFinal !== null}
        durationSec={pendingFinal?.durationSec ?? 0}
        busy={trimBusy}
        onCancel={() => void finalize(null)}
        onConfirm={(trim) => void finalize(trim)}
      />
      <div className="space-y-4">
        {status.error ? <ErrorPanel error={status.error} onDismiss={acknowledge} /> : null}
        {status.deviceChange ? (
          <DeviceChangedPanel change={status.deviceChange} onDismiss={acknowledge} />
        ) : null}
        {status.recovery && dismissedRecovery !== status.recovery.path ? (
          <RecoveryFlow
            recovery={status.recovery}
            onRepair={async () => {
              await bridge.recoverRecording();
              await refresh();
            }}
            onDiscard={async () => {
              await bridge.discardRecovery();
              await refresh();
            }}
            onOpenFolder={() => void bridge.openRecordingFolder(status.recovery?.path)}
            onDismiss={() => setDismissedRecovery(status.recovery?.path ?? null)}
          />
        ) : null}



        <section className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between">
            <span
              className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] ${
                recording ? "text-signal" : "text-muted-foreground"
              }`}
            >
              {recording ? <span className="size-2 rounded-full bg-signal" /> : null}
              {STATE_LABEL[status.state]}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {formatSpec(settings.format, settings.sampleRate, settings.bitDepth)}
            </span>
          </div>

          <div className="mt-5 border-t border-border pt-5">
            <DeviceStatus device={status.device ?? device} />
          </div>

          <div className="mt-6 space-y-5">
            <LevelMeters levels={inputLevels} title="Input Levels (live preview)" />
            <LevelMeters levels={levels} title="Output Levels (being recorded)" />
          </div>

          <div className="mt-8 text-center">
            <p
              className={`tnum font-mono text-5xl font-semibold sm:text-6xl ${
                recording ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {formatDuration(recording ? uiSeconds : status.durationSec)}
            </p>
            {recording || status.state === "COMPLETED" ? (
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {formatSpec(settings.format, settings.sampleRate, settings.bitDepth)} •{" "}
                {formatBytes(status.fileSizeBytes)}
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Recording captures the PC default output. Minimize freely — the native engine keeps
                recording in the background.
              </p>
            )}
          </div>

          <div className="mt-8 flex justify-center">
            {recording ? (
              <Button
                size="lg"
                variant="secondary"
                className="h-14 min-w-52 text-base font-semibold tracking-wide"
                disabled={transitioning}
                onClick={() => void handleStop()}
              >
                <Square className="size-4 fill-current" /> STOP
              </Button>
            ) : (
              <Button
                size="lg"
                className="h-14 min-w-52 bg-signal text-base font-semibold tracking-wide text-signal-foreground hover:bg-signal/90"
                disabled={transitioning}
                onClick={() => void start(settings)}
              >
                <Circle className="size-4 fill-current" />{" "}
                {transitioning ? (STATE_LABEL[status.state] ?? "").toUpperCase() : "RECORD"}
              </Button>
            )}
          </div>

          {status.state === "COMPLETED" ? (
            <p className="mt-4 flex items-center justify-center gap-2 text-sm text-online">
              <CheckCircle2 className="size-4" /> Recording Complete — saved to your library.
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="label-caps">Recording Source</h2>
          <p className="mt-1 text-sm font-medium">PC Default Output</p>
          <p className="text-sm text-muted-foreground">
            {(status.device ?? device)?.name ?? "No playback device detected"}
          </p>
          <p className="mt-3 max-w-2xl text-xs text-muted-foreground">
            Traktor Pro 4 → Windows Audio → PC Default Output → WASAPI Loopback → Local Recorder →
            WAV. Nothing is uploaded, and no microphone is used.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="label-caps flex items-center gap-2">
            <Keyboard className="size-3.5" /> Keyboard Shortcuts
          </h2>
          <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            <li>
              <kbd className="rounded border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-[11px]">
                R
              </kbd>{" "}
              Start recording
            </li>
            <li>
              <kbd className="rounded border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-[11px]">
                S
              </kbd>{" "}
              Stop recording
            </li>
            <li>
              <kbd className="rounded border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-[11px]">
                M
              </kbd>{" "}
              Minimize / restore window
            </li>
          </ul>
        </section>

        {!isNativeRuntime() ? <DevSimulationPanel onChange={refresh} /> : null}
      </div>
    </AppShell>
  );
}

function DevSimulationPanel({ onChange }: { onChange: () => void }) {
  return (
    <section className="rounded-xl border border-dashed border-warn/40 bg-surface p-5">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-warn">
        <Bug className="size-3.5" /> Development Mode — Simulation Only
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        These controls exercise UI states. They do not capture audio.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            mockBridge.simulateRecoveryAvailable();
            onChange();
          }}
        >
          Simulate Recovery
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            mockBridge.simulateError({
              state: "DEVICE_DISCONNECTED",
              error: {
                code: "DEVICE_DISCONNECTED",
                message: "Your recording output device was disconnected.",
              },
            });
            onChange();
          }}
        >
          Simulate Device Disconnect
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            mockBridge.simulateError({
              state: "ERROR",
              error: {
                code: "DISK_FULL",
                message: "There isn't enough storage space to continue recording.",
              },
            });
            onChange();
          }}
        >
          Simulate Disk Full
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            mockBridge.reset();
            onChange();
          }}
        >
          Reset
        </Button>
      </div>
    </section>
  );
}
