//! NVRBEATS — native Windows engine.
//!
//! Capture path: Traktor Pro 4 -> Windows Audio -> selected render endpoint
//!               -> WASAPI loopback -> local recorder -> WAV on disk.
//! No Web Audio, no microphone, no cloud.

pub mod capture;
pub mod commands;
pub mod config;
pub mod devices;
pub mod disk;
pub mod state;
pub mod tray;
pub mod wav;

use capture::Engine;
use config::{AppConfig, ConfigLoadResponse, ConfigStore};
use parking_lot::Mutex;
use state::RecordingSettings;
use std::sync::Arc;
use tauri::{AppHandle, Manager, Runtime, WindowEvent};

/// Settings last pushed down by the UI, used by tray-initiated recordings.
pub struct LastSettings(pub Mutex<RecordingSettings>);

pub fn default_settings() -> RecordingSettings {
    AppConfig::default().to_recording_settings()
}

pub fn last_settings<R: Runtime>(app: &AppHandle<R>) -> RecordingSettings {
    app.try_state::<LastSettings>()
        .map(|s| s.0.lock().clone())
        .unwrap_or_else(default_settings)
}

#[cfg(windows)]
fn output_device_id_is_available(id: &str) -> Option<bool> {
    let id = id.to_owned();
    std::thread::spawn(move || {
        if wasapi::initialize_mta().ok().is_err() {
            return None;
        }
        match devices::output_device_by_id(&id) {
            Ok(_) => Some(true),
            Err(error)
                if error.starts_with(&format!("Output device endpoint is unavailable: {id}")) =>
            {
                Some(false)
            }
            Err(error) => {
                log::warn!("Could not verify saved output endpoint {id}: {error}");
                None
            }
        }
    })
    .join()
    .unwrap_or(None)
}

#[tauri::command]
fn get_unified_config(store: tauri::State<'_, ConfigStore>) -> ConfigLoadResponse {
    store.load_state()
}

#[tauri::command]
fn save_unified_config(
    store: tauri::State<'_, ConfigStore>,
    last_settings: tauri::State<'_, LastSettings>,
    engine: tauri::State<'_, Arc<Engine>>,
    config: AppConfig,
) -> Result<(), String> {
    config.validate()?;
    let recording_settings = config.to_recording_settings();
    store.save(config.clone())?;
    if engine.active.lock().is_none() {
        engine.apply_capture_settings(&recording_settings)?;
    }
    *last_settings.0.lock() = recording_settings;
    Ok(())
}

/// Compatibility bridge for the existing UI while it migrates from WebView
/// localStorage to get_unified_config/save_unified_config.
#[tauri::command]
fn set_settings(
    state: tauri::State<'_, LastSettings>,
    store: tauri::State<'_, ConfigStore>,
    engine: tauri::State<'_, Arc<Engine>>,
    settings: RecordingSettings,
) -> Result<(), String> {
    let mut config = store.get();
    config.apply_legacy_settings(&settings)?;
    config.validate()?;
    store.save(config)?;
    if engine.active.lock().is_none() {
        engine.apply_capture_settings(&settings)?;
    }
    *state.0.lock() = settings;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let engine: Arc<Engine> = Engine::new();
    let config_store = ConfigStore::open_default();
    if let Some(warning) = config_store.warning() {
        log::warn!("Configuration load warning: {warning}");
    }
    let mut startup_config = config_store.get();
    #[cfg(windows)]
    if let Some(unavailable_id) =
        startup_config.follow_windows_default_if_unavailable(output_device_id_is_available)
    {
        log::warn!(
            "Saved output endpoint is unavailable at startup; switching to Follow Windows Default. Endpoint id: {unavailable_id}"
        );
        if let Err(error) = config_store.save(startup_config.clone()) {
            log::warn!("Could not persist the startup output-device fallback: {error}");
            if let Err(runtime_error) = config_store.set_runtime_config(startup_config.clone()) {
                log::error!("Could not apply the runtime output-device fallback: {runtime_error}");
            }
        }
    }
    let settings = startup_config.to_recording_settings();

    let portable_data_dir = config::portable_data_dir();
    let mut context = tauri::generate_context!();
    if portable_data_dir.is_some() {
        if let Some(window) = context.config_mut().app.windows.first_mut() {
            window.create = false;
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(engine.clone())
        .manage(LastSettings(Mutex::new(settings.clone())))
        .manage(config_store)
        .setup(move |app| {
            if let Some(portable_data_dir) = &portable_data_dir {
                std::fs::create_dir_all(portable_data_dir)?;
                let webview_data_dir = portable_data_dir.join("webview");
                std::fs::create_dir_all(&webview_data_dir)?;
                let window_config = app
                    .config()
                    .app
                    .windows
                    .first()
                    .ok_or("NVRBEATS requires a configured main window")?;
                tauri::WebviewWindowBuilder::from_config(app, window_config)?
                    .data_directory(webview_data_dir)
                    .build()?;
            }

            tray::build(app.handle())?;

            if let Err(error) = engine.apply_capture_settings(&settings) {
                log::error!("Unable to apply persisted audio capture settings: {error}");
            }

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
            get_unified_config,
            save_unified_config,
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
        .run(context)
        .expect("failed to start NVRBEATS");
}
