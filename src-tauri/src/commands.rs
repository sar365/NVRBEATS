//! Tauri commands — the exact surface the frontend's NativeAudioBridge calls.

use crate::capture::Engine;
use crate::devices;
use crate::state::*;
use crate::wav;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

pub type Shared = Arc<Engine>;

#[tauri::command]
pub fn get_default_output_device() -> Option<OutputDevice> {
    devices::default_output_device()
}

#[tauri::command]
pub fn get_output_devices() -> Vec<OutputDevice> {
    devices::output_devices()
}

#[tauri::command]
pub fn get_current_output_device() -> Option<OutputDevice> {
    devices::default_output_device()
}

#[tauri::command]
pub fn start_recording(
    engine: State<'_, Shared>,
    settings: RecordingSettings,
) -> Result<RecordingStatus, String> {
    let folder = PathBuf::from(&settings.folder);
    let filename = render_filename(&settings);
    let target = folder.join(filename);
    engine.start(&settings, target)?;
    Ok(engine.status())
}

#[tauri::command]
pub fn stop_recording(engine: State<'_, Shared>) -> Result<RecordingStatus, String> {
    engine.stop()
}

#[tauri::command]
pub fn get_recording_status(engine: State<'_, Shared>) -> RecordingStatus {
    engine.status()
}

#[tauri::command]
pub fn get_recording_duration(engine: State<'_, Shared>) -> f64 {
    engine.status().duration_sec
}

#[tauri::command]
pub fn get_recording_file_size(engine: State<'_, Shared>) -> u64 {
    engine.status().file_size_bytes
}

#[tauri::command]
pub fn get_recording_path(engine: State<'_, Shared>) -> Option<String> {
    engine.status().path
}

#[tauri::command]
pub fn get_audio_levels(engine: State<'_, Shared>) -> AudioLevels {
    engine.meters.output()
}

#[tauri::command]
pub fn get_input_audio_levels(engine: State<'_, Shared>) -> AudioLevels {
    engine.meters.input()
}

#[tauri::command]
pub fn get_disk_space(engine: State<'_, Shared>) -> DiskSpace {
    let path = engine
        .last_path
        .lock()
        .clone()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("C:\\"));
    crate::disk::disk_space(&path)
}

#[tauri::command]
pub fn recover_recording(engine: State<'_, Shared>) -> Result<RecordingStatus, String> {
    let recovery = engine.recovery.lock().clone();
    if let Some(recovery) = recovery {
        let spec = hound::WavSpec {
            channels: 2,
            sample_rate: *engine.sample_rate.lock(),
            bits_per_sample: *engine.bit_depth.lock(),
            sample_format: hound::SampleFormat::Int,
        };
        let repaired = wav::repair_part_file(&PathBuf::from(&recovery.path), spec)?;
        *engine.last_path.lock() = Some(repaired);
        *engine.recovery.lock() = None;
        engine.set_state(RecorderState::Completed);
    }
    Ok(engine.status())
}

#[tauri::command]
pub fn discard_recovery(engine: State<'_, Shared>) -> Result<RecordingStatus, String> {
    let recovery = engine.recovery.lock().take();
    if let Some(recovery) = recovery {
        let _ = std::fs::remove_file(recovery.path);
    }
    engine.set_state(RecorderState::Ready);
    Ok(engine.status())
}

#[tauri::command]
pub fn open_recording_folder(app: AppHandle, path: Option<String>) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let target = path.unwrap_or_else(|| ".".into());
    let target = PathBuf::from(target);
    let folder = if target.is_dir() {
        target
    } else {
        target.parent().map(|p| p.to_path_buf()).unwrap_or(target)
    };
    app.opener()
        .open_path(folder.display().to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn choose_recording_folder(app: AppHandle) -> Option<String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file().pick_folder(move |folder| {
        let _ = tx.send(folder.map(|f| f.to_string()));
    });
    rx.recv().ok().flatten()
}

#[tauri::command]
pub fn play_recording(app: AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_path(path, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_recording_file(path: String) -> Result<(), String> {
    std::fs::remove_file(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn trim_recording(request: TrimRequest) -> Result<TrimResult, String> {
    wav::trim(&request)
}

#[tauri::command]
pub fn export_recording(request: ExportRequest) -> Result<ExportResult, String> {
    wav::export(&request)
}

#[tauri::command]
pub fn convert_recording(request: serde_json::Value) -> Result<ExportResult, String> {
    // Format conversion (FLAC/MP3/AAC) requires the bundled local FFmpeg build.
    // WAV is written natively; other formats are not converted yet.
    let path = request
        .get("filepath")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();
    Err(format!("Conversion is not available yet for {path}"))
}

#[tauri::command]
pub fn minimize_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn restore_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    Ok(())
}

/// Mirrors the frontend filename template: {date} {time} {artist} {set}.
fn render_filename(settings: &RecordingSettings) -> String {
    let now = chrono::Local::now();
    let name = settings
        .filename_template
        .replace("{date}", &now.format("%Y-%m-%d").to_string())
        .replace("{time}", &now.format("%H-%M-%S").to_string())
        .replace("{artist}", "")
        .replace("{set}", "Set")
        .trim()
        .to_string();
    let name = if name.is_empty() { now.format("%Y-%m-%d %H-%M-%S").to_string() } else { name };
    let sanitized: String = name
        .chars()
        .map(|c| if "\\/:*?\"<>|".contains(c) { '-' } else { c })
        .collect();
    format!("{sanitized}.wav")
}
