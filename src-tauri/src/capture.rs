//! WASAPI loopback capture engine.
//!
//! Path: Traktor Pro 4 -> Windows Audio -> PC Default Output -> WASAPI loopback
//!       -> bounded queue -> writer thread -> WAV on local disk.
//!
//! Two threads:
//!   * capture thread — owns the WASAPI client, always running so the input
//!     meter is live before recording starts. Computes peak L/R and pushes
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
            armed: Mutex::new(None),
        })
    }

    pub fn set_state(&self, state: RecorderState) {
        *self.state.lock() = state;
    }

    pub fn status(&self) -> RecordingStatus {
        let frames = self.meters.frames_written.load(Ordering::Relaxed);
        let rate = *self.sample_rate.lock() as f64;
        RecordingStatus {
            state: *self.state.lock(),
            duration_sec: if rate > 0.0 { frames as f64 / rate } else { 0.0 },
            file_size_bytes: self.meters.bytes_written.load(Ordering::Relaxed),
            path: self.last_path.lock().as_ref().map(|p| p.display().to_string()),
            device: crate::devices::default_output_device(),
            error: self.error.lock().clone(),
            device_change: self.device_change.lock().clone(),
            recovery: self.recovery.lock().clone(),
        }
    }

    /// Start (or restart) a recording. Returns the `.part` path being written.
    pub fn start(self: &Arc<Self>, settings: &RecordingSettings, target: PathBuf) -> Result<PathBuf, String> {
        if self.active.lock().is_some() {
            return Err("A recording is already running".into());
        }
        self.set_state(RecorderState::Starting);
        self.meters.reset_output();
        *self.sample_rate.lock() = settings.sample_rate;
        *self.bit_depth.lock() = settings.bit_depth;

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
            self.meters.bytes_written.store(meta.len(), Ordering::Relaxed);
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
                        duration_sec: if rate > 0.0 { size as f64 / (rate * depth * 2.0) } else { 0.0 },
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

#[cfg(windows)]
pub fn spawn_capture_thread(engine: Arc<Engine>) {
    if engine.capture_running.swap(true, Ordering::SeqCst) {
        return;
    }
    std::thread::Builder::new()
        .name("wasapi-loopback".into())
        .spawn(move || loop {
            if let Err(err) = run_loopback(&engine) {
                *engine.error.lock() = Some(RecorderError {
                    code: "RECORDING_FAILED".into(),
                    message: "The Windows audio engine stopped capturing.".into(),
                    detail: Some(err),
                });
                if engine.active.lock().is_some() {
                    engine.set_state(RecorderState::Error);
                }
            }
            // The default output device may have changed (Traktor switching
            // ASIO/WASAPI, headphones plugged in). Retry shortly.
            std::thread::sleep(std::time::Duration::from_millis(750));
        })
        .ok();
}

#[cfg(windows)]
fn run_loopback(engine: &Arc<Engine>) -> Result<(), String> {
    use wasapi::*;

    initialize_mta().ok().map_err(|e| e.to_string())?;
    let device = get_default_device(&Direction::Render).map_err(|e| e.to_string())?;
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

    let h_event = audio_client.set_get_eventhandle().map_err(|e| e.to_string())?;
    let capture_client = audio_client.get_audiocaptureclient().map_err(|e| e.to_string())?;
    let block_align = format.get_blockalign() as usize;
    let mut queue: std::collections::VecDeque<u8> = std::collections::VecDeque::new();
    audio_client.start_stream().map_err(|e| e.to_string())?;

    loop {
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
            return Err("WASAPI event timeout — the output device may have changed".into());
        }
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
