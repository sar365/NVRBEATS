import type { RecordingSettings } from "@/lib/native/types";

const KEY = "djsr.settings.v1";

export const DEFAULT_SETTINGS: RecordingSettings = {
  format: "WAV",
  sampleRate: 48000,
  bitDepth: 24,
  folder: "Music\\DJ Sets",
  filenameTemplate: "DJ Set - {date} - {time}",
  followWindowsDefault: true,
  deviceChangeBehavior: "CONTINUE",
  autoRecord: {
    enabled: false,
    startThresholdDb: -40,
    stopAfterSilenceSec: 30,
    minimumLengthSec: 60,
  },
  appearance: "dark",
  minimizeToTray: true,
  startWithWindows: false,
  advanced: {
    bufferSizeMs: 200,
    crashRecovery: true,
    diagnosticLogging: false,
  },
};

export function loadSettings(): RecordingSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<RecordingSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      autoRecord: { ...DEFAULT_SETTINGS.autoRecord, ...parsed.autoRecord },
      advanced: { ...DEFAULT_SETTINGS.advanced, ...parsed.advanced },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: RecordingSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(settings));
}

const VARS = ["date", "time", "artist", "setname", "genre", "location"] as const;

export function renderFilename(
  template: string,
  values: Partial<Record<(typeof VARS)[number], string>>,
  extension: string,
) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const defaults: Record<string, string> = {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`,
    artist: values.artist || "Unknown Artist",
    setname: values.setname || "Untitled Set",
    genre: values.genre || "Unknown",
    location: values.location || "Home",
  };
  const body = template.replace(/\{(\w+)\}/g, (m, key: string) => defaults[key] ?? m);
  return `${body}.${extension.toLowerCase()}`;
}
