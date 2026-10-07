import { Link } from "@tanstack/react-router";
import { Disc3, LibraryBig, Settings2, Radio, ListChecks } from "lucide-react";
import type { ReactNode } from "react";
import { DevModeBanner } from "./DevModeBanner";
import { PlayerBar } from "./PlayerBar";

const nav = [
  { to: "/", label: "Recorder", icon: Radio },
  { to: "/library", label: "Library", icon: LibraryBig },
  { to: "/setup", label: "Setup", icon: ListChecks },
  { to: "/settings", label: "Settings", icon: Settings2 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded bg-signal/15 text-signal">
              <Disc3 className="size-4.5" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-wide">DJ SET RECORDER</span>
              <span className="block text-[11px] text-muted-foreground">Record What You Hear</span>
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-1">
            {nav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeOptions={{ exact: to === "/" }}
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <DevModeBanner />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-32">{children}</main>

      <PlayerBar />
    </div>
  );
}
