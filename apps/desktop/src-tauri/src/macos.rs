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

// The lyrics island hangs from the top middle of a screen, over the menu bar, on every Space and over full
// screen apps. It reports the notch so the page can fit around it (zero on a screen without one), and the menu
// bar's height, which the folded island matches.
#[derive(serde::Serialize)]
pub struct Notch {
    width: f64,
    height: f64,
    bar: f64,
}

// A screen the island can sit on. The id is the display's number, stable while it stays plugged in.
#[derive(serde::Serialize)]
pub struct Screen {
    id: u32,
    name: String,
}

fn screen_id(screen: &objc2_app_kit::NSScreen) -> Option<u32> {
    use objc2_foundation::{NSNumber, ns_string};
    let number = screen.deviceDescription().objectForKey(ns_string!("NSScreenNumber"))?;
    Some(number.downcast::<NSNumber>().ok()?.unsignedIntValue())
}

pub fn screens() -> Vec<Screen> {
    let mtm = MainThreadMarker::new().expect("runs on the main thread");
    objc2_app_kit::NSScreen::screens(mtm)
        .iter()
        .filter_map(|s| Some(Screen { id: screen_id(&s)?, name: s.localizedName().to_string() }))
        .collect()
}

// screen is an id from screens(). None, or a screen no longer plugged in, means the one with the menu bar.
pub fn place_island(window: &tauri::WebviewWindow, width: f64, height: f64, screen: Option<u32>) -> tauri::Result<Notch> {
    use objc2_app_kit::{NSScreen, NSStatusWindowLevel, NSWindowCollectionBehavior};
    use objc2_foundation::{NSPoint, NSRect, NSSize};
    let ns_window = window.ns_window()? as *const NSWindow;
    let mtm = MainThreadMarker::new().expect("runs on the main thread");
    // SAFETY: Tauri hands out the live NSWindow of this webview window, and this runs on the main thread.
    let ns_window = unsafe { &*ns_window };
    let screens = NSScreen::screens(mtm);
    let chosen = screen.and_then(|id| screens.iter().find(|s| screen_id(s) == Some(id)));
    let Some(screen) = chosen.or_else(|| screens.firstObject()) else {
        return Ok(Notch { width: 0.0, height: 0.0, bar: 24.0 });
    };
    let frame = screen.frame();
    let top = screen.safeAreaInsets().top;
    // The visible frame stops under the menu bar. A hidden menu bar leaves nothing to measure.
    let visible = screen.visibleFrame();
    let bar = frame.origin.y + frame.size.height - (visible.origin.y + visible.size.height);
    let bar = if bar > 0.0 { bar } else { top.max(24.0) };
    let notch = if top > 0.0 {
        Notch {
            width: frame.size.width - screen.auxiliaryTopLeftArea().size.width - screen.auxiliaryTopRightArea().size.width,
            height: top,
            bar,
        }
    } else {
        Notch { width: 0.0, height: 0.0, bar }
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

// The cursor in the window's own points, from its top left: what the page calls clientX and clientY. Both
// readings are in AppKit's global points, so screens of different scales agree.
pub fn cursor(window: &tauri::WebviewWindow) -> tauri::Result<(f64, f64)> {
    let ns_window = window.ns_window()? as *const NSWindow;
    // SAFETY: Tauri hands out the live NSWindow of this webview window, and this runs on the main thread.
    let ns_window = unsafe { &*ns_window };
    let frame = ns_window.frame();
    let mouse = objc2_app_kit::NSEvent::mouseLocation();
    Ok((mouse.x - frame.origin.x, frame.origin.y + frame.size.height - mouse.y))
}
