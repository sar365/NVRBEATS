//! Free/total space on the recording volume.

use crate::state::DiskSpace;
use std::path::Path;

#[cfg(windows)]
pub fn disk_space(path: &Path) -> DiskSpace {
    use windows::core::HSTRING;
    use windows::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;

    let wide = HSTRING::from(path.display().to_string());
    let mut free: u64 = 0;
    let mut total: u64 = 0;
    unsafe {
        let _ = GetDiskFreeSpaceExW(&wide, Some(&mut free), Some(&mut total), None);
    }
    DiskSpace { free_bytes: free, total_bytes: total }
}

#[cfg(not(windows))]
pub fn disk_space(_path: &Path) -> DiskSpace {
    DiskSpace { free_bytes: 0, total_bytes: 0 }
}
