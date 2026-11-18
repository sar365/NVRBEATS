//! WASAPI loopback capture engine.
//!
//! Path: WASAPI shared-output loopback or a selected ASIO driver's loopback input pair
//!       -> bounded queue -> writer thread -> WAV on local disk.
//!
//! Two threads:
//!   * capture thread — owns the active WASAPI/ASIO stream, always running so the
//!     input meter is live before recording starts. Computes peak L/R and pushes
//!     interleaved f32 frames to the writer when a recording is armed.
//!   * writer thread — owns the `hound` WAV writer and writes to `<file>.part`,
//!     renaming to the final name on a clean stop (crash recovery repairs any
//!     `.part` left behind).

use crate::state::*;
use parking_lot::Mutex;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{sync_channel, Receiver, SyncSender};
use std::sync::Arc;

pub enum WriterMsg {
    Samples(Vec<f32>),
    Stop,
}

pub struct ActiveRecording {
    pub part_path: PathBuf,
    pub final_path: PathBuf,
    pub started_at: String,
    pub sender: SyncSender<WriterMsg>,
    pub handle: Option<std::thread::JoinHandle<()>>,
}

pub struct Engine {
    pub meters: Arc<Meters>,
    pub state: Mutex<RecorderState>,
    pub error: Mutex<Option<RecorderError>>,
    pub device_change: Mutex<Option<DeviceChangeEvent>>,
    pub recovery: Mutex<Option<IncompleteRecording>>,
    pub active: Mutex<Option<ActiveRecording>>,
    pub last_path: Mutex<Option<PathBuf>>,
    pub sample_rate: Mutex<u32>,
    pub bit_depth: Mutex<u16>,
    pub capture_running: AtomicBool,
    pub capture_ready: AtomicBool,
    pub capture_generation: std::sync::atomic::AtomicU64,
    pub capture_backend: Mutex<CaptureBackend>,
    pub capture_device_id: Mutex<Option<String>>,
    pub asio_driver_name: Mutex<Option<String>>,
    pub asio_channel_pair: Mutex<[u16; 2]>,
    pub current_device_id: Mutex<Option<String>>,
    /// Set by the capture thread when a recording is armed.
    pub armed: Mutex<Option<SyncSender<WriterMsg>>>,
}

