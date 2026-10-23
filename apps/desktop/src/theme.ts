// Theme preference. The dark tokens live under .dark on <html>; "system" sets it from prefers-color-scheme
// and follows changes. The brand is the other axis: the music service on screen sets data-brand on <html>,
// and the palette for it lives in the ui package's globals.css. index.html applies both saved values before
// first paint. Keep KEY and the mode key in sync with it.
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { create } from "zustand";
import { useMode } from "./mode";

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

const systemDark = matchMedia("(prefers-color-scheme: dark)");

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && systemDark.matches));
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
systemDark.addEventListener("change", () => apply(useTheme.getState().theme));

// One brand per service, named after its mode.
const applyBrand = (brand: string) => void (document.documentElement.dataset.brand = brand);
applyBrand(useMode.getState().mode);
useMode.subscribe((s) => applyBrand(s.mode));
