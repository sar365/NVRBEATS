//! Windows default-output detection (IMMDeviceEnumerator via the wasapi crate).

use crate::state::OutputDevice;

#[cfg(windows)]
pub fn default_output_device() -> Option<OutputDevice> {
    use wasapi::*;
    let _ = initialize_mta();
    let device = get_default_device(&Direction::Render).ok()?;
    let name = device.get_friendlyname().unwrap_or_else(|_| "Default Output".into());
    let id = device.get_id().unwrap_or_else(|_| name.clone());
    Some(OutputDevice { id, name, is_default: true, status: "CONNECTED".into() })
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
                let name = device.get_friendlyname().unwrap_or_else(|_| "Output".into());
                let id = device.get_id().unwrap_or_else(|_| name.clone());
                let is_default = default_id.as_deref() == Some(id.as_str());
                out.push(OutputDevice { id, name, is_default, status: "CONNECTED".into() });
            }
        }
    }
    out
}

#[cfg(not(windows))]
pub fn default_output_device() -> Option<OutputDevice> {
    None
}

#[cfg(not(windows))]
pub fn output_devices() -> Vec<OutputDevice> {
    Vec::new()
}