impl Engine {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            meters: Arc::new(Meters::default()),
            state: Mutex::new(RecorderState::Ready),
            error: Mutex::new(None),
            device_change: Mutex::new(None),
            recovery: Mutex::new(None),
            active: Mutex::new(None),
            last_path: Mutex::new(None),
            sample_rate: Mutex::new(48_000),
            bit_depth: Mutex::new(24),
            capture_running: AtomicBool::new(false),
            capture_ready: AtomicBool::new(false),
            capture_generation: std::sync::atomic::AtomicU64::new(0),
            capture_backend: Mutex::new(CaptureBackend::WasapiLoopback),
            capture_device_id: Mutex::new(None),
            asio_driver_name: Mutex::new(None),
            asio_channel_pair: Mutex::new([0, 1]),
            current_device_id: Mutex::new(None),
            armed: Mutex::new(None),
        })
    }

    pub fn set_state(&self, state: RecorderState) {
        *self.state.lock() = state;
    }

    /// Apply persisted capture routing before spawning the capture thread, or
    /// request an orderly stream restart if the thread is already running.
    pub fn apply_capture_settings(&self, settings: &RecordingSettings) -> Result<(), String> {
        validate_capture_settings(settings)?;
        *self.sample_rate.lock() = settings.sample_rate;
        *self.bit_depth.lock() = settings.bit_depth;
        *self.capture_backend.lock() = settings.capture_backend.clone();
        *self.asio_driver_name.lock() = settings.asio_driver_name.clone();
        *self.asio_channel_pair.lock() = settings.asio_channel_pair;
        self.capture_ready.store(false, Ordering::SeqCst);
        *self.error.lock() = None;
        *self.capture_device_id.lock() = if settings.follow_windows_default {
            None
        } else {
            settings.output_device_id.clone()
        };
        self.capture_generation.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }

    pub fn status(&self) -> RecordingStatus {
        let frames = self.meters.frames_written.load(Ordering::Relaxed);
        let rate = *self.sample_rate.lock() as f64;
        let requested_device_id = self.capture_device_id.lock().clone();
        let current_device_id = self.current_device_id.lock().clone();
        let device = if *self.capture_backend.lock() == CaptureBackend::AsioLoopback {
            None
        } else {
            current_device_id
                .as_deref()
                .and_then(|id| crate::devices::output_device_by_id_snapshot(id).ok())
                .or_else(|| {
                    if requested_device_id.is_none() {
                        crate::devices::default_output_device()
                    } else {
                        None
                    }
                })
        };
        RecordingStatus {
            state: *self.state.lock(),
            duration_sec: if rate > 0.0 {
                frames as f64 / rate
            } else {
                0.0
            },
            file_size_bytes: self.meters.bytes_written.load(Ordering::Relaxed),
            path: self
                .last_path
                .lock()
                .as_ref()
                .map(|p| p.display().to_string()),
            device,
            error: self.error.lock().clone(),
            device_change: self.device_change.lock().clone(),
            recovery: self.recovery.lock().clone(),
        }
    }

    /// Start (or restart) a recording. Returns the `.part` path being written.
    pub fn start(
        self: &Arc<Self>,
        settings: &RecordingSettings,
        target: PathBuf,
    ) -> Result<PathBuf, String> {
        if self.active.lock().is_some() {
            return Err("A recording is already running".into());
        }
        validate_capture_settings(settings)?;
        self.set_state(RecorderState::Starting);
        self.meters.reset_output();
        *self.bit_depth.lock() = settings.bit_depth;
        self.apply_capture_settings(settings)?;
        if settings.capture_backend == CaptureBackend::AsioLoopback {
            let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
            while !self.capture_ready.load(Ordering::SeqCst) {
                if let Some(error) = self.error.lock().as_ref() {
                    if let Some(detail) = error.detail.as_deref() {
                        self.set_state(RecorderState::Error);
                        return Err(format!("ASIO loopback is not ready: {detail}"));
                    }
                }
                if std::time::Instant::now() >= deadline {
                    self.set_state(RecorderState::Error);
                    return Err("Timed out waiting for the ASIO loopback stream. Check the driver, channel pair, and whether another application is using the driver.".into());
                }
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
        }

        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let part_path = target.with_extension("part");

        let spec = hound::WavSpec {
            channels: 2,
            sample_rate: settings.sample_rate,
            bits_per_sample: settings.bit_depth,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = hound::WavWriter::create(&part_path, spec).map_err(|e| e.to_string())?;

        // Bounded queue: the capture thread never blocks on disk for long, and
        // memory stays flat during multi-hour sets.
        let (tx, rx): (SyncSender<WriterMsg>, Receiver<WriterMsg>) = sync_channel(256);
        let meters = self.meters.clone();
        let bit_depth = settings.bit_depth;
        let handle = std::thread::Builder::new()
            .name("wav-writer".into())
            .spawn(move || {
                while let Ok(msg) = rx.recv() {
                    match msg {
                        WriterMsg::Samples(chunk) => {
                            for sample in &chunk {
                                let clamped = sample.clamp(-1.0, 1.0);
                                let result = if bit_depth == 16 {
                                    writer.write_sample((clamped * 32767.0) as i16)
                                } else {
                                    writer.write_sample((clamped * 8_388_607.0) as i32)
                                };
                                if result.is_err() {
                                    break;
                                }
                            }
                            let frames = (chunk.len() / 2) as u64;
                            meters.frames_written.fetch_add(frames, Ordering::Relaxed);
                            meters.bytes_written.fetch_add(
                                chunk.len() as u64 * (bit_depth as u64 / 8),
                                Ordering::Relaxed,
                            );
                            let _ = writer.flush();
                        }
                        WriterMsg::Stop => break,
                    }
                }
                // Patch the RIFF header and close the file cleanly.
                let _ = writer.finalize();
            })
            .map_err(|e| e.to_string())?;

        *self.armed.lock() = Some(tx.clone());
        *self.active.lock() = Some(ActiveRecording {
            part_path: part_path.clone(),
            final_path: target.clone(),
            started_at: chrono::Utc::now().to_rfc3339(),
            sender: tx,
            handle: Some(handle),
        });
        *self.last_path.lock() = Some(target);
        self.set_state(RecorderState::Recording);
        Ok(part_path)
    }

    /// Stop, drain the queue, finalize the header and rename `.part` -> final.
    pub fn stop(self: &Arc<Self>) -> Result<RecordingStatus, String> {
        let active = self.active.lock().take();
        let Some(mut active) = active else {
            return Ok(self.status());
        };
        self.set_state(RecorderState::Stopping);
        *self.armed.lock() = None;
        let _ = active.sender.send(WriterMsg::Stop);
        self.set_state(RecorderState::Finalizing);
        if let Some(handle) = active.handle.take() {
            let _ = handle.join();
        }
        if active.part_path.exists() {
            std::fs::rename(&active.part_path, &active.final_path).map_err(|e| e.to_string())?;
        }
        *self.last_path.lock() = Some(active.final_path.clone());
        if let Ok(meta) = std::fs::metadata(&active.final_path) {
            self.meters
                .bytes_written
                .store(meta.len(), Ordering::Relaxed);
        }
        self.meters.set_output(0.0, 0.0);
        self.set_state(RecorderState::Completed);
        Ok(self.status())
    }

    /// Scan the recording folder for a `.part` file left behind by a crash.
    pub fn scan_recovery(&self, folder: &Path) {
        let mut found = None;
        if let Ok(entries) = std::fs::read_dir(folder) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("part") {
                    let meta = entry.metadata().ok();
                    let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
                    let rate = *self.sample_rate.lock() as f64;
                    let depth = (*self.bit_depth.lock() as f64) / 8.0;
                    found = Some(IncompleteRecording {
                        path: path.display().to_string(),
                        started_at: chrono::Utc::now().to_rfc3339(),
                        duration_sec: if rate > 0.0 {
                            size as f64 / (rate * depth * 2.0)
                        } else {
                            0.0
                        },
                        file_size_bytes: size,
                    });
                    break;
                }
            }
        }
        if found.is_some() {
            self.set_state(RecorderState::RecoveryAvailable);
        }
        *self.recovery.lock() = found;
    }
}

