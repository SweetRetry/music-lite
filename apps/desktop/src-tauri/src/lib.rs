mod eapi;
mod login;
#[cfg(target_os = "macos")]
mod macos;
mod mcp;
mod qq;
mod qq_access;
mod qq_session;
mod qq_sign;
mod session;
mod shortcuts;
mod tray;

use tauri::{Manager, WindowEvent};
use tauri_plugin_window_state::StateFlags;

// Runs f on the main thread, where AppKit must be called, and waits for its result.
#[cfg(target_os = "macos")]
fn on_main<T: Send + 'static>(window: &tauri::WebviewWindow, f: impl FnOnce(&tauri::WebviewWindow) -> tauri::Result<T> + Send + 'static) -> Result<T, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    let w = window.clone();
    window.run_on_main_thread(move || drop(tx.send(f(&w)))).map_err(|e| e.to_string())?;
    rx.recv().map_err(|e| e.to_string())?.map_err(|e| e.to_string())
}

// The screens the lyrics island can sit on. Empty where the island cannot choose.
#[tauri::command]
fn island_screens(window: tauri::WebviewWindow) -> Result<serde_json::Value, String> {
    #[cfg(target_os = "macos")]
    return on_main(&window, |_| Ok(macos::screens())).and_then(|s| serde_json::to_value(s).map_err(|e| e.to_string()));
    #[cfg(not(target_os = "macos"))]
    {
        let _ = window;
        Ok(serde_json::json!([]))
    }
}

// Puts the lyrics island at the top middle of a screen, sized width by height points, and returns the notch.
#[tauri::command]
fn island_place(window: tauri::WebviewWindow, width: f64, height: f64, screen: Option<u32>) -> Result<serde_json::Value, String> {
    #[cfg(target_os = "macos")]
    return on_main(&window, move |w| macos::place_island(w, width, height, screen))
        .and_then(|n| serde_json::to_value(n).map_err(|e| e.to_string()));
    #[cfg(not(target_os = "macos"))]
    {
        let _ = screen;
        let monitor = window.primary_monitor().map_err(|e| e.to_string())?.ok_or("no monitor")?;
        let scale = monitor.scale_factor();
        let x = monitor.position().x as f64 / scale + (monitor.size().width as f64 / scale - width) / 2.0;
        window.set_size(tauri::LogicalSize::new(width, height)).map_err(|e| e.to_string())?;
        window.set_position(tauri::LogicalPosition::new(x, monitor.position().y as f64 / scale)).map_err(|e| e.to_string())?;
        Ok(serde_json::json!({ "width": 0, "height": 0, "bar": 32 }))
    }
}

// The cursor in the calling window's points, from its top left.
#[tauri::command]
fn window_cursor(window: tauri::WebviewWindow) -> Result<(f64, f64), String> {
    #[cfg(target_os = "macos")]
    return on_main(&window, macos::cursor);
    #[cfg(not(target_os = "macos"))]
    {
        let scale = window.scale_factor().map_err(|e| e.to_string())?;
        let c = window.cursor_position().map_err(|e| e.to_string())?;
        let p = window.inner_position().map_err(|e| e.to_string())?;
        Ok(((c.x - p.x as f64) / scale, (c.y - p.y as f64) / scale))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Size, position and maximized state come back on the next launch. Visibility does not: the window is
        // hidden whenever the app quits from the tray, and must still open.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() - StateFlags::VISIBLE)
                // The lyrics island places itself.
                .with_denylist(&["lyrics-island"])
                .build(),
        )
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            session::init(app.path().app_data_dir()?);
            qq_access::init(app.path().app_data_dir()?);
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                macos::unified_toolbar(&window)?;
            }
            tray::create(app.handle())?;
            shortcuts::register(app.handle());
            mcp::serve(app.handle().clone());
            Ok(())
        })
        // Closing the main window hides it and the music keeps playing. Quit from the tray menu or with Cmd+Q.
        // The desktop lyrics window closes for real.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event
                && window.label() == "main"
            {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            eapi::eapi,
            tray::now_playing,
            island_screens,
            island_place,
            window_cursor,
            login::login_qr_poll,
            login::login_official_available,
            login::login_official,
            qq::qq_login,
            qq::qqapi,
            qq_access::qq_request_access,
            mcp::mcp_reply,
        ])
        .build(tauri::generate_context!())
        .expect("error while running Music Lite")
        .run(|app, event| {
            // Clicking the Dock icon brings a hidden window back.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                tray::show_main(app);
            }
            let _ = (app, event);
        });
}
