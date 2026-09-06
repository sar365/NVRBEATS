//! Native WAV operations: trimming, exporting and crash-recovery repair.
//! All of this happens on the real file on disk — never in the browser.

use crate::state::{ExportRequest, ExportResult, TrimRequest, TrimResult};
use std::path::{Path, PathBuf};

/// Sample-accurate trim of a finalized WAV file.
/// Writes to a temp file, then atomically replaces the original.
pub fn trim(request: &TrimRequest) -> Result<TrimResult, String> {
    let source = PathBuf::from(&request.path);
    let mut reader = hound::WavReader::open(&source).map_err(|e| e.to_string())?;
    let spec = reader.spec();
    let channels = spec.channels as usize;
    let rate = spec.sample_rate as f64;

    let start_frame = (request.start_sec.max(0.0) * rate).round() as u32;
    let end_frame = (request.end_sec.max(request.start_sec) * rate).round() as u32;
    let total_frames = reader.duration();
    let end_frame = end_frame.min(total_frames);
    if end_frame <= start_frame {
        return Err("The trim range is empty.".into());
    }

    let temp = source.with_extension("trim.tmp");
    let mut writer = hound::WavWriter::create(&temp, spec).map_err(|e| e.to_string())?;
    reader.seek(start_frame).map_err(|e| e.to_string())?;
    let wanted = ((end_frame - start_frame) as usize) * channels;

    match spec.bits_per_sample {
        16 => {
            for sample in reader.samples::<i16>().take(wanted) {
                writer.write_sample(sample.map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
            }
        }
        _ => {
            for sample in reader.samples::<i32>().take(wanted) {
                writer.write_sample(sample.map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
            }
        }
    }
    writer.finalize().map_err(|e| e.to_string())?;
    std::fs::rename(&temp, &source).map_err(|e| e.to_string())?;

    let size = std::fs::metadata(&source).map(|m| m.len()).unwrap_or(0);
    Ok(TrimResult {
        path: source.display().to_string(),
        duration_sec: (end_frame - start_frame) as f64 / rate,
        file_size_bytes: size,
    })
}

/// Copy a recording into a folder the user picked, without touching the original.
pub fn export(request: &ExportRequest) -> Result<ExportResult, String> {
    let source = PathBuf::from(&request.filepath);
    let name = source
        .file_name()
        .ok_or_else(|| "The recording has no filename.".to_string())?;
    let mut destination = PathBuf::from(&request.destination_folder);
    std::fs::create_dir_all(&destination).map_err(|e| e.to_string())?;
    destination.push(name);
    destination = unique_path(destination);
    std::fs::copy(&source, &destination).map_err(|e| e.to_string())?;
    Ok(ExportResult { output_path: destination.display().to_string() })
}

/// Rebuild a playable WAV header on a `.part` file left behind by a crash.
pub fn repair_part_file(part: &Path, spec: hound::WavSpec) -> Result<PathBuf, String> {
    let bytes = std::fs::read(part).map_err(|e| e.to_string())?;
    // Skip the 44-byte canonical header written when the recording started.
    let data = if bytes.len() > 44 { &bytes[44..] } else { &bytes[..] };
    let bytes_per_sample = (spec.bits_per_sample / 8) as usize;
    let usable = data.len() - (data.len() % (bytes_per_sample * spec.channels as usize).max(1));

    let target = unique_path(part.with_extension("wav"));
    let mut writer = hound::WavWriter::create(&target, spec).map_err(|e| e.to_string())?;
    let mut index = 0usize;
    while index + bytes_per_sample <= usable {
        let value = match spec.bits_per_sample {
            16 => i16::from_le_bytes([data[index], data[index + 1]]) as i32,
            24 => {
                let raw = i32::from_le_bytes([data[index], data[index + 1], data[index + 2], 0]);
                (raw << 8) >> 8
            }
            _ => i32::from_le_bytes([
                data[index],
                data[index + 1],
                data[index + 2],
                data[index + 3],
            ]),
        };
        writer.write_sample(value).map_err(|e| e.to_string())?;
        index += bytes_per_sample;
    }
    writer.finalize().map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(part);
    Ok(target)
}

fn unique_path(path: PathBuf) -> PathBuf {
    if !path.exists() {
        return path;
    }
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("recording").to_string();
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("wav").to_string();
    let parent = path.parent().map(|p| p.to_path_buf()).unwrap_or_default();
    for n in 2..1000 {
        let candidate = parent.join(format!("{stem} ({n}).{ext}"));
        if !candidate.exists() {
            return candidate;
        }
    }
    path
}
