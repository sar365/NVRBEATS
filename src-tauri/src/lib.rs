//! NVRBEATS — native Windows engine.
//!
//! Capture path: Traktor Pro 4 -> Windows Audio -> PC Default Output
//!               -> WASAPI loopback -> local recorder -> WAV on disk.
//! No Web Audio, no microphone, no cloud.

pub mod capture;
pub mod commands;
pub mod devices;
pub mod disk;
pub mod state;
pub mod tray;
pub mod wav;

use capture::Engine;
use parking_lot::Mutex;
use state::{AdvancedSettings, AutoRecordSettings, RecordingSettings};
use std::sync::Arc;
use tauri::{AppHandle, Manager, Runtime, WindowEvent};

/// Settings last pushed down by the UI, used by tray-initiated recordings.
pub struct LastSettings(pub Mutex<RecordingSettings>);

pub fn default_settings() -> RecordingSettings {
    let folder = dirs_music_folder();
    RecordingSettings {
        format: "WAV".into(),
        sample_rate: 48_000,
        bit_depth: 24,
        folder,
        filename_template: "{date} {time} {set}".into(),
        follow_windows_default: true,
        device_change_behavior: "CONTINUE".into(),
        auto_record: AutoRecordSettings {
            enabled: false,
            start_threshold_db: -40.0,
            stop_after_silence_sec: 20.0,
            minimum_length_sec: 60.0,
        },
        appearance: "dark".into(),
        minimize_to_tray: true,
        start_with_windows: false,
        advanced: AdvancedSettings {
            buffer_size_ms: 200,
            crash_recovery: true,
            diagnostic_logging: false,
        },
    }
}

fn dirs_music_folder() -> String {
    if let Ok(profile) = std::env::var("USERPROFILE") {
        // Keep the existing folder so users upgrading from DJ Set Recorder
        // continue to see their recordings in the library.
        format!("{profile}\\Music\\DJ Set Recorder")
    } else {
        "Recordings".into()
    }
}

pub fn last_settings<R: Runtime>(app: &AppHandle<R>) -> RecordingSettings {
    app.try_state::<LastSettings>()
        .map(|s| s.0.lock().clone())
        .unwrap_or_else(default_settings)
}

#[tauri::command]
fn set_settings(state: tauri::State<'_, LastSettings>, settings: RecordingSettings) {
    *state.0.lock() = settings;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let engine: Arc<Engine> = Engine::new();
    let settings = default_settings();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(engine.clone())
        .manage(LastSettings(Mutex::new(settings.clone())))
        .setup(move |app| {
            tray::build(app.handle())?;

            // Look for a `.part` file left behind by a crash before doing anything else.
            engine.scan_recovery(std::path::Path::new(&settings.folder));

            // The loopback capture thread runs continuously so the input meter
            // is live before the user presses record.
            capture::spawn_capture_thread(engine.clone());

            // Keep the tray tooltip in sync with the state machine.
            let handle = app.handle().clone();
            let engine_for_tray = engine.clone();
            std::thread::spawn(move || loop {
                let state = *engine_for_tray.state.lock();
                tray::update_tooltip(&handle, state);
                std::thread::sleep(std::time::Duration::from_millis(1000));
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window keeps the recording running in the tray.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            set_settings,
            commands::get_default_output_device,
            commands::get_output_devices,
            commands::get_current_output_device,
            commands::start_recording,
            commands::stop_recording,
            commands::get_recording_status,
            commands::get_recording_duration,
            commands::get_recording_file_size,
            commands::get_recording_path,
            commands::get_audio_levels,
            commands::get_input_audio_levels,
            commands::get_disk_space,
            commands::get_folder_disk_space,
            commands::check_loopback_access,
            commands::recover_recording,
            commands::discard_recovery,
            commands::open_recording_folder,
            commands::choose_recording_folder,
            commands::play_recording,
            commands::delete_recording_file,
            commands::trim_recording,
            commands::export_recording,
            commands::convert_recording,
            commands::minimize_window,
            commands::restore_window,
        ])
        .run(tauri::generate_context!())
        .expect("failed to start NVRBEATS");
}
