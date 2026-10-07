import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Circle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface SetupItem {
  id: string;
  label: string;
  detail?: string;
}

export interface SetupSection {
  id: string;
  title: string;
  description: string;
  items: SetupItem[];
}

/** Steps mirrored from docs/WINDOWS-SETUP.md. */
export const SETUP_SECTIONS: SetupSection[] = [
  {
    id: "part1",
    title: "Part 1 — One-time setup",
    description: "Install the four build tools once. Skip any you already have.",
    items: [
      {
        id: "bun",
        label: "Install Bun",
        detail: 'PowerShell: powershell -c "irm bun.sh/install.ps1 | iex" — then bun --version works.',
      },
      {
        id: "rust",
        label: "Install Rust",
        detail: "Run the installer from rustup.rs with default options — then cargo --version works.",
      },
      {
        id: "cpp",
        label: 'Install Microsoft C++ Build Tools ("Desktop development with C++")',
        detail: "Without this the build fails with a link.exe error.",
      },
      {
        id: "webview2",
        label: "WebView2 present",
        detail: "Preinstalled on Windows 11. On Windows 10, install the Evergreen Bootstrapper.",
      },
      {
        id: "project",
        label: "Get the project onto your PC",
        detail: "Download/clone the project folder and open a terminal in it.",
      },
    ],
  },
  {
    id: "part2",
    title: "Part 2 — Build the app",
    description: "Install dependencies, do a test run, then build the installer.",
    items: [
      { id: "install", label: "Run bun install", detail: "Downloads all project dependencies." },
      {
        id: "dev",
        label: "Test run with bun run desktop:dev",
        detail: "The desktop window opens and the dashboard loads. Recommended before making an installer.",
      },
      {
        id: "build",
        label: "Build the installer with bun run desktop:build",
        detail: "First build takes 10–30 minutes. Installer lands in src-tauri/target/release/bundle/.",
      },
      { id: "installed", label: "Install the app from the MSI/NSIS installer" },
    ],
  },
  {
    id: "part3",
    title: "Part 3 — Traktor configuration",
    description: "Critical: the recorder taps the Windows default output.",
    items: [
      {
        id: "traktor-output",
        label: "Set Traktor's audio device to the Windows default output",
        detail: "Use WASAPI (shared) or DirectSound — never exclusive-mode ASIO, which bypasses the tap and records silence.",
      },
      {
        id: "meter-check",
        label: "Play a track and confirm the input meter moves before pressing Record",
      },
    ],
  },
  {
    id: "part4",
    title: "Part 4 — Record a real set",
    description: "The full end-to-end test checklist.",
    items: [
      { id: "record", label: "Record at least 5 minutes of a real set" },
      {
        id: "tray",
        label: "Close the window mid-set and confirm recording continues from the tray",
      },
      { id: "stop", label: "Stop the recording and let it finalize" },
      { id: "trim", label: "Set trim start/end points and save" },
      {
        id: "library",
        label: "Confirm the library shows real duration, sample rate, and file size",
      },
      { id: "export", label: "Export a copy to another folder and open it" },
      {
        id: "recovery",
        label: "Kill the app mid-recording and confirm the recovery flow repairs the .part file",
      },
    ],
  },
];

const STORAGE_KEY = "dj-recorder-setup-checklist-v1";

function loadChecked(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function SetupChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const hydrated = useRef(false);

  // Load saved progress after hydration to avoid SSR/client mismatch.
  useEffect(() => {
    setChecked(loadChecked());
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
    } catch {
      // storage full or unavailable — checklist still works for the session
    }
  }, [checked]);

  const toggle = useCallback((id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const reset = useCallback(() => setChecked({}), []);

  const { done, total } = useMemo(() => {
    const all = SETUP_SECTIONS.flatMap((s) => s.items);
    return { done: all.filter((i) => checked[i.id]).length, total: all.length };
  }, [checked]);

  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">
              {done} of {total} steps complete
            </p>
            <p className="text-xs text-muted-foreground">
              Progress is saved on this device.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={reset} disabled={done === 0}>
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
        </div>
        <Progress value={percent} className="mt-3 h-1.5" />
      </div>

      {SETUP_SECTIONS.map((section) => {
        const sectionDone = section.items.filter((i) => checked[i.id]).length;
        return (
          <section
            key={section.id}
            className="rounded-lg border border-border bg-card"
          >
            <header className="border-b border-border px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold">{section.title}</h2>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {sectionDone}/{section.items.length}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {section.description}
              </p>
            </header>
            <ul className="divide-y divide-border">
              {section.items.map((item) => {
                const isDone = !!checked[item.id];
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      aria-pressed={isDone}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
                    >
                      {isDone ? (
                        <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-signal" />
                      ) : (
                        <Circle className="mt-0.5 size-4.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block text-sm",
                            isDone && "text-muted-foreground line-through",
                          )}
                        >
                          {item.label}
                        </span>
                        {item.detail && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {item.detail}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
