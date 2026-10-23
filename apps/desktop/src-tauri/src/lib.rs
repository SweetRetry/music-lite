mod eapi;
mod login;
#[cfg(target_os = "macos")]
mod macos;
mod mcp;
mod qq;
mod qq_session;
mod qq_sign;
mod session;
mod shortcuts;
mod tray;

use tauri::{Manager, WindowEvent};
use tauri_plugin_window_state::StateFlags;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Size, position and maximized state come back on the next launch. Visibility does not: the window is
        // hidden whenever the app quits from the tray, and must still open.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() - StateFlags::VISIBLE)
                .build(),
        )
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            session::init(app.path().app_data_dir()?);
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                macos::unified_toolbar(&window)?;
            }
            tray::create(app.handle())?;
            shortcuts::register(app.handle());
            mcp::serve(app.handle().clone());
            Ok(())
        })
        // Closing the window hides it and the music keeps playing. Quit from the tray menu or with Cmd+Q.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            eapi::eapi,
            tray::now_playing,
            login::login_qr_poll,
            login::login_official_available,
            login::login_official,
            qq::qq_login,
            qq::qqapi,
            mcp::mcp_reply,
        ])
        .build(tauri::generate_context!())
        .expect("error while running NCM Lite")
        .run(|app, event| {
            // Clicking the Dock icon brings a hidden window back.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                tray::show_main(app);
            }
            let _ = (app, event);
        });
}
