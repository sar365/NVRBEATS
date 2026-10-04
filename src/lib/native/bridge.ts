/**
 * NativeAudioBridge — the boundary between this UI and the native Windows engine.
 *
 * Everything below MUST be implemented natively (Rust/Tauri + Windows APIs):
 *   - WASAPI loopback capture of the PC default output
 *   - Windows default-output detection and monitoring
 *   - bounded audio buffer + asynchronous WAV writer
 *   - background/system-tray operation
 *   - crash recovery of incomplete recordings
 *   - filesystem access, folder pickers, native playback, FFmpeg conversion
 *
 * The frontend never touches audio samples. It only sends commands and reads
 * lightweight status.
 */
import type {
  AudioLevels,
  ConversionRequest,
  DiskSpace,
  OutputDevice,
  ExportRequest,
  RecordingSettings,
  RecordingStatus,
  TrimRequest,
} from "./types";

export interface NativeAudioBridge {
  /** True only when a real native Windows engine is attached. */
  readonly isNative: boolean;
  readonly adapterName: string;

  getDefaultOutputDevice(): Promise<OutputDevice | null>;
  getOutputDevices(): Promise<OutputDevice[]>;
  getCurrentOutputDevice(): Promise<OutputDevice | null>;

  startRecording(settings: RecordingSettings): Promise<RecordingStatus>;
  stopRecording(): Promise<RecordingStatus>;

  getRecordingStatus(): Promise<RecordingStatus>;
  getRecordingDuration(): Promise<number>;
  getRecordingFileSize(): Promise<number>;
  getRecordingPath(): Promise<string | null>;
  getAudioLevels(): Promise<AudioLevels>;
  /** Live input (capture-side) preview levels, available even before recording. */
  getInputAudioLevels(): Promise<AudioLevels>;

  getDiskSpace(): Promise<DiskSpace>;
  /** Free space on the volume holding a specific folder. */
  getFolderDiskSpace(folder: string): Promise<DiskSpace>;
  /** Try opening (and releasing) a WASAPI loopback client. Rejects with the reason on failure. */
  checkLoopbackAccess(sampleRate: number): Promise<string>;
  recoverRecording(): Promise<RecordingStatus>;
  discardRecovery(): Promise<RecordingStatus>;

  openRecordingFolder(path?: string): Promise<void>;
  chooseRecordingFolder(): Promise<string | null>;
  playRecording(path: string): Promise<void>;
  convertRecording(request: ConversionRequest): Promise<{ outputPath: string }>;
  deleteRecordingFile(path: string): Promise<void>;
  /** Trim the finalized file to the chosen start/end points (native, lossless cut). */
  trimRecording(request: TrimRequest): Promise<{ path: string; durationSec: number; fileSizeBytes: number }>;
  /** Copy a recording to a folder the user picked. */
  exportRecording(request: ExportRequest): Promise<{ outputPath: string }>;
  /** Push the current settings down so tray-started recordings match the UI. */
  syncSettings?(settings: RecordingSettings): Promise<void>;
  /** Window control for keyboard shortcuts (native tray/window). */
  minimizeWindow(): Promise<void>;
  restoreWindow(): Promise<void>;
}
