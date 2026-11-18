import type { RecordingSettings, UnifiedAppConfig } from "@/lib/native/types";

export const LEGACY_SETTINGS_KEY = "djsr.settings.v1";

export const DEFAULT_SETTINGS: RecordingSettings = {
  format: "WAV",
  sampleRate: 48000,
  bitDepth: 24,
  folder: "Music\\DJ Sets",
  filenameTemplate: "DJ Set - {date} - {time}",
  followWindowsDefault: true,
  outputDeviceId: null,
  captureBackend: "wasapi_loopback",
  asioDriverName: null,
  asioChannelPair: [0, 1],
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
  advanced: { bufferSizeMs: 200, crashRecovery: true, diagnosticLogging: false },
};

const toFinite = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const bounded = (value: unknown, fallback: number, min: number, max: number) =>
  Math.min(max, Math.max(min, toFinite(value, fallback)));

export function configToSettings(config: UnifiedAppConfig): RecordingSettings {
  return {
    ...DEFAULT_SETTINGS,
    format: "WAV",
    sampleRate: config.capture.sampleRateHz === 44100 ? 44100 : 48000,
    bitDepth: config.capture.bitDepth === 16 ? 16 : 24,
    captureBackend:
      config.capture.backend === "asio_loopback" ? "asio_loopback" : "wasapi_loopback",
    asioDriverName: config.capture.asioDriverName,
    asioChannelPair: config.capture.asioChannelPair ?? [0, 1],
    folder: config.recording.folder,
    filenameTemplate: config.recording.filenameTemplate,
    followWindowsDefault: config.capture.devicePolicy !== "specific_device",
    outputDeviceId:
      config.capture.devicePolicy === "specific_device" ? config.capture.deviceId : null,
    deviceChangeBehavior:
      config.capture.onDeviceChange === "stop_and_notify"
        ? "STOP"
        : config.capture.onDeviceChange === "switch_to_default"
          ? "SWITCH"
          : "CONTINUE",
    autoRecord: {
      enabled: config.recording.autoRecord.enabled,
      startThresholdDb: config.recording.autoRecord.startThresholdDbfs,
      stopAfterSilenceSec: config.recording.autoRecord.stopAfterSilenceSec,
      minimumLengthSec: config.recording.autoRecord.minimumLengthSec,
    },
    appearance: config.app.theme,
    minimizeToTray: config.app.minimizeToTray,
    startWithWindows: config.app.launchAtLogin,
    advanced: {
      bufferSizeMs: config.capture.bufferMs,
      crashRecovery: config.recovery.keepIncompleteRecordings,
      diagnosticLogging: config.diagnostics.enabled,
    },
  };
}

export function settingsToConfig(
  settings: RecordingSettings,
  base: UnifiedAppConfig,
): UnifiedAppConfig {
  return {
    ...base,
    capture: {
      ...base.capture,
      backend: settings.captureBackend,
      asioDriverName: settings.asioDriverName,
      asioChannelPair: settings.asioChannelPair,
      devicePolicy: settings.followWindowsDefault ? "follow_windows_default" : "specific_device",
      deviceId: settings.followWindowsDefault ? null : settings.outputDeviceId,
      container: "wav",
      sampleRateHz: settings.sampleRate,
      bitDepth: settings.bitDepth,
      channels: 2,
      bufferMs: settings.advanced.bufferSizeMs,
      onDeviceChange:
        settings.deviceChangeBehavior === "STOP"
          ? "stop_and_notify"
          : settings.deviceChangeBehavior === "SWITCH"
            ? "switch_to_default"
            : "continue_on_old_device",
    },
    recording: {
      folder: settings.folder,
      filenameTemplate: settings.filenameTemplate,
      autoRecord: {
        enabled: settings.autoRecord.enabled,
        startThresholdDbfs: settings.autoRecord.startThresholdDb,
        stopAfterSilenceSec: settings.autoRecord.stopAfterSilenceSec,
        minimumLengthSec: settings.autoRecord.minimumLengthSec,
      },
    },
    app: {
      theme: settings.appearance,
      minimizeToTray: settings.minimizeToTray,
      launchAtLogin: settings.startWithWindows,
    },
    recovery: { keepIncompleteRecordings: settings.advanced.crashRecovery },
    diagnostics: { enabled: settings.advanced.diagnosticLogging },
  };
}

