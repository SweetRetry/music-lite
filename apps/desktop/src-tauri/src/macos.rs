// The title bar is ours (titleBarStyle "Overlay"), but the traffic lights stay native. An empty unified
// NSToolbar makes AppKit centre them in a 52pt band, the same height as our title bar, and keep them there
// through resizes and fullscreen. Moving the buttons by hand (trafficLightPosition) is undone by AppKit's
// own layout on current macOS.
use objc2::MainThreadMarker;
use objc2_app_kit::{NSToolbar, NSWindow, NSWindowToolbarStyle};

pub fn unified_toolbar(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    let ns_window = window.ns_window()? as *const NSWindow;
    let mtm = MainThreadMarker::new().expect("setup runs on the main thread");
    // SAFETY: Tauri hands out the live NSWindow of this webview window, and setup runs on the main thread.
    let ns_window = unsafe { &*ns_window };
    let toolbar = NSToolbar::new(mtm);
    ns_window.setToolbar(Some(&toolbar));
    ns_window.setToolbarStyle(NSWindowToolbarStyle::Unified);
    Ok(())
}
