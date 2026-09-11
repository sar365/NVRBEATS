import { useCallback, useEffect, useState } from "react";
import type { RecordingSettings } from "@/lib/native/types";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "@/lib/store/settings";
import { getBridge } from "@/lib/native";

export function useSettings() {
  const [settings, setSettings] = useState<RecordingSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  // Keep the native engine in sync so tray-started recordings use the same
  // folder, format and template as the dashboard button.
  useEffect(() => {
    void getBridge().syncSettings?.(settings);
  }, [settings]);


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
