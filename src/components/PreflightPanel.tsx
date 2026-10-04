import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PreflightReport } from "@/lib/preflight";

const ICON = {
  pass: <CheckCircle2 className="size-4 text-online" />,
  warn: <AlertTriangle className="size-4 text-warning" />,
  fail: <XCircle className="size-4 text-destructive" />,
};

export function PreflightPanel({
  report,
  running,
  onRun,
}: {
  report: PreflightReport | null;
  running: boolean;
  onRun: () => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5" aria-label="Preflight check">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="label-caps">Preflight Check</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {running
              ? "Checking…"
              : report
                ? report.ok
                  ? `Ready to record · checked ${new Date(report.checkedAt).toLocaleTimeString()}`
                  : "Fix the items below before recording."
                : "Runs automatically when you press Record."}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={onRun} disabled={running}>
          {running ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Run check
        </Button>
      </div>
      {report ? (
        <ul className="mt-4 space-y-3">
          {report.checks.map((c) => (
            <li key={c.id} className="flex items-start gap-3">
              <span className="mt-0.5">{ICON[c.status]}</span>
              <div>
                <p className="text-sm font-medium">{c.label}</p>
                <p className="text-xs text-muted-foreground">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
