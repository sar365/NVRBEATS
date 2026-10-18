//! System tray: start/stop a recording and reopen the window while Traktor plays.

use crate::capture::Engine;
use crate::state::{RecorderState, RecordingSettings};
use std::sync::Arc;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Runtime};

pub const TRAY_ID: &str = "dj-set-recorder-tray";

pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let start = MenuItem::with_id(app, "start", "Start recording", true, None::<&str>)?;
    let stop = MenuItem::with_id(app, "stop", "Stop recording", true, None::<&str>)?;
    let show = MenuItem::with_id(app, "show", "Open NVRBEATS", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[&start, &stop, &PredefinedMenuItem::separator(app)?, &show, &quit],
    )?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(app.default_window_icon().cloned().expect("bundled tray icon"))
        .tooltip("NVRBEATS — Ready")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "start" => start_from_tray(app),
            "stop" => {
                if let Some(engine) = app.try_state::<Arc<Engine>>() {
                    let _ = engine.stop();
                }
            }
            "show" => show_window(app),
            "quit" => {
                if let Some(engine) = app.try_state::<Arc<Engine>>() {
                    let _ = engine.stop();
                }
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_window(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

fn show_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// The tray uses the settings the UI last pushed down, so a tray start writes
/// to the same folder and format as the dashboard button.
fn start_from_tray<R: Runtime>(app: &AppHandle<R>) {
    let Some(engine) = app.try_state::<Arc<Engine>>() else { return };
    if *engine.state.lock() == RecorderState::Recording {
        return;
    }
    let settings: RecordingSettings = crate::last_settings(app);
    let folder = std::path::PathBuf::from(&settings.folder);
    let target = folder.join(format!(
        "{}.wav",
        chrono::Local::now().format("%Y-%m-%d %H-%M-%S")
    ));
    let _ = engine.start(&settings, target);
}

/// Keep the tray tooltip in sync with the recorder state.
pub fn update_tooltip<R: Runtime>(app: &AppHandle<R>, state: RecorderState) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let text = match state {
            RecorderState::Recording => "NVRBEATS — Recording",
            RecorderState::Error => "NVRBEATS — Error",
            _ => "NVRBEATS — Ready",
        };
        let _ = tray.set_tooltip(Some(text));
    }
}
