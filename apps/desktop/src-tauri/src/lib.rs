mod eapi;
#[cfg(target_os = "macos")]
mod macos;
mod session;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                macos::unified_toolbar(&window)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![eapi::eapi])
        .run(tauri::generate_context!())
        .expect("error while running NCM Lite");
}
