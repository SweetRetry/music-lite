// Theme preference. "system" leaves <html data-theme> unset so CSS follows prefers-color-scheme.
// index.html applies the saved value before first paint. Keep KEY in sync with it.
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { create } from "zustand";

export type Theme = "system" | "light" | "dark";

const KEY = "ncm-theme";

function load(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  // Native window theme drives the traffic lights and vibrancy. null follows the OS.
  if (isTauri()) getCurrentWindow().setTheme(theme === "system" ? null : theme).catch(() => {});
}

export const useTheme = create<{ theme: Theme; setTheme: (theme: Theme) => void }>((set) => ({
  theme: load(),
  setTheme: (theme) => {
    try {
      if (theme === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch {}
    apply(theme);
    set({ theme });
  },
}));

apply(useTheme.getState().theme);
