/**
 * Preflight — checks run before a recording starts:
 *   1. Windows default audio output is present and connected
 *   2. WASAPI loopback can be opened on it (shared mode)
 *   3. Enough free disk space in the recording folder
 */
import type { NativeAudioBridge } from "@/lib/native/bridge";
import type { RecordingSettings } from "@/lib/native/types";
import { formatBytes } from "@/lib/format";

export type CheckStatus = "pass" | "warn" | "fail";
export interface PreflightCheck {
  id: "output" | "wasapi" | "disk";
  label: string;
  status: CheckStatus;
  detail: string;
}
export interface PreflightReport {
  checks: PreflightCheck[];
  ok: boolean;
  checkedAt: string;
}

/** Bytes per hour of uncompressed stereo PCM at the chosen spec. */
export function bytesPerHour(s: RecordingSettings) {
  return s.sampleRate * 2 * (s.bitDepth / 8) * 3600;
}

export async function runPreflight(
  bridge: NativeAudioBridge,
  settings: RecordingSettings,
): Promise<PreflightReport> {
  const checks: PreflightCheck[] = [];

  // 1. Output device
  let deviceOk = false;
  try {
    const device = settings.followWindowsDefault
      ? await bridge.getDefaultOutputDevice()
      : ((await bridge.getOutputDevices()).find(
          (candidate) => candidate.id === settings.outputDeviceId,
        ) ?? null);
    deviceOk = !!device && device.status === "CONNECTED";
    checks.push({
      id: "output",
      label: settings.followWindowsDefault ? "Windows audio output" : "Selected audio output",
      status: deviceOk ? "pass" : "fail",
      detail: device
        ? deviceOk
          ? settings.followWindowsDefault
            ? `${device.name} is the default output.`
            : `${device.name} is selected and connected.`
          : `${device.name} is disconnected. Reconnect it or select another output device.`
        : settings.followWindowsDefault
          ? "No default playback device found. Set one in Windows Sound settings."
          : "The selected output device is unavailable. Choose another device or follow the Windows default.",
    });
  } catch (e) {
    checks.push({ id: "output", label: "Windows audio output", status: "fail", detail: String(e) });
  }

  // 2. WASAPI loopback
  if (!deviceOk) {
    checks.push({
      id: "wasapi",
      label: "WASAPI loopback access",
      status: "fail",
      detail: "Skipped — needs a working audio output first.",
    });
  } else {
    try {
      const msg = await bridge.checkLoopbackAccess(
        settings.sampleRate,
        settings.followWindowsDefault ? null : settings.outputDeviceId,
      );
      checks.push({ id: "wasapi", label: "WASAPI loopback access", status: "pass", detail: msg });
    } catch (e) {
      checks.push({
        id: "wasapi",
        label: "WASAPI loopback access",
        status: "fail",
        detail: `Could not open loopback: ${String(e)}. Close apps using the output in exclusive mode (e.g. Traktor on ASIO) and try again.`,
      });
    }
  }

  // 3. Disk space
  try {
    const { freeBytes, totalBytes } = await bridge.getFolderDiskSpace(settings.folder);
    const perHour = bytesPerHour(settings);
    const hours = freeBytes / perHour;
    const status: CheckStatus =
      totalBytes === 0 ? "warn" : hours < 0.5 ? "fail" : hours < 3 ? "warn" : "pass";
    checks.push({
      id: "disk",
      label: "Disk space",
      status,
      detail:
        totalBytes === 0
          ? "Could not read free space for the recording folder."
          : `${formatBytes(freeBytes)} free — about ${hours >= 10 ? Math.floor(hours) : hours.toFixed(1)} h of recording at ${formatBytes(perHour)}/h.${status === "fail" ? " Free up space or choose another folder." : ""}`,
    });
  } catch (e) {
    checks.push({ id: "disk", label: "Disk space", status: "warn", detail: String(e) });
  }

  return {
    checks,
    ok: checks.every((c) => c.status !== "fail"),
    checkedAt: new Date().toISOString(),
  };
}