pub fn validate_capture_settings(settings: &RecordingSettings) -> Result<(), String> {
    if !matches!(settings.sample_rate, 44_100 | 48_000) {
        return Err("Sample rate must be exactly 44100 or 48000 Hz".into());
    }
    if !matches!(settings.bit_depth, 16 | 24) {
        return Err("Bit depth must be exactly 16 or 24".into());
    }
    if settings.capture_backend == CaptureBackend::WasapiLoopback
        && !settings.follow_windows_default
        && settings
            .output_device_id
            .as_deref()
            .unwrap_or("")
            .is_empty()
    {
        return Err("Select an output device or enable followWindowsDefault".into());
    }
    if settings.capture_backend == CaptureBackend::AsioLoopback {
        if settings
            .asio_driver_name
            .as_deref()
            .unwrap_or_default()
            .trim()
            .is_empty()
        {
            return Err("Select an ASIO driver for playback loopback capture.".into());
        }
        if settings.asio_channel_pair[0] == settings.asio_channel_pair[1] {
            return Err("Select two different ASIO loopback input channels.".into());
        }
    }
    Ok(())
}

#[cfg(windows)]
pub fn spawn_capture_thread(engine: Arc<Engine>) {
    if engine.capture_running.swap(true, Ordering::SeqCst) {
        return;
    }
    std::thread::Builder::new()
        .name("audio-capture".into())
        .spawn(move || loop {
            let result = match *engine.capture_backend.lock() {
                CaptureBackend::WasapiLoopback => run_loopback(&engine),
                CaptureBackend::AsioLoopback => run_asio_loopback(&engine),
            };
            if let Err(err) = result {
                engine.capture_ready.store(false, Ordering::SeqCst);
                *engine.error.lock() = Some(RecorderError {
                    code: "RECORDING_FAILED".into(),
                    message: "The Windows audio engine stopped capturing.".into(),
                    detail: Some(err),
                });
                if engine.active.lock().is_some() {
                    engine.set_state(RecorderState::Error);
                }
                *engine.current_device_id.lock() = None;
            }
            // The output device may have changed or been disconnected. Retry shortly.
            std::thread::sleep(std::time::Duration::from_millis(750));
        })
        .ok();
}

