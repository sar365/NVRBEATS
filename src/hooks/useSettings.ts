import { useCallback, useEffect, useState } from "react";
import type { RecordingSettings } from "@/lib/native/types";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "@/lib/store/settings";

export function useSettings() {
  const [settings, setSettings] = useState<RecordingSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", settings.appearance === "light");
  }, [settings.appearance]);

  const update = useCallback((patch: Partial<RecordingSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  return { settings, update };
}
