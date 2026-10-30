//! Windows default-output detection (IMMDeviceEnumerator via the wasapi crate).

use crate::state::OutputDevice;

#[cfg(windows)]
pub fn default_output_device() -> Option<OutputDevice> {
    use wasapi::*;
    let _ = initialize_mta();
    let device = get_default_device(&Direction::Render).ok()?;
    let name = device
        .get_friendlyname()
        .unwrap_or_else(|_| "Default Output".into());
    let id = device.get_id().unwrap_or_else(|_| name.clone());
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
    for index in 0..collection.get_nbr_devices().map_err(|e| e.to_string())? {
        let device = collection
            .get_device_at_index(index)
            .map_err(|e| e.to_string())?;
        if device.get_id().map_err(|e| e.to_string())? == id {
            return Ok(device);
        }
    }
    Err(format!("Output device endpoint is unavailable: {id}"))
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
                let id = device.get_id().unwrap_or_else(|_| name.clone());
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