#[cfg(windows)]
fn run_loopback(engine: &Arc<Engine>) -> Result<(), String> {
    use wasapi::*;

    initialize_mta().ok().map_err(|e| e.to_string())?;
    let generation = engine.capture_generation.load(Ordering::SeqCst);
    let requested_id = engine.capture_device_id.lock().clone();
    let device = if let Some(id) = requested_id.as_deref() {
        crate::devices::output_device_by_id(id)?
    } else {
        crate::devices::default_render_device()?
    };
    let actual_id = device.get_id().map_err(|e| e.to_string())?;
    let mut audio_client = device.get_iaudioclient().map_err(|e| e.to_string())?;

    let sample_rate = *engine.sample_rate.lock() as usize;
    // Float32 capture keeps the digital path bit-transparent until we encode.
    let format = WaveFormat::new(32, 32, &SampleType::Float, sample_rate, 2, None);
    let (_default_period, min_period) = audio_client.get_periods().map_err(|e| e.to_string())?;
    audio_client
        .initialize_client(
            &format,
            min_period,
            &Direction::Capture, // loopback = capture from a render endpoint
            &ShareMode::Shared,
            true,
        )
        .map_err(|e| e.to_string())?;

    let h_event = audio_client
        .set_get_eventhandle()
        .map_err(|e| e.to_string())?;
    let capture_client = audio_client
        .get_audiocaptureclient()
        .map_err(|e| e.to_string())?;
    let block_align = format.get_blockalign() as usize;
    let mut queue: std::collections::VecDeque<u8> = std::collections::VecDeque::new();
    audio_client.start_stream().map_err(|e| e.to_string())?;
    engine.capture_ready.store(true, Ordering::SeqCst);
    *engine.current_device_id.lock() = Some(actual_id);
    *engine.error.lock() = None;
    if engine.active.lock().is_some() {
        engine.set_state(RecorderState::Recording);
    }

    loop {
        if engine.capture_generation.load(Ordering::SeqCst) != generation {
            let _ = audio_client.stop_stream();
            *engine.current_device_id.lock() = None;
            return Ok(());
        }
        capture_client
            .read_from_device_to_deque(&mut queue)
            .map_err(|e| e.to_string())?;

        let frames = queue.len() / block_align;
        if frames > 0 {
            let mut samples = Vec::with_capacity(frames * 2);
            for _ in 0..frames * 2 {
                let mut bytes = [0u8; 4];
                for byte in bytes.iter_mut() {
                    *byte = queue.pop_front().unwrap_or(0);
                }
                samples.push(f32::from_le_bytes(bytes));
            }
            let (peak_l, peak_r) = peaks(&samples);
            engine.meters.set_input(peak_l, peak_r);

            if let Some(sender) = engine.armed.lock().as_ref() {
                engine.meters.set_output(peak_l, peak_r);
                // Never block the capture thread: drop nothing under normal
                // load, but prefer a dropped chunk over a stalled endpoint.
                let _ = sender.try_send(WriterMsg::Samples(samples));
            } else {
                engine.meters.set_output(0.0, 0.0);
            }
        }

        if h_event.wait_for_event(1000).is_err() {
            let _ = audio_client.stop_stream();
            *engine.current_device_id.lock() = None;
            if engine.capture_generation.load(Ordering::SeqCst) != generation {
                return Ok(());
            }
            return Err("WASAPI event timeout — the output device may have changed".into());
        }
        if engine.capture_generation.load(Ordering::SeqCst) != generation {
            let _ = audio_client.stop_stream();
            *engine.current_device_id.lock() = None;
            return Ok(());
        }
    }
}

