//! Windows default-output detection (IMMDeviceEnumerator via the wasapi crate).

use crate::state::OutputDevice;

#[cfg(any(windows, test))]
/// WASAPI endpoint IDs are opaque identifiers; names and partial matches are not safe substitutes.
fn find_endpoint_index_by_id(
    requested_id: &str,
    endpoint_ids: impl IntoIterator<Item = Result<String, String>>,
) -> (Option<usize>, usize) {
    let mut id_read_errors = 0;
    for (index, endpoint_id) in endpoint_ids.into_iter().enumerate() {
        match endpoint_id {
            Ok(endpoint_id) if endpoint_id == requested_id => {
                return (Some(index), id_read_errors);
            }
            Ok(_) => {}
            Err(_) => id_read_errors += 1,
        }
    }
    (None, id_read_errors)
}

#[cfg(windows)]
/// Resolve the endpoint used for normal media playback. WASAPI's generic
/// `get_default_device` selects the Console role, which can differ from the
/// Multimedia endpoint used by music and video applications.
pub fn default_render_device() -> Result<wasapi::Device, String> {
    use wasapi::*;
    let _ = initialize_mta();
    get_default_device_for_role(&Direction::Render, &Role::Multimedia)
        .or_else(|_| get_default_device_for_role(&Direction::Render, &Role::Console))
        .map_err(|error| error.to_string())
}

#[cfg(windows)]
pub fn default_output_device() -> Option<OutputDevice> {
    let device = default_render_device().ok()?;
    let name = device
        .get_friendlyname()
        .unwrap_or_else(|_| "Default Output".into());
    let id = device.get_id().ok()?;
    Some(OutputDevice {
        id,
        name,
        is_default: true,
        status: "CONNECTED".into(),
    })
}

#[cfg(windows)]
pub fn output_device_by_id(id: &str) -> Result<wasapi::Device, String> {
    use wasapi::*;
    let collection = DeviceCollection::new(&Direction::Render).map_err(|e| e.to_string())?;
    let count = collection.get_nbr_devices().map_err(|e| e.to_string())?;
    let mut devices = Vec::new();
    let mut enumeration_errors = 0;
    for index in 0..count {
        match collection.get_device_at_index(index) {
            Ok(device) => devices.push(device),
            Err(_) => enumeration_errors += 1,
        }
    }
    let endpoint_ids = devices
        .iter()
        .map(|device| device.get_id().map_err(|error| error.to_string()))
        .collect::<Vec<_>>();
    let (match_index, id_read_errors) = find_endpoint_index_by_id(id, endpoint_ids);
    if let Some(index) = match_index {
        return devices
            .into_iter()
            .nth(index)
            .ok_or_else(|| format!("Output device endpoint is unavailable: {id}"));
    }
    let lookup_errors = enumeration_errors + id_read_errors;
    if lookup_errors > 0 {
        Err(format!(
            "Output device endpoint is unavailable: {id} (could not inspect {lookup_errors} endpoint(s))"
        ))
    } else {
        Err(format!("Output device endpoint is unavailable: {id}"))
    }
}

#[cfg(windows)]
pub fn output_device_by_id_snapshot(id: &str) -> Result<OutputDevice, String> {
    use wasapi::Device;
    let _ = wasapi::initialize_mta();
    let device: Device = output_device_by_id(id)?;
    let device_id = device.get_id().map_err(|e| e.to_string())?;
    Ok(OutputDevice {
        id: device_id.clone(),
        name: device
            .get_friendlyname()
            .unwrap_or_else(|_| "Output".into()),
        is_default: default_output_device().map(|d| d.id) == Some(device_id),
        status: "CONNECTED".into(),
    })
}

#[cfg(windows)]
pub fn output_devices() -> Vec<OutputDevice> {
    use wasapi::*;
    let _ = initialize_mta();
    let default_id = default_output_device().map(|d| d.id);
    let mut out = Vec::new();
    if let Ok(collection) = DeviceCollection::new(&Direction::Render) {
        let count = collection.get_nbr_devices().unwrap_or(0);
        for index in 0..count {
            if let Ok(device) = collection.get_device_at_index(index) {
                let name = device
                    .get_friendlyname()
                    .unwrap_or_else(|_| "Output".into());
                let Ok(id) = device.get_id() else {
                    continue;
                };
                let is_default = default_id.as_deref() == Some(id.as_str());
                out.push(OutputDevice {
                    id,
                    name,
                    is_default,
                    status: "CONNECTED".into(),
                });
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::find_endpoint_index_by_id;

    #[test]
    fn endpoint_lookup_skips_unreadable_ids_and_matches_exact_id() {
        let (index, errors) = find_endpoint_index_by_id(
            "endpoint-b",
            vec![
                Err("ID unavailable".into()),
                Ok("endpoint-a".into()),
                Ok("endpoint-b".into()),
            ],
        );
        assert_eq!(index, Some(2));
        assert_eq!(errors, 1);
    }

    #[test]
    fn endpoint_lookup_does_not_match_names_or_case_variants() {
        let (index, _) = find_endpoint_index_by_id(
            "endpoint-b",
            vec![
                Ok("Speaker (Realtek(R) Audio)".into()),
                Ok("ENDPOINT-B".into()),
            ],
        );
        assert_eq!(index, None);
    }
}

#[cfg(not(windows))]
pub fn default_output_device() -> Option<OutputDevice> {
    None
}

#[cfg(not(windows))]
pub fn output_device_by_id_snapshot(_id: &str) -> Result<OutputDevice, String> {
    Err("WASAPI is only available on Windows".into())
}

#[cfg(not(windows))]
pub fn output_devices() -> Vec<OutputDevice> {
    Vec::new()
}
