//! Shared, serializable state between the native engine and the UI.
//!
//! The frontend only ever reads these lightweight snapshots — never audio.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RecorderState {
    Ready,
    Starting,
    Recording,
    Stopping,
    Finalizing,
    Completed,
    Error,
    RecoveryAvailable,
    DeviceDisconnected,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OutputDevice {
    pub id: String,
    pub name: String,
    #[serde(rename = "isDefault")]
    pub is_default: bool,
    /// "CONNECTED" | "DISCONNECTED"
    pub status: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RecorderError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DeviceChangeEvent {
    pub previous: OutputDevice,
    pub next: OutputDevice,
    pub at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct IncompleteRecording {
    pub path: String,
    #[serde(rename = "startedAt")]
    pub started_at: String,
    #[serde(rename = "durationSec")]
    pub duration_sec: f64,
    #[serde(rename = "fileSizeBytes")]
    pub file_size_bytes: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RecordingStatus {
    pub state: RecorderState,
    #[serde(rename = "durationSec")]
    pub duration_sec: f64,
    #[serde(rename = "fileSizeBytes")]
    pub file_size_bytes: u64,
    pub path: Option<String>,
    pub device: Option<OutputDevice>,
    pub error: Option<RecorderError>,
    #[serde(rename = "deviceChange")]
    pub device_change: Option<DeviceChangeEvent>,
    pub recovery: Option<IncompleteRecording>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AudioLevels {
    pub left: f32,
    pub right: f32,
    /// Always false in the native build: these are real peaks from WASAPI.
    pub mock: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DiskSpace {
    #[serde(rename = "freeBytes")]
    pub free_bytes: u64,
    #[serde(rename = "totalBytes")]
    pub total_bytes: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AutoRecordSettings {
    pub enabled: bool,
    #[serde(rename = "startThresholdDb")]
    pub start_threshold_db: f32,
    #[serde(rename = "stopAfterSilenceSec")]
    pub stop_after_silence_sec: f32,
    #[serde(rename = "minimumLengthSec")]
    pub minimum_length_sec: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AdvancedSettings {
    #[serde(rename = "bufferSizeMs")]
    pub buffer_size_ms: u32,
    #[serde(rename = "crashRecovery")]
    pub crash_recovery: bool,
    #[serde(rename = "diagnosticLogging")]
    pub diagnostic_logging: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RecordingSettings {
    pub format: String,
    #[serde(rename = "sampleRate")]
    pub sample_rate: u32,
    #[serde(rename = "bitDepth")]
    pub bit_depth: u16,
    pub folder: String,
    #[serde(rename = "filenameTemplate")]
    pub filename_template: String,
    #[serde(rename = "followWindowsDefault")]
    pub follow_windows_default: bool,
    #[serde(rename = "deviceChangeBehavior")]
    pub device_change_behavior: String,
    #[serde(rename = "autoRecord")]
    pub auto_record: AutoRecordSettings,
    pub appearance: String,
    #[serde(rename = "minimizeToTray")]
    pub minimize_to_tray: bool,
    #[serde(rename = "startWithWindows")]
    pub start_with_windows: bool,
    pub advanced: AdvancedSettings,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TrimRequest {
    pub path: String,
    #[serde(rename = "startSec")]
    pub start_sec: f64,
    #[serde(rename = "endSec")]
    pub end_sec: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TrimResult {
    pub path: String,
    #[serde(rename = "durationSec")]
    pub duration_sec: f64,
    #[serde(rename = "fileSizeBytes")]
    pub file_size_bytes: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExportRequest {
    #[serde(rename = "recordingId")]
    pub recording_id: String,
    pub filepath: String,
    #[serde(rename = "destinationFolder")]
    pub destination_folder: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExportResult {
    #[serde(rename = "outputPath")]
    pub output_path: String,
}

/// Lock-free counters written by the capture/writer threads, read by commands.
#[derive(Default)]
pub struct Meters {
    input_left: AtomicU32,
    input_right: AtomicU32,
    output_left: AtomicU32,
    output_right: AtomicU32,
    pub frames_written: AtomicU64,
    pub bytes_written: AtomicU64,
}

fn store(cell: &AtomicU32, value: f32) {
    cell.store(value.to_bits(), Ordering::Relaxed);
}

fn load(cell: &AtomicU32) -> f32 {
    f32::from_bits(cell.load(Ordering::Relaxed))
}

impl Meters {
    pub fn set_input(&self, left: f32, right: f32) {
        store(&self.input_left, left);
        store(&self.input_right, right);
    }

    pub fn set_output(&self, left: f32, right: f32) {
        store(&self.output_left, left);
        store(&self.output_right, right);
    }

    pub fn input(&self) -> AudioLevels {
        AudioLevels { left: load(&self.input_left), right: load(&self.input_right), mock: false }
    }

    pub fn output(&self) -> AudioLevels {
        AudioLevels { left: load(&self.output_left), right: load(&self.output_right), mock: false }
    }

    pub fn reset_output(&self) {
        self.set_output(0.0, 0.0);
        self.frames_written.store(0, Ordering::Relaxed);
        self.bytes_written.store(0, Ordering::Relaxed);
    }
}