#[cfg(windows)]
fn run_asio_loopback(engine: &Arc<Engine>) -> Result<(), String> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
    use cpal::{BufferSize, SampleFormat, StreamConfig};

    let generation = engine.capture_generation.load(Ordering::SeqCst);
    let requested_driver =
        engine.asio_driver_name.lock().clone().ok_or_else(|| {
            "Select an ASIO driver before starting playback loopback.".to_string()
        })?;
    let channel_pair = *engine.asio_channel_pair.lock();
    let host = cpal::host_from_id(cpal::HostId::Asio)
        .map_err(|error| format!("Could not initialize the ASIO host: {error}"))?;
    let mut selected_device = None;
    for device in host
        .devices()
        .map_err(|error| format!("Could not enumerate ASIO drivers: {error}"))?
    {
        if device.name().ok().as_deref() == Some(requested_driver.as_str()) {
            selected_device = Some(device);
            break;
        }
    }
    let device = selected_device.ok_or_else(|| {
        format!("ASIO driver '{requested_driver}' is not available. Refresh the driver list and select it again.")
    })?;
    let supported = device.default_input_config().map_err(|error| {
        format!("ASIO driver '{requested_driver}' does not expose usable input channels. Playback loopback requires driver-provided loopback inputs: {error}")
    })?;
    let input_channels = supported.channels();
    if channel_pair
        .iter()
        .any(|channel| *channel >= input_channels)
        || channel_pair[0] == channel_pair[1]
    {
        return Err(format!(
            "ASIO driver '{requested_driver}' exposes {input_channels} input channel(s); choose two distinct loopback channels in that range."
        ));
    }
    let sample_format = supported.sample_format();
    let config = StreamConfig {
        channels: input_channels,
        sample_rate: cpal::SampleRate(*engine.sample_rate.lock()),
        buffer_size: BufferSize::Default,
    };
    let engine_for_data = engine.clone();
    let engine_for_error = engine.clone();
    let channel_count = input_channels as usize;
    let stream = match sample_format {
        SampleFormat::F32 => device.build_input_stream::<f32, _, _>(
            &config,
            move |data, _| process_asio_samples(&engine_for_data, data, channel_count, channel_pair),
            move |error| set_asio_stream_error(&engine_for_error, error.to_string()),
            None,
        ),
        SampleFormat::I16 => device.build_input_stream::<i16, _, _>(
            &config,
            move |data, _| process_asio_samples(&engine_for_data, data, channel_count, channel_pair),
            move |error| set_asio_stream_error(&engine_for_error, error.to_string()),
            None,
        ),
        SampleFormat::I32 => device.build_input_stream::<i32, _, _>(
            &config,
            move |data, _| process_asio_samples(&engine_for_data, data, channel_count, channel_pair),
            move |error| set_asio_stream_error(&engine_for_error, error.to_string()),
            None,
        ),
        other => {
            return Err(format!(
                "ASIO driver '{requested_driver}' uses unsupported input sample format {other:?}."
            ));
        }
    }
    .map_err(|error| {
        format!(
            "Could not open ASIO playback-loopback inputs on '{requested_driver}'. Close other apps using the driver and confirm its loopback channels are enabled: {error}"
        )
    })?;
    *engine.error.lock() = None;
    stream
        .play()
        .map_err(|error| format!("Could not start ASIO loopback capture: {error}"))?;
    if let Some(error) = engine.error.lock().as_ref() {
        return Err(error
            .detail
            .clone()
            .unwrap_or_else(|| error.message.clone()));
    }
    engine.capture_ready.store(true, Ordering::SeqCst);
    *engine.current_device_id.lock() = None;
    if engine.active.lock().is_some() {
        engine.set_state(RecorderState::Recording);
    }
    while engine.capture_generation.load(Ordering::SeqCst) == generation {
        if let Some(error) = engine.error.lock().as_ref() {
            engine.capture_ready.store(false, Ordering::SeqCst);
            return Err(error
                .detail
                .clone()
                .unwrap_or_else(|| error.message.clone()));
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    engine.capture_ready.store(false, Ordering::SeqCst);
    drop(stream);
    Ok(())
}

#[cfg(windows)]
trait AsioSample: Copy {
    fn to_f32(self) -> f32;
}

#[cfg(windows)]
impl AsioSample for f32 {
    fn to_f32(self) -> f32 {
        self
    }
}

#[cfg(windows)]
impl AsioSample for i16 {
    fn to_f32(self) -> f32 {
        self as f32 / 32768.0
    }
}

#[cfg(windows)]
impl AsioSample for i32 {
    fn to_f32(self) -> f32 {
        self as f32 / 2_147_483_648.0
    }
}

#[cfg(windows)]
fn process_asio_samples<T: AsioSample>(
    engine: &Arc<Engine>,
    data: &[T],
    input_channels: usize,
    channel_pair: [u16; 2],
) {
    let left = channel_pair[0] as usize;
    let right = channel_pair[1] as usize;
    if input_channels == 0 || left >= input_channels || right >= input_channels {
        return;
    }
    let frames = data.len() / input_channels;
    if frames == 0 {
        return;
    }
    let mut stereo = Vec::with_capacity(frames * 2);
    for frame in data.chunks_exact(input_channels) {
        stereo.push(frame[left].to_f32());
        stereo.push(frame[right].to_f32());
    }
    let (peak_left, peak_right) = peaks(&stereo);
    engine.meters.set_input(peak_left, peak_right);
    let sender = engine.armed.try_lock().and_then(|armed| armed.clone());
    if let Some(sender) = sender {
        engine.meters.set_output(peak_left, peak_right);
        let _ = sender.try_send(WriterMsg::Samples(stereo));
    } else {
        engine.meters.set_output(0.0, 0.0);
    }
}

#[cfg(windows)]
fn set_asio_stream_error(engine: &Arc<Engine>, detail: String) {
    engine.capture_ready.store(false, Ordering::SeqCst);
    *engine.error.lock() = Some(RecorderError {
        code: "RECORDING_FAILED".into(),
        message: "The ASIO playback-loopback stream reported an error.".into(),
        detail: Some(detail),
    });
    if engine.active.lock().is_some() {
        engine.set_state(RecorderState::Error);
    }
}

/// Peak per channel from interleaved stereo, with a soft decay applied by the UI.
pub fn peaks(samples: &[f32]) -> (f32, f32) {
    let mut left: f32 = 0.0;
    let mut right: f32 = 0.0;
    for (i, sample) in samples.iter().enumerate() {
        let value = sample.abs();
        if i % 2 == 0 {
            left = left.max(value);
        } else {
            right = right.max(value);
        }
    }
    (left.min(1.0), right.min(1.0))
}

/// Non-Windows dev builds: no loopback source exists, meters stay silent.
#[cfg(not(windows))]
pub fn spawn_capture_thread(engine: Arc<Engine>) {
    engine.capture_running.store(true, Ordering::SeqCst);
    *engine.error.lock() = Some(RecorderError {
        code: "NATIVE_ENGINE_UNAVAILABLE".into(),
        message: "WASAPI loopback is only available on Windows.".into(),
        detail: None,
    });
}
