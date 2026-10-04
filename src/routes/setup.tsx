import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { SetupChecklist } from "@/components/SetupChecklist";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Windows Setup Checklist — DJ Set Recorder" },
      {
        name: "description",
        content:
          "Track every step for building the Windows desktop app and testing real Traktor Pro 4 capture: tools, build, Traktor audio configuration, and the real-set test checklist.",
      },
      { property: "og:title", content: "Windows Setup Checklist — DJ Set Recorder" },
      {
        property: "og:description",
        content:
          "Track every step for building the Windows desktop app and testing real Traktor Pro 4 capture.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Windows Setup Checklist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Work through these steps on your Windows PC to build the desktop app and
          record a real Traktor set. Tick items off as you go — your progress is
          saved on this device. Full details are in the Windows setup guide
          (docs/WINDOWS-SETUP.md).
        </p>
      </div>
      <SetupChecklist />
    </AppShell>
  );
}
