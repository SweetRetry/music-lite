// A user-selected file grant keeps QQ login access limited to the client's preferences.
use std::path::PathBuf;
use std::sync::OnceLock;

static BOOKMARK: OnceLock<PathBuf> = OnceLock::new();

pub fn init(data_dir: PathBuf) {
    let _ = BOOKMARK.set(data_dir.join("qq-login-access.bookmark"));
}

#[cfg(target_os = "macos")]
fn scoped_read(url: &objc2_foundation::NSURL, path: &str) -> std::io::Result<Vec<u8>> {
    // SAFETY: The live URL comes from the system picker or bookmark resolver. Every successful start is balanced.
    let started = unsafe { url.startAccessingSecurityScopedResource() };
    let result = std::fs::read(path);
    if started {
        unsafe { url.stopAccessingSecurityScopedResource() };
    }
    result
}

pub fn read(path: &str) -> std::io::Result<Vec<u8>> {
    #[cfg(target_os = "macos")]
    {
        use objc2_foundation::{NSData, NSURL, NSURLBookmarkResolutionOptions};
        if let Some(bytes) = BOOKMARK.get().and_then(|file| std::fs::read(file).ok()) {
            // SAFETY: No stale-result pointer is supplied. Resolution must never open UI during reads.
            let resolved = unsafe {
                NSURL::URLByResolvingBookmarkData_options_relativeToURL_bookmarkDataIsStale_error(
                    &NSData::with_bytes(&bytes),
                    NSURLBookmarkResolutionOptions::WithSecurityScope
                        | NSURLBookmarkResolutionOptions::WithoutUI,
                    None,
                    std::ptr::null_mut(),
                )
            };
            if let Ok(url) = resolved {
                if url.path().map(|value| value.to_string()).as_deref() == Some(path) {
                    return scoped_read(&url, path);
                }
            }
        }
    }
    std::fs::read(path)
}

#[cfg(target_os = "macos")]
fn select_login() -> Result<bool, String> {
    use objc2::MainThreadMarker;
    use objc2_app_kit::{NSModalResponseOK, NSOpenPanel};
    use objc2_foundation::{NSString, NSURL, NSURLBookmarkCreationOptions};
    use std::io::Write;
    use std::os::unix::fs::OpenOptionsExt;

    let path = crate::qq_session::path()?;
    let (parent, filename) = path.rsplit_once('/').ok_or("无法定位 QQ 音乐登录文件。")?;
    let mtm = MainThreadMarker::new().ok_or("无法打开授权窗口。")?;
    let panel = NSOpenPanel::openPanel(mtm);
    panel.setTitle(Some(&NSString::from_str("授权 QQ 音乐")));
    panel.setCanChooseFiles(true);
    panel.setCanChooseDirectories(false);
    panel.setAllowsMultipleSelection(false);
    panel.setDirectoryURL(Some(&NSURL::fileURLWithPath_isDirectory(
        &NSString::from_str(parent),
        true,
    )));
    panel.setNameFieldStringValue(&NSString::from_str(filename));
    panel.setMessage(Some(&NSString::from_str(
        "允许 Music Lite 读取 QQ 音乐登录。",
    )));
    panel.setPrompt(Some(&NSString::from_str("允许访问")));
    if panel.runModal() != NSModalResponseOK {
        return Ok(false);
    }
    let url = panel.URL().ok_or("未选择 QQ 音乐登录文件。")?;
    if url.path().map(|value| value.to_string()).as_deref() != Some(path.as_str()) {
        return Err("请选择 QQ 音乐登录文件。".into());
    }
    scoped_read(&url, &path).map_err(|_| "需要授权读取 QQ 音乐登录。")?;
    let bookmark = url
        .bookmarkDataWithOptions_includingResourceValuesForKeys_relativeToURL_error(
            NSURLBookmarkCreationOptions::WithSecurityScope
                | NSURLBookmarkCreationOptions::SecurityScopeAllowOnlyReadAccess,
            None,
            None,
        )
        .map_err(|_| "无法保存 QQ 音乐读取权限。")?;
    let file = BOOKMARK.get().ok_or("无法保存 QQ 音乐读取权限。")?;
    if let Some(parent) = file.parent() {
        std::fs::create_dir_all(parent).map_err(|_| "无法保存 QQ 音乐读取权限。")?;
    }
    std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(file)
        .and_then(|mut output| output.write_all(&bookmark.to_vec()))
        .map_err(|_| "无法保存 QQ 音乐读取权限。")?;
    Ok(true)
}

#[tauri::command]
pub async fn qq_request_access(app: tauri::AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        let (tx, rx) = std::sync::mpsc::channel();
        app.run_on_main_thread(move || {
            let _ = tx.send(select_login());
        })
        .map_err(|_| "无法打开授权窗口。")?;
        tauri::async_runtime::spawn_blocking(move || rx.recv())
            .await
            .map_err(|_| "授权窗口已关闭。")?
            .map_err(|_| "授权窗口已关闭。")?
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Err("当前系统不支持此授权方式。".into())
    }
}
