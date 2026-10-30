import { useCallback, useEffect, useRef, useState } from "react";
import type { RecordingSettings, UnifiedAppConfig } from "@/lib/native/types";
import {
  configToSettings,
  DEFAULT_SETTINGS,
  LEGACY_SETTINGS_KEY,
  mergeLegacySettings,
  settingsToConfig,
} from "@/lib/store/settings";
import { getBridge } from "@/lib/native";

export function useSettings() {
  const [settings, setSettings] = useState<RecordingSettings>(DEFAULT_SETTINGS);
  const configRef = useRef<UnifiedAppConfig | null>(null);
  const settingsRef = useRef(DEFAULT_SETTINGS);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const saveConfig = useCallback((nextConfig: UnifiedAppConfig) => {
    const bridge = getBridge();
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => bridge.saveUnifiedConfig(nextConfig));
    return saveQueue.current;
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const bridge = getBridge();
      try {
        const result = await bridge.getUnifiedConfig();
        let nextConfig = result.config;
        let nextSettings = configToSettings(nextConfig);
        if (result.needsLegacyMigration) {
          const legacy =
            typeof window !== "undefined" ? window.localStorage.getItem(LEGACY_SETTINGS_KEY) : null;
          if (legacy !== null) {
            nextSettings = mergeLegacySettings(legacy, nextConfig);
          }
          const migrated = settingsToConfig(nextSettings, nextConfig);
          await saveConfig(migrated);
          if (legacy !== null && typeof window !== "undefined")
            window.localStorage.removeItem(LEGACY_SETTINGS_KEY);
          nextConfig = migrated;
        }
        if (alive) {
          configRef.current = nextConfig;
          settingsRef.current = nextSettings;
          setSettings(nextSettings);
        }
      } catch (error) {
        console.error("Unable to load native settings configuration", error);
        if (alive) {
          configRef.current = null;
          settingsRef.current = DEFAULT_SETTINGS;
          setSettings(DEFAULT_SETTINGS);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [saveConfig]);

  useEffect(() => {
    document.documentElement.classList.toggle("light", settings.appearance === "light");
  }, [settings.appearance]);

  const update = useCallback(
    (patch: Partial<RecordingSettings>) => {
      const next = { ...settingsRef.current, ...patch };
      settingsRef.current = next;
      setSettings(next);
      if (configRef.current) {
        const nextConfig = settingsToConfig(next, configRef.current);
        configRef.current = nextConfig;
        void saveConfig(nextConfig).catch((error) => {
          console.error("Unable to save native settings configuration", error);
        });
      }
    },
    [saveConfig],
  );

  return { settings, update };
}
