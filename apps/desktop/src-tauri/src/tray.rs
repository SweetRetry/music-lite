// The menu bar (tray) icon. Playback items are forwarded to the web layer as a "control" event carrying the
// item id, because the player lives there. The web layer reports what is playing back through now_playing.
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Wry};

pub struct Tray {
    song: MenuItem<Wry>,
    toggle: MenuItem<Wry>,
}

pub fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let song = MenuItem::with_id(app, "song", "未在播放", false, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle", "播放", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &song,
            &PredefinedMenuItem::separator(app)?,
            &toggle,
            &MenuItem::with_id(app, "prev", "上一首", true, None::<&str>)?,
            &MenuItem::with_id(app, "next", "下一首", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?,
            &MenuItem::with_id(app, "quit", "退出 NCM Lite", true, None::<&str>)?,
        ],
    )?;

    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("NCM Lite")
        .menu(&menu)
        // macOS opens the menu on a left click, as menu bar items do. Elsewhere a left click brings the window back.
        .show_menu_on_left_click(cfg!(target_os = "macos"))
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main(app),
            "quit" => app.exit(0),
            id => {
                let _ = app.emit("control", id);
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                if !cfg!(target_os = "macos") {
                    show_main(tray.app_handle());
                }
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    app.manage(Tray { song, toggle });
    Ok(())
}

#[tauri::command]
pub fn now_playing(app: AppHandle, title: Option<String>, playing: bool) -> tauri::Result<()> {
    let tray = app.state::<Tray>();
    tray.song.set_text(title.as_deref().unwrap_or("未在播放"))?;
    tray.toggle.set_text(if playing { "暂停" } else { "播放" })?;
    tray.toggle.set_enabled(title.is_some())?;
    if let Some(icon) = app.tray_by_id("main") {
        icon.set_tooltip(Some(title.as_deref().unwrap_or("NCM Lite")))?;
    }
    Ok(())
}
