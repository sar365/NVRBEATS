/**
 * Shared domain types for the DJ Set Recorder.
 *
 * These types are the contract between the Lovable frontend (control center)
 * and the native Windows recording engine (the actual recorder).
 * Nothing here implies that the browser can capture audio.
 */

export type RecorderState =
  | "READY"
  | "STARTING"
  | "RECORDING"
  | "STOPPING"
  | "FINALIZING"
  | "COMPLETED"
  | "ERROR"
  | "RECOVERY_AVAILABLE"
  | "DEVICE_DISCONNECTED";

export type AudioFormat = "WAV" | "FLAC" | "MP3" | "AAC";
export type SampleRate = 44100 | 48000;
export type BitDepth = 16 | 24;

export type DeviceConnection = "CONNECTED" | "DISCONNECTED";

export interface OutputDevice {
  id: string;
  name: string;
  isDefault: boolean;
  status: DeviceConnection;
}

export interface AudioLevels {
  /** Peak level 0..1 for the left channel. */
  left: number;
  /** Peak level 0..1 for the right channel. */
  right: number;
  /** True when these values come from the development mock adapter. */
  mock: boolean;
}

export interface RecordingSettings {
  format: AudioFormat;
  sampleRate: SampleRate;
  bitDepth: BitDepth;
  folder: string;
  filenameTemplate: string;
  followWindowsDefault: boolean;
  deviceChangeBehavior: "CONTINUE" | "STOP" | "SWITCH";
  autoRecord: {
    enabled: boolean;
    /** dBFS threshold that starts a recording. */
    startThresholdDb: number;
    /** Seconds of silence before stopping. */
    stopAfterSilenceSec: number;
    /** Recordings shorter than this are discarded (seconds). */
    minimumLengthSec: number;
  };
  appearance: "dark" | "light";
  minimizeToTray: boolean;
  startWithWindows: boolean;
  advanced: {
    bufferSizeMs: number;
    crashRecovery: boolean;
    diagnosticLogging: boolean;
  };
}

export type RecorderErrorCode =
  | "NO_AUDIO_DEVICE"
  | "DEVICE_DISCONNECTED"
  | "DISK_FULL"
  | "NATIVE_ENGINE_UNAVAILABLE"
  | "RECORDING_FAILED";

export interface RecorderError {
  code: RecorderErrorCode;
  message: string;
  detail?: string;
}

export interface DeviceChangeEvent {
  previous: OutputDevice;
  next: OutputDevice;
  at: string;
}

export interface RecordingStatus {
  state: RecorderState;
  /** Authoritative duration in seconds, reported by the native recorder. */
  durationSec: number;
  /** Bytes written so far. */
  fileSizeBytes: number;
  /** Destination path of the in-progress or last recording. */
  path: string | null;
  device: OutputDevice | null;
  error: RecorderError | null;
  deviceChange: DeviceChangeEvent | null;
  /** Set when the native layer found an unfinished recording after a crash. */
  recovery: IncompleteRecording | null;
}

export interface IncompleteRecording {
  path: string;
  startedAt: string;
  durationSec: number;
  fileSizeBytes: number;
}

export interface DiskSpace {
  freeBytes: number;
  totalBytes: number;
}

/** Row shape of the local SQLite `recordings` table. */
export interface RecordingMeta {
  id: string;
  filename: string;
  filepath: string;
  artist: string;
  set_name: string;
  date: string;
  duration: number;
  format: AudioFormat;
  sample_rate: SampleRate;
  bit_depth: BitDepth;
  file_size: number;
  genre: string;
  location: string;
  notes: string;
  tags: string[];
  artwork_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversionRequest {
  recordingId: string;
  filepath: string;
  format: AudioFormat;
  quality: "HIGH" | "STANDARD" | "SMALL";
}
