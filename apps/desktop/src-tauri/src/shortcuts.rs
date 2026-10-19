// Global shortcuts, the official client's set. They work while the window is hidden, and reach the player
// the way the tray items do, as a "control" event. Keep in sync with the 全局 group in src/shortcuts.ts.
use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

const KEYS: [(&str, &str); 6] = [
    ("Alt+Super+P", "toggle"),
    ("Alt+Super+ArrowLeft", "prev"),
    ("Alt+Super+ArrowRight", "next"),
    ("Alt+Super+ArrowUp", "volumeUp"),
    ("Alt+Super+ArrowDown", "volumeDown"),
    ("Alt+Super+L", "like"),
];

pub fn register(app: &AppHandle) {
    for (keys, action) in KEYS {
        // A combination another app already holds is skipped, not fatal.
        let _ = app.global_shortcut().on_shortcut(keys, move |app, _, event| {
            if event.state == ShortcutState::Pressed {
                let _ = app.emit("control", action);
            }
        });
    }
}

#[cfg(test)]
mod tests {
    // A string that does not parse would be skipped as silently as a taken combination.
    #[test]
    fn every_combination_parses() {
        for (keys, _) in super::KEYS {
            assert!(keys.parse::<tauri_plugin_global_shortcut::Shortcut>().is_ok(), "{keys}");
        }
    }
}
