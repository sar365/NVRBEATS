/**
 * DEVELOPMENT MOCK ADAPTER — NOT A RECORDER.
 *
 * This adapter exists ONLY so the interface can be previewed in a browser.
 * It does not capture, encode, or write any audio. No WASAPI, no microphone,
 * no system audio. Every level value it returns is synthetic.
 *
 * Replace with the Tauri adapter when the native Windows engine is present.
 */
import type { NativeAudioBridge } from "./bridge";
import type {
  AudioLevels,
  ConversionRequest,
  DiskSpace,
  OutputDevice,
  RecordingSettings,
  RecordingStatus,
} from "./types";

const MOCK_DEVICES: OutputDevice[] = [
  { id: "mock-realtek", name: "Speakers (Realtek(R) Audio)", isDefault: true, status: "CONNECTED" },
  { id: "mock-headphones", name: "Headphones (2- HD 25)", isDefault: false, status: "CONNECTED" },
  { id: "mock-hdmi", name: "LG TV (NVIDIA High Definition Audio)", isDefault: false, status: "CONNECTED" },
];

function emptyStatus(): RecordingStatus {
  return {
    state: "READY",
    durationSec: 0,
    fileSizeBytes: 0,
    path: null,
    device: MOCK_DEVICES[0],
    error: null,
    deviceChange: null,
    recovery: null,
  };
}

class MockNativeAudioBridge implements NativeAudioBridge {
  readonly isNative = false;
  readonly adapterName = "Development Mock Adapter";

  private status: RecordingStatus = emptyStatus();
  private startedAt = 0;

  async getDefaultOutputDevice() {
    return MOCK_DEVICES.find((d) => d.isDefault) ?? null;
  }

  async getOutputDevices() {
    return MOCK_DEVICES;
  }

  async getCurrentOutputDevice() {
    return this.getDefaultOutputDevice();
  }

  async startRecording(settings: RecordingSettings): Promise<RecordingStatus> {
    this.status = { ...emptyStatus(), state: "STARTING" };
    await delay(450);
    this.startedAt = Date.now();
    const stamp = new Date().toISOString().slice(0, 19).replace("T", " ").replace(/:/g, "-");
    this.status = {
      ...this.status,
      state: "RECORDING",
      path: `${settings.folder}\\DJ Set - ${stamp}.${settings.format.toLowerCase()}`,
    };
    return this.snapshot();
  }

  async stopRecording(): Promise<RecordingStatus> {
    this.status = { ...this.snapshot(), state: "STOPPING" };
    await delay(300);
    this.status = { ...this.status, state: "FINALIZING" };
    await delay(600);
    this.status = { ...this.status, state: "COMPLETED" };
    this.startedAt = 0;
    return this.status;
  }

  async getRecordingStatus() {
    return this.snapshot();
  }

  async getRecordingDuration() {
    return this.snapshot().durationSec;
  }

  async getRecordingFileSize() {
    return this.snapshot().fileSizeBytes;
  }

  async getRecordingPath() {
    return this.status.path;
  }

  /** Development Mock Audio Levels — synthetic, not measured. */
  async getAudioLevels(): Promise<AudioLevels> {
    if (this.status.state !== "RECORDING") return { left: 0, right: 0, mock: true };
    const t = Date.now() / 1000;
    const pulse = 0.62 + 0.22 * Math.sin(t * 3.1) + 0.08 * Math.sin(t * 11.7);
    return {
      left: clamp(pulse + 0.05 * Math.sin(t * 7.3)),
      right: clamp(pulse + 0.05 * Math.cos(t * 6.1)),
      mock: true,
    };
  }

  async getDiskSpace(): Promise<DiskSpace> {
    return { freeBytes: 214_000_000_000, totalBytes: 1_000_000_000_000 };
  }

  async recoverRecording() {
    this.status = { ...this.status, recovery: null, state: "COMPLETED" };
    return this.status;
  }

  async discardRecovery() {
    this.status = { ...this.status, recovery: null, state: "READY" };
    return this.status;
  }

  async openRecordingFolder() {
    notNative("openRecordingFolder");
  }

  async chooseRecordingFolder() {
    notNative("chooseRecordingFolder");
    return null;
  }

  async playRecording() {
    notNative("playRecording");
  }

  async convertRecording(request: ConversionRequest) {
    await delay(900);
    return { outputPath: request.filepath.replace(/\.[^.]+$/, `.${request.format.toLowerCase()}`) };
  }

  async deleteRecordingFile() {
    notNative("deleteRecordingFile");
  }

  /** Simulate-only helpers used by the labelled Development Mode controls. */
  simulateError(status: Partial<RecordingStatus>) {
    this.status = { ...this.status, ...status };
  }

  simulateRecoveryAvailable() {
    this.status = {
      ...emptyStatus(),
      state: "RECOVERY_AVAILABLE",
      recovery: {
        path: "C:\\Users\\DJ\\Music\\DJ Sets\\DJ Set - 2026-08-12 - 23-14-02.wav.part",
        startedAt: new Date(Date.now() - 5_400_000).toISOString(),
        durationSec: 4821,
        fileSizeBytes: 1_386_000_000,
      },
    };
  }

  reset() {
    this.status = emptyStatus();
    this.startedAt = 0;
  }

  private snapshot(): RecordingStatus {
    if (this.status.state !== "RECORDING") return this.status;
    const durationSec = (Date.now() - this.startedAt) / 1000;
    // 48 kHz / 24-bit / stereo ≈ 288 kB per second.
    return { ...this.status, durationSec, fileSizeBytes: Math.round(durationSec * 288_000) };
  }
}

function clamp(v: number) {
  return Math.max(0, Math.min(1, v));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function notNative(fn: string) {
  console.warn(
    `[Development Mock Adapter] ${fn}() requires the native Windows engine. No action taken.`,
  );
}

export const mockBridge = new MockNativeAudioBridge();
export type { MockNativeAudioBridge };
