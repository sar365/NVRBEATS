/**
 * TAURI ADAPTER — thin transport to the native Windows engine.
 *
 * TODO (native, Rust side). Each method below maps 1:1 to a Tauri command that
 * must be implemented in the Windows desktop build:
 *
 *   get_default_output_device   -> IMMDeviceEnumerator::GetDefaultAudioEndpoint(eRender, eConsole)
 *   get_output_devices          -> enumerate eRender endpoints
 *   get_current_output_device   -> device in use by the active capture stream
 *   start_recording             -> WASAPI loopback client + bounded ring buffer + async WAV writer
 *   stop_recording              -> drain buffer, patch RIFF header, fsync, close
 *   get_recording_status        -> state machine snapshot (authoritative)
 *   get_recording_duration      -> frames written / sample rate
 *   get_recording_file_size     -> bytes on disk
 *   get_recording_path          -> current target path
 *   get_audio_levels            -> peak L/R computed in the capture thread
 *   get_disk_space              -> GetDiskFreeSpaceEx on the recording volume
 *   recover_recording           -> repair .part file header into a playable WAV
 *   discard_recovery            -> user-confirmed delete only
 *   open_recording_folder       -> ShellExecute explorer.exe
 *   choose_recording_folder     -> native folder dialog
 *   play_recording              -> native playback
 *   convert_recording           -> bundled FFmpeg (local only, never cloud)
 *   delete_recording_file       -> move to Recycle Bin
 *
 * Also native-only: system tray, background operation while minimized,
 * Windows notifications, start-with-Windows, default-device change monitoring.
 */
import type { NativeAudioBridge } from "./bridge";
import type {
  AudioLevels,
  ConversionRequest,
  DiskSpace,
  ExportRequest,
  OutputDevice,
  RecordingSettings,
  RecordingStatus,
  TrimRequest,
} from "./types";

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

function getInvoke(): Invoke {
  const tauri = (globalThis as unknown as { __TAURI__?: { core?: { invoke?: Invoke } } }).__TAURI__;
  const invoke = tauri?.core?.invoke;
  if (!invoke) throw new Error("Tauri runtime not available");
  return invoke;
}

export class TauriAudioBridge implements NativeAudioBridge {
  readonly isNative = true;
  readonly adapterName = "Native Windows Engine (Tauri)";

  private call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    return getInvoke()(cmd, args) as Promise<T>;
  }

  getDefaultOutputDevice = () => this.call<OutputDevice | null>("get_default_output_device");
  getOutputDevices = () => this.call<OutputDevice[]>("get_output_devices");
  getCurrentOutputDevice = () => this.call<OutputDevice | null>("get_current_output_device");

  startRecording = (settings: RecordingSettings) =>
    this.call<RecordingStatus>("start_recording", { settings });
  stopRecording = () => this.call<RecordingStatus>("stop_recording");

  getRecordingStatus = () => this.call<RecordingStatus>("get_recording_status");
  getRecordingDuration = () => this.call<number>("get_recording_duration");
  getRecordingFileSize = () => this.call<number>("get_recording_file_size");
  getRecordingPath = () => this.call<string | null>("get_recording_path");
  getAudioLevels = () => this.call<AudioLevels>("get_audio_levels");
  getInputAudioLevels = () => this.call<AudioLevels>("get_input_audio_levels");

  getDiskSpace = () => this.call<DiskSpace>("get_disk_space");
  getFolderDiskSpace = (folder: string) =>
    this.call<DiskSpace>("get_folder_disk_space", { folder });
  checkLoopbackAccess = (sampleRate: number) =>
    this.call<string>("check_loopback_access", { sampleRate });
  recoverRecording = () => this.call<RecordingStatus>("recover_recording");
  discardRecovery = () => this.call<RecordingStatus>("discard_recovery");

  openRecordingFolder = (path?: string) => this.call<void>("open_recording_folder", { path });
  chooseRecordingFolder = () => this.call<string | null>("choose_recording_folder");
  playRecording = (path: string) => this.call<void>("play_recording", { path });
  convertRecording = (request: ConversionRequest) =>
    this.call<{ outputPath: string }>("convert_recording", { request });
  deleteRecordingFile = (path: string) => this.call<void>("delete_recording_file", { path });
  trimRecording = (request: TrimRequest) =>
    this.call<{ path: string; durationSec: number; fileSizeBytes: number }>("trim_recording", {
      request,
    });
  exportRecording = (request: ExportRequest) =>
    this.call<{ outputPath: string }>("export_recording", { request });
  syncSettings = (settings: RecordingSettings) => this.call<void>("set_settings", { settings });
  minimizeWindow = () => this.call<void>("minimize_window");
  restoreWindow = () => this.call<void>("restore_window");
}
