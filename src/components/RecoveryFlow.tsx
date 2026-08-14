import { useState } from "react";
import {
  Check,
  CircleAlert,
  FileWarning,
  FolderOpen,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IncompleteRecording } from "@/lib/native/types";
import { formatBytes, formatDuration } from "@/lib/format";

type Step = 1 | 2 | 3 | 4;

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: "Review file" },
  { id: 2, label: "Choose action" },
  { id: 3, label: "Restore" },
  { id: 4, label: "Done" },
];

export function RecoveryFlow({
  recovery,
  onRepair,
  onDiscard,
  onOpenFolder,
  onDismiss,
}: {
  recovery: IncompleteRecording;
  onRepair: () => Promise<void> | void;
  onDiscard: () => Promise<void> | void;
  onOpenFolder: () => void;
  onDismiss?: () => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [working, setWorking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [outcome, setOutcome] = useState<"repaired" | "deleted" | "kept" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function run(action: "repair" | "delete", done: typeof outcome) {
    setWorking(true);
    setFailure(null);
    setStep(3);
    try {
      await (action === "repair" ? onRepair() : onDiscard());
      setOutcome(done);
      setStep(4);
    } catch (error) {
      setFailure(String(error));
      setStep(2);
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="rounded-xl border border-warn/40 bg-surface p-5">
      <header className="flex items-start gap-3">
        <FileWarning className="mt-0.5 size-4 shrink-0 text-warn" />
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Incomplete Recording Found</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            A previous session ended before the file was finalized. Nothing is deleted
            automatically — follow the steps below to restore it.
          </p>
        </div>
        {onDismiss ? (
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Later
          </Button>
        ) : null}
      </header>

      <ol className="mt-4 flex flex-wrap items-center gap-2">
        {STEPS.map((s, index) => {
          const state = step > s.id ? "done" : step === s.id ? "active" : "todo";
          return (
            <li key={s.id} className="flex items-center gap-2">
              <span
                className={`flex size-5 items-center justify-center rounded-full font-mono text-[10px] ${
                  state === "done"
                    ? "bg-online/20 text-online"
                    : state === "active"
                      ? "bg-warn/20 text-warn"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {state === "done" ? <Check className="size-3" /> : s.id}
              </span>
              <span
                className={`text-[11px] uppercase tracking-[0.14em] ${
                  state === "todo" ? "text-muted-foreground" : "text-foreground"
                }`}
              >
                {s.label}
              </span>
              {index < STEPS.length - 1 ? (
                <span className="mx-1 h-px w-6 bg-border" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-4 rounded-lg border border-border bg-background/40 p-4">
        {step === 1 ? (
          <div>
            <p className="label-caps">Step 1 — Review the recovered file</p>
            <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">
              {recovery.path}
            </p>
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
              <Fact label="Started" value={new Date(recovery.startedAt).toLocaleString()} />
              <Fact label="Length" value={formatDuration(recovery.durationSec)} />
              <Fact label="Size" value={formatBytes(recovery.fileSizeBytes)} />
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setStep(2)}>
                Continue
              </Button>
              <Button size="sm" variant="secondary" onClick={onOpenFolder}>
                <FolderOpen className="size-3.5" /> Open Folder
              </Button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <p className="label-caps">Step 2 — Choose what to do</p>
            {failure ? (
              <p className="mt-2 flex items-center gap-2 text-xs text-destructive">
                <CircleAlert className="size-3.5" /> Restore failed. {failure}
              </p>
            ) : null}
            <div className="mt-3 grid gap-2">
              <Choice
                icon={<RotateCcw className="size-4 text-online" />}
                title="Repair and add to library"
                body="Patches the WAV header and saves a playable file. Recommended."
                action={
                  <Button size="sm" disabled={working} onClick={() => void run("repair", "repaired")}>
                    Repair
                  </Button>
                }
              />
              <Choice
                icon={<ShieldCheck className="size-4 text-warn" />}
                title="Keep the file untouched"
                body="Leaves the .part file on disk so you can repair it later."
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={working}
                    onClick={() => {
                      setOutcome("kept");
                      setStep(4);
                    }}
                  >
                    Keep
                  </Button>
                }
              />
              <Choice
                icon={<Trash2 className="size-4 text-destructive" />}
                title="Delete the incomplete file"
                body="Moves the .part file to the Recycle Bin. This cannot be undone here."
                action={
                  confirmDelete ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={working}
                        onClick={() => setConfirmDelete(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={working}
                        onClick={() => void run("delete", "deleted")}
                      >
                        Confirm delete
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={working}
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete
                    </Button>
                  )
                }
              />
            </div>
            <Button className="mt-3" size="sm" variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex items-center gap-3 py-2">
            <Loader2 className="size-4 animate-spin text-warn" />
            <div>
              <p className="text-sm font-medium">Working…</p>
              <p className="text-xs text-muted-foreground">
                The native engine is finalizing the file. Do not close the app.
              </p>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-online">
              <Check className="size-4" />
              {outcome === "repaired"
                ? "Recording repaired and added to your library."
                : outcome === "deleted"
                  ? "Incomplete file moved to the Recycle Bin."
                  : "File kept on disk — you can restore it any time."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={onOpenFolder}>
                <FolderOpen className="size-3.5" /> Open Folder
              </Button>
              {onDismiss ? (
                <Button size="sm" variant="ghost" onClick={onDismiss}>
                  Close
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-mono text-xs">{value}</dd>
    </div>
  );
}

function Choice({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-3">
      <span className="mt-0.5">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
