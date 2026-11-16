//! Versioned, local configuration for NVRBEATS.
//!
//! The native process owns this file so tray-started recordings and UI-started
//! recordings share the same settings. No network access is required.

use crate::state::{AdvancedSettings, AutoRecordSettings, RecordingSettings};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

pub const CONFIG_SCHEMA_VERSION: u32 = 1;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DevicePolicy {
    FollowWindowsDefault,
    SpecificDevice,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeviceChangePolicy {
    StopAndNotify,
    SwitchToDefault,
    ContinueOnOldDevice,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AudioContainer {
    Wav,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Theme {
    Dark,
    Light,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileConfig {
    pub id: String,
    pub name: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureConfig {
    pub device_policy: DevicePolicy,
    pub device_id: Option<String>,
    pub container: AudioContainer,
    pub sample_rate_hz: u32,
    pub bit_depth: u16,
    pub channels: u16,
    /// Persisted advanced preference. The capture engine must explicitly apply
    /// this before the UI may describe it as an effective runtime buffer.
    pub buffer_ms: u32,
    pub on_device_change: DeviceChangePolicy,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoRecordConfig {
    pub enabled: bool,
    pub start_threshold_dbfs: f32,
    pub stop_after_silence_sec: f32,
    pub minimum_length_sec: f32,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingConfig {
    pub folder: String,
    pub filename_template: String,
    pub auto_record: AutoRecordConfig,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPreferences {
    pub theme: Theme,
    pub minimize_to_tray: bool,
    pub launch_at_login: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryConfig {
    pub keep_incomplete_recordings: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsConfig {
    pub enabled: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub schema_version: u32,
    pub profile: ProfileConfig,
    pub capture: CaptureConfig,
    pub recording: RecordingConfig,
    pub app: AppPreferences,
    pub recovery: RecoveryConfig,
    pub diagnostics: DiagnosticsConfig,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigLoadResponse {
    pub config: AppConfig,
    pub needs_legacy_migration: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            schema_version: CONFIG_SCHEMA_VERSION,
            profile: ProfileConfig {
                id: "default".into(),
                name: "Default".into(),
            },
            capture: CaptureConfig {
                device_policy: DevicePolicy::FollowWindowsDefault,
                device_id: None,
                container: AudioContainer::Wav,
                sample_rate_hz: 48_000,
                bit_depth: 24,
                channels: 2,
                buffer_ms: 200,
                on_device_change: DeviceChangePolicy::ContinueOnOldDevice,
            },
            recording: RecordingConfig {
                folder: default_recording_folder(),
                filename_template: "{date} {time} {setname}".into(),
                auto_record: AutoRecordConfig {
                    enabled: false,
                    start_threshold_dbfs: -40.0,
                    stop_after_silence_sec: 30.0,
                    minimum_length_sec: 60.0,
                },
            },
            app: AppPreferences {
                theme: Theme::Dark,
                minimize_to_tray: true,
                launch_at_login: false,
            },
            recovery: RecoveryConfig {
                keep_incomplete_recordings: true,
            },
            diagnostics: DiagnosticsConfig { enabled: false },
        }
    }
}

impl AppConfig {
    /// Switch an unavailable saved endpoint to Windows default without overriding a valid choice.
    pub fn follow_windows_default_if_unavailable(
        &mut self,
        is_available: impl FnOnce(&str) -> Option<bool>,
    ) -> Option<String> {
        if self.capture.device_policy != DevicePolicy::SpecificDevice {
            return None;
        }
        let id = self.capture.device_id.clone()?;
        if is_available(&id) != Some(false) {
            return None;
        }
        self.capture.device_policy = DevicePolicy::FollowWindowsDefault;
        self.capture.device_id = None;
        Some(id)
    }

    /// Validate semantic constraints before a configuration is used or saved.
    pub fn validate(&self) -> Result<(), String> {
        if self.schema_version != CONFIG_SCHEMA_VERSION {
            return Err(format!(
                "Unsupported config schema version {} (this build supports {}).",
                self.schema_version, CONFIG_SCHEMA_VERSION
            ));
        }
        if self.profile.id.trim().is_empty() || self.profile.id.len() > 80 {
            return Err("Profile id must contain 1–80 non-whitespace characters.".into());
        }
        if self.profile.name.trim().is_empty() || self.profile.name.chars().count() > 80 {
            return Err("Profile name must contain 1–80 non-whitespace characters.".into());
        }
        if self.capture.sample_rate_hz != 44_100 && self.capture.sample_rate_hz != 48_000 {
            return Err("Sample rate must be 44100 or 48000 Hz.".into());
        }
        if self.capture.bit_depth != 16 && self.capture.bit_depth != 24 {
            return Err("Bit depth must be 16 or 24.".into());
        }
        if self.capture.channels != 2 {
            return Err("Only stereo (2-channel) capture is currently supported.".into());
        }
        if !(20..=1000).contains(&self.capture.buffer_ms) {
            return Err("Buffer preference must be between 20 and 1000 ms.".into());
        }
        match &self.capture.device_policy {
            DevicePolicy::SpecificDevice => {
                if self
                    .capture
                    .device_id
                    .as_deref()
                    .unwrap_or_default()
                    .trim()
                    .is_empty()
                {
                    return Err(
                        "A device id is required when specific-device policy is selected.".into(),
                    );
                }
            }
            DevicePolicy::FollowWindowsDefault => {}
        }
        if self.recording.folder.trim().is_empty() || self.recording.folder.contains('\0') {
            return Err("Recording folder must not be empty or contain a NUL character.".into());
        }
        if self.recording.filename_template.trim().is_empty() {
            return Err("Filename template must not be empty.".into());
        }
        if self
            .recording
            .filename_template
            .chars()
            .any(|c| c.is_control() || ['<', '>', ':', '"', '/', '\\', '|', '?', '*'].contains(&c))
        {
            return Err(
                "Filename template contains a character that is not valid in a Windows filename."
                    .into(),
            );
        }
        let auto = &self.recording.auto_record;
        if !auto.start_threshold_dbfs.is_finite()
            || !(-80.0..=0.0).contains(&auto.start_threshold_dbfs)
        {
            return Err("Auto-record threshold must be between -80 and 0 dBFS.".into());
        }
        if !auto.stop_after_silence_sec.is_finite()
            || !(1.0..=3600.0).contains(&auto.stop_after_silence_sec)
        {
            return Err("Auto-stop silence duration must be between 1 and 3600 seconds.".into());
        }
        if !auto.minimum_length_sec.is_finite()
            || !(0.0..=86_400.0).contains(&auto.minimum_length_sec)
        {
            return Err("Minimum recording duration must be between 0 and 86400 seconds.".into());
        }
        Ok(())
    }

    /// Adapt the currently-supported parts of the unified schema to the legacy
    /// recording payload used by the existing capture commands and tray menu.
    pub fn to_recording_settings(&self) -> RecordingSettings {
        RecordingSettings {
            format: "WAV".into(),
            sample_rate: self.capture.sample_rate_hz,
            bit_depth: self.capture.bit_depth,
            folder: self.recording.folder.clone(),
            filename_template: self.recording.filename_template.clone(),
            follow_windows_default: self.capture.device_policy
                == DevicePolicy::FollowWindowsDefault,
            device_change_behavior: match &self.capture.on_device_change {
                DeviceChangePolicy::StopAndNotify => "STOP".into(),
                DeviceChangePolicy::SwitchToDefault => "SWITCH".into(),
                DeviceChangePolicy::ContinueOnOldDevice => "CONTINUE".into(),
            },
            auto_record: AutoRecordSettings {
                enabled: self.recording.auto_record.enabled,
                start_threshold_db: self.recording.auto_record.start_threshold_dbfs,
                stop_after_silence_sec: self.recording.auto_record.stop_after_silence_sec,
                minimum_length_sec: self.recording.auto_record.minimum_length_sec,
            },
            appearance: match &self.app.theme {
                Theme::Dark => "dark".into(),
                Theme::Light => "light".into(),
            },
            minimize_to_tray: self.app.minimize_to_tray,
            start_with_windows: self.app.launch_at_login,
            advanced: AdvancedSettings {
                buffer_size_ms: self.capture.buffer_ms,
                crash_recovery: self.recovery.keep_incomplete_recordings,
                diagnostic_logging: self.diagnostics.enabled,
            },
            output_device_id: self.capture.device_id.clone(),
        }
    }

    /// Merge settings currently emitted by the UI into the unified model.
    pub fn apply_legacy_settings(&mut self, settings: &RecordingSettings) -> Result<(), String> {
        if !settings.format.eq_ignore_ascii_case("WAV") {
            return Err(
                "Only WAV capture is currently implemented; choose WAV before saving settings."
                    .into(),
            );
        }
        if !settings.follow_windows_default
            && settings
                .output_device_id
                .as_deref()
                .unwrap_or_default()
                .trim()
                .is_empty()
        {
            return Err(
                "A device id is required when following the Windows default is disabled.".into(),
            );
        }
        self.capture.sample_rate_hz = settings.sample_rate;
        self.capture.bit_depth = settings.bit_depth;
        self.capture.device_policy = if settings.follow_windows_default {
            DevicePolicy::FollowWindowsDefault
        } else {
            DevicePolicy::SpecificDevice
        };
        self.capture.device_id = if settings.follow_windows_default {
            None
        } else {
            settings.output_device_id.clone()
        };
        self.capture.on_device_change = match settings.device_change_behavior.as_str() {
            "STOP" => DeviceChangePolicy::StopAndNotify,
            "SWITCH" => DeviceChangePolicy::SwitchToDefault,
            _ => DeviceChangePolicy::ContinueOnOldDevice,
        };
        self.capture.buffer_ms = settings.advanced.buffer_size_ms;
        self.recording.folder = settings.folder.clone();
        self.recording.filename_template = settings.filename_template.clone();
        self.recording.auto_record = AutoRecordConfig {
            enabled: settings.auto_record.enabled,
            start_threshold_dbfs: settings.auto_record.start_threshold_db,
            stop_after_silence_sec: settings.auto_record.stop_after_silence_sec,
            minimum_length_sec: settings.auto_record.minimum_length_sec,
        };
        self.app.theme = if settings.appearance == "light" {
            Theme::Light
        } else {
            Theme::Dark
        };
        self.app.minimize_to_tray = settings.minimize_to_tray;
        self.app.launch_at_login = settings.start_with_windows;
        self.recovery.keep_incomplete_recordings = settings.advanced.crash_recovery;
        self.diagnostics.enabled = settings.advanced.diagnostic_logging;
        Ok(())
    }
}

fn default_recording_folder() -> String {
    if let Ok(profile) = std::env::var("USERPROFILE") {
        return format!("{profile}\\Music\\DJ Set Recorder");
    }
    if let Ok(home) = std::env::var("HOME") {
        return format!("{home}/Music/NVRBEATS");
    }
    "Recordings".into()
}

pub fn default_config_path() -> PathBuf {
    #[cfg(windows)]
    {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            return PathBuf::from(local).join("NVRBEATS").join("config.json");
        }
        if let Ok(roaming) = std::env::var("APPDATA") {
            return PathBuf::from(roaming).join("NVRBEATS").join("config.json");
        }
    }
    #[cfg(not(windows))]
    {
        if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
            return PathBuf::from(xdg).join("nvrbeats").join("config.json");
        }
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home)
                .join(".config")
                .join("nvrbeats")
                .join("config.json");
        }
    }
    PathBuf::from("config").join("nvrbeats").join("config.json")
}

/// In-memory snapshot + durable local file. `read_only` protects a newer
/// unsupported schema from being silently overwritten by an older app build.
pub struct ConfigStore {
    path: PathBuf,
    config: Mutex<AppConfig>,
    needs_legacy_migration: AtomicBool,
    read_only: bool,
    warning: Option<String>,
}

impl ConfigStore {
    pub fn open_default() -> Self {
        Self::open(default_config_path())
    }

    pub fn open(path: PathBuf) -> Self {
        let backup = backup_path(&path);
        let needs_legacy_migration = !path.exists() && !backup.exists();
        let mut warning = None;
        let mut read_only = false;
        let config = match read_valid(&path) {
            Ok(Some(config)) => config,
            Ok(None) => match read_valid(&backup) {
                Ok(Some(config)) => {
                    warning = Some(
                        "Primary config was missing; loaded the last-known-good backup.".into(),
                    );
                    config
                }
                Ok(None) => AppConfig::default(),
                Err(err) => {
                    read_only = is_unsupported_schema(&err);
                    warning = Some(format!("Config backup could not be loaded: {err}"));
                    AppConfig::default()
                }
            },
            Err(primary_error) => match read_valid(&backup) {
                Ok(Some(config)) => {
                    read_only = is_unsupported_schema(&primary_error);
                    warning = Some(format!(
                        "Primary config invalid; loaded backup. {primary_error}"
                    ));
                    config
                }
                Ok(None) => {
                    read_only = is_unsupported_schema(&primary_error);
                    warning = Some(format!(
                        "Config could not be loaded; defaults are active. {primary_error}"
                    ));
                    AppConfig::default()
                }
                Err(backup_error) => {
                    read_only = is_unsupported_schema(&primary_error)
                        || is_unsupported_schema(&backup_error);
                    warning = Some(format!("Neither config nor backup could be loaded; defaults are active. Primary: {primary_error}; backup: {backup_error}"));
                    AppConfig::default()
                }
            },
        };
        Self {
            path,
            config: Mutex::new(config),
            needs_legacy_migration: AtomicBool::new(needs_legacy_migration),
            read_only,
            warning,
        }
    }

    pub fn get(&self) -> AppConfig {
        self.config.lock().clone()
    }

    /// Keep a repaired startup config visible in this process if durable save fails.
    pub fn set_runtime_config(&self, config: AppConfig) -> Result<(), String> {
        config.validate()?;
        *self.config.lock() = config;
        Ok(())
    }

    pub fn load_state(&self) -> ConfigLoadResponse {
        ConfigLoadResponse {
            config: self.get(),
            needs_legacy_migration: self.needs_legacy_migration.load(Ordering::Acquire),
        }
    }

    pub fn warning(&self) -> Option<String> {
        self.warning.clone()
    }

    pub fn save(&self, config: AppConfig) -> Result<(), String> {
        if self.read_only {
            return Err(
                "This configuration uses a newer schema and is read-only in this app version."
                    .into(),
            );
        }
        config.validate()?;
        persist_atomically(&self.path, &config)?;
        *self.config.lock() = config;
        self.needs_legacy_migration.store(false, Ordering::Release);
        Ok(())
    }
}

fn is_unsupported_schema(error: &str) -> bool {
    error.starts_with("Unsupported config schema version ")
}

fn read_valid(path: &Path) -> Result<Option<AppConfig>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let mut file = File::open(path).map_err(|e| format!("cannot open {}: {e}", path.display()))?;
    let mut text = String::new();
    file.read_to_string(&mut text)
        .map_err(|e| format!("cannot read {}: {e}", path.display()))?;
    let config: AppConfig = serde_json::from_str(&text)
        .map_err(|e| format!("invalid JSON in {}: {e}", path.display()))?;
    config.validate()?;
    Ok(Some(config))
}

fn backup_path(path: &Path) -> PathBuf {
    path.with_extension("json.bak")
}

fn persist_atomically(path: &Path, config: &AppConfig) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("cannot create config directory: {e}"))?;
    }
    let temp = path.with_extension("json.tmp");
    let backup = backup_path(path);
    let bytes =
        serde_json::to_vec_pretty(config).map_err(|e| format!("cannot serialize config: {e}"))?;
    {
        let mut file =
            File::create(&temp).map_err(|e| format!("cannot create temporary config: {e}"))?;
        file.write_all(&bytes)
            .map_err(|e| format!("cannot write temporary config: {e}"))?;
        file.write_all(b"\n")
            .map_err(|e| format!("cannot finish temporary config: {e}"))?;
        file.sync_all()
            .map_err(|e| format!("cannot flush temporary config: {e}"))?;
    }

    let had_primary = path.exists();
    if had_primary {
        if backup.exists() {
            fs::remove_file(&backup).map_err(|e| format!("cannot rotate config backup: {e}"))?;
        }
        fs::rename(path, &backup).map_err(|e| format!("cannot preserve previous config: {e}"))?;
    }
    if let Err(error) = fs::rename(&temp, path) {
        if had_primary && backup.exists() {
            let _ = fs::rename(&backup, path);
        }
        let _ = fs::remove_file(&temp);
        return Err(format!("cannot install new config file: {error}"));
    }
    if let Some(parent) = path.parent() {
        if let Ok(dir) = File::open(parent) {
            let _ = dir.sync_all();
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_config_path() -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir()
            .join(format!(
                "nvrbeats-config-test-{}-{nonce}",
                std::process::id()
            ))
            .join("config.json")
    }

    #[test]
    fn defaults_are_valid_and_stereo_wav() {
        let config = AppConfig::default();
        assert!(config.validate().is_ok());
        let settings = config.to_recording_settings();
        assert!(settings.follow_windows_default);
        assert!(settings.output_device_id.is_none());
        assert_eq!(config.capture.channels, 2);
        assert_eq!(config.capture.container, AudioContainer::Wav);
        assert_eq!(config.capture.sample_rate_hz, 48_000);
    }

    #[test]
    fn unavailable_saved_endpoint_is_repaired_to_windows_default() {
        let mut config = AppConfig::default();
        config.capture.device_policy = DevicePolicy::SpecificDevice;
        config.capture.device_id = Some("stale-endpoint-id".into());

        let repaired_id = config
            .follow_windows_default_if_unavailable(|_| Some(false))
            .expect("missing endpoint should be repaired");

        assert_eq!(repaired_id, "stale-endpoint-id");
        assert_eq!(
            config.capture.device_policy,
            DevicePolicy::FollowWindowsDefault
        );
        assert!(config.capture.device_id.is_none());
        assert!(config.validate().is_ok());
    }

    #[test]
    fn available_saved_endpoint_remains_selected() {
        let mut config = AppConfig::default();
        config.capture.device_policy = DevicePolicy::SpecificDevice;
        config.capture.device_id = Some("valid-endpoint-id".into());

        assert_eq!(
            config.follow_windows_default_if_unavailable(|id| { Some(id == "valid-endpoint-id") }),
            None
        );
        assert_eq!(config.capture.device_policy, DevicePolicy::SpecificDevice);
        assert_eq!(
            config.capture.device_id.as_deref(),
            Some("valid-endpoint-id")
        );
    }

    #[test]
    fn uncertain_endpoint_enumeration_preserves_the_saved_choice() {
        let mut config = AppConfig::default();
        config.capture.device_policy = DevicePolicy::SpecificDevice;
        config.capture.device_id = Some("endpoint-id".into());

        assert_eq!(config.follow_windows_default_if_unavailable(|_| None), None);
        assert_eq!(config.capture.device_policy, DevicePolicy::SpecificDevice);
        assert_eq!(config.capture.device_id.as_deref(), Some("endpoint-id"));
    }

    #[test]
    fn rejects_unsupported_audio_settings() {
        let mut config = AppConfig::default();
        config.capture.sample_rate_hz = 96_000;
        assert!(config.validate().unwrap_err().contains("Sample rate"));
        config = AppConfig::default();
        config.capture.bit_depth = 32;
        assert!(config.validate().unwrap_err().contains("Bit depth"));
    }

    #[test]
    fn rejects_non_finite_and_out_of_range_auto_record_values() {
        let mut config = AppConfig::default();
        config.recording.auto_record.start_threshold_dbfs = f32::NAN;
        assert!(config.validate().is_err());
        config.recording.auto_record.start_threshold_dbfs = -20.0;
        config.recording.auto_record.stop_after_silence_sec = 0.0;
        assert!(config.validate().is_err());
    }

    #[test]
    fn specific_device_requires_an_id() {
        let mut config = AppConfig::default();
        config.capture.device_policy = DevicePolicy::SpecificDevice;
        assert!(config.validate().unwrap_err().contains("device id"));
    }

    #[test]
    fn legacy_settings_reject_unsupported_formats_and_map_specific_devices() {
        let mut config = AppConfig::default();
        let mut settings = config.to_recording_settings();
        settings.format = "MP3".into();
        assert!(config
            .apply_legacy_settings(&settings)
            .unwrap_err()
            .contains("Only WAV"));
        settings.format = "WAV".into();
        settings.follow_windows_default = false;
        settings.output_device_id = Some("endpoint-123".into());
        config.apply_legacy_settings(&settings).unwrap();
        assert_eq!(config.capture.device_policy, DevicePolicy::SpecificDevice);
        assert_eq!(config.capture.device_id.as_deref(), Some("endpoint-123"));
    }

    #[test]
    fn saves_and_reloads_config_with_backup() {
        let path = temp_config_path();
        let store = ConfigStore::open(path.clone());
        assert!(store.load_state().needs_legacy_migration);
        let mut config = store.get();
        config.profile.name = "Studio".into();
        store.save(config.clone()).unwrap();
        assert!(!store.load_state().needs_legacy_migration);
        assert_eq!(ConfigStore::open(path.clone()).get(), config);
        config.profile.name = "Portable".into();
        store.save(config.clone()).unwrap();
        assert!(backup_path(&path).exists());
        assert_eq!(ConfigStore::open(path.clone()).get(), config);
        let _ = fs::remove_dir_all(path.parent().unwrap());
    }

    #[test]
    fn invalid_primary_recovers_from_backup() {
        let path = temp_config_path();
        let initial = AppConfig::default();
        persist_atomically(&path, &initial).unwrap();
        let mut next = initial.clone();
        next.profile.name = "Backup candidate".into();
        persist_atomically(&path, &next).unwrap();
        fs::write(&path, b"not json").unwrap();
        let recovered = ConfigStore::open(path.clone());
        assert_eq!(recovered.get(), initial);
        assert!(recovered.warning().is_some());
        let _ = fs::remove_dir_all(path.parent().unwrap());
    }

    #[test]
    fn unsupported_schema_does_not_overwrite_existing_file() {
        let path = temp_config_path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        let mut newer = AppConfig::default();
        newer.schema_version = CONFIG_SCHEMA_VERSION + 1;
        fs::write(&path, serde_json::to_vec(&newer).unwrap()).unwrap();
        let store = ConfigStore::open(path.clone());
        assert!(store.save(AppConfig::default()).is_err());
        let text = fs::read_to_string(&path).unwrap();
        let preserved: serde_json::Value = serde_json::from_str(&text).unwrap();
        assert_eq!(preserved["schemaVersion"], CONFIG_SCHEMA_VERSION + 1);
        let _ = fs::remove_dir_all(path.parent().unwrap());
    }

    #[test]
    fn newer_primary_schema_is_preserved_when_older_backup_loads() {
        let path = temp_config_path();
        let backup = backup_path(&path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        persist_atomically(&backup, &AppConfig::default()).unwrap();
        let mut newer = AppConfig::default();
        newer.schema_version = CONFIG_SCHEMA_VERSION + 1;
        fs::write(&path, serde_json::to_vec(&newer).unwrap()).unwrap();

        let store = ConfigStore::open(path.clone());
        assert_eq!(store.get(), AppConfig::default());
        assert!(store.save(AppConfig::default()).is_err());
        let preserved: serde_json::Value =
            serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        assert_eq!(preserved["schemaVersion"], CONFIG_SCHEMA_VERSION + 1);
        let _ = fs::remove_dir_all(path.parent().unwrap());
    }

    #[test]
    fn newer_backup_is_not_destroyed_when_primary_is_missing() {
        let path = temp_config_path();
        let backup = backup_path(&path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        let mut newer = AppConfig::default();
        newer.schema_version = CONFIG_SCHEMA_VERSION + 1;
        fs::write(&backup, serde_json::to_vec(&newer).unwrap()).unwrap();

        let store = ConfigStore::open(path.clone());
        assert!(store.save(AppConfig::default()).is_err());
        let preserved: serde_json::Value =
            serde_json::from_slice(&fs::read(&backup).unwrap()).unwrap();
        assert_eq!(preserved["schemaVersion"], CONFIG_SCHEMA_VERSION + 1);
        let _ = fs::remove_dir_all(path.parent().unwrap());
    }
}
