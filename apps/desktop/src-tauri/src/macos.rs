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

// The lyrics island hangs from the top middle of the menu bar screen, over the menu bar, on every Space and
// over full screen apps. It reports the notch so the page can fit around it: zero on a screen without one.
#[derive(serde::Serialize)]
pub struct Notch {
    width: f64,
    height: f64,
}

pub fn place_island(window: &tauri::WebviewWindow, width: f64, height: f64) -> tauri::Result<Notch> {
    use objc2_app_kit::{NSScreen, NSStatusWindowLevel, NSWindowCollectionBehavior};
    use objc2_foundation::{NSPoint, NSRect, NSSize};
    let ns_window = window.ns_window()? as *const NSWindow;
    let mtm = MainThreadMarker::new().expect("runs on the main thread");
    // SAFETY: Tauri hands out the live NSWindow of this webview window, and this runs on the main thread.
    let ns_window = unsafe { &*ns_window };
    let screens = NSScreen::screens(mtm);
    let Some(screen) = screens.firstObject() else {
        return Ok(Notch { width: 0.0, height: 0.0 });
    };
    let frame = screen.frame();
    let top = screen.safeAreaInsets().top;
    let notch = if top > 0.0 {
        Notch {
            width: frame.size.width - screen.auxiliaryTopLeftArea().size.width - screen.auxiliaryTopRightArea().size.width,
            height: top,
        }
    } else {
        Notch { width: 0.0, height: 0.0 }
    };
    ns_window.setLevel(NSStatusWindowLevel);
    ns_window.setCollectionBehavior(
        NSWindowCollectionBehavior::CanJoinAllSpaces
            | NSWindowCollectionBehavior::Stationary
            | NSWindowCollectionBehavior::FullScreenAuxiliary
            | NSWindowCollectionBehavior::IgnoresCycle,
    );
    // AppKit counts up from the bottom of the screen.
    let origin = NSPoint::new(frame.origin.x + (frame.size.width - width) / 2.0, frame.origin.y + frame.size.height - height);
    ns_window.setFrame_display(NSRect::new(origin, NSSize::new(width, height)), true);
    Ok(notch)
}