/** Merge only valid legacy values over native defaults; unsupported formats/modes become WAV/default. */
export function mergeLegacySettings(
  raw: string,
  nativeConfig: UnifiedAppConfig,
): RecordingSettings {
  try {
    const old = JSON.parse(raw) as Partial<RecordingSettings>;
    const base = configToSettings(nativeConfig);
    const auto: Partial<RecordingSettings["autoRecord"]> =
      old.autoRecord && typeof old.autoRecord === "object" ? old.autoRecord : {};
    const advanced: Partial<RecordingSettings["advanced"]> =
      old.advanced && typeof old.advanced === "object" ? old.advanced : {};
    const format = "WAV" as const;
    const policyIsFollow = old.followWindowsDefault !== false;
    const legacyDeviceId =
      typeof old.outputDeviceId === "string" && old.outputDeviceId.trim()
        ? old.outputDeviceId
        : null;
    const followDefault = policyIsFollow || legacyDeviceId === null;
    const legacyFolder =
      typeof old.folder === "string" && old.folder.trim() && !old.folder.includes("\0")
        ? old.folder
        : base.folder;
    const invalidFilenameCharacter = /[\\/:*?"<>|]/;
    const legacyTemplate =
      typeof old.filenameTemplate === "string" &&
      old.filenameTemplate.trim() &&
      !invalidFilenameCharacter.test(old.filenameTemplate) &&
      !Array.from(old.filenameTemplate).some((character) => character.charCodeAt(0) < 32)
        ? old.filenameTemplate
        : base.filenameTemplate;
    return {
      ...base,
      format,
      sampleRate:
        old.sampleRate === 44100 ? 44100 : old.sampleRate === 48000 ? 48000 : base.sampleRate,
      bitDepth: old.bitDepth === 16 ? 16 : old.bitDepth === 24 ? 24 : base.bitDepth,
      folder: legacyFolder,
      filenameTemplate: legacyTemplate,
      followWindowsDefault: followDefault,
      outputDeviceId: followDefault ? null : legacyDeviceId,
      deviceChangeBehavior:
        old.deviceChangeBehavior === "STOP" || old.deviceChangeBehavior === "SWITCH"
          ? old.deviceChangeBehavior
          : "CONTINUE",
      autoRecord: {
        enabled: typeof auto.enabled === "boolean" ? auto.enabled : base.autoRecord.enabled,
        startThresholdDb: bounded(auto.startThresholdDb, base.autoRecord.startThresholdDb, -80, 0),
        stopAfterSilenceSec: bounded(
          auto.stopAfterSilenceSec,
          base.autoRecord.stopAfterSilenceSec,
          1,
          3600,
        ),
        minimumLengthSec: bounded(
          auto.minimumLengthSec,
          base.autoRecord.minimumLengthSec,
          0,
          86400,
        ),
      },
      appearance:
        old.appearance === "light" ? "light" : old.appearance === "dark" ? "dark" : base.appearance,
      minimizeToTray:
        typeof old.minimizeToTray === "boolean" ? old.minimizeToTray : base.minimizeToTray,
      startWithWindows:
        typeof old.startWithWindows === "boolean" ? old.startWithWindows : base.startWithWindows,
      advanced: {
        bufferSizeMs: bounded(advanced.bufferSizeMs, base.advanced.bufferSizeMs, 20, 1000),
        crashRecovery:
          typeof advanced.crashRecovery === "boolean"
            ? advanced.crashRecovery
            : base.advanced.crashRecovery,
        diagnosticLogging:
          typeof advanced.diagnosticLogging === "boolean"
            ? advanced.diagnosticLogging
            : base.advanced.diagnosticLogging,
      },
    };
  } catch {
    return configToSettings(nativeConfig);
  }
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
