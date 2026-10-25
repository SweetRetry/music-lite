// View state that is not a route. Lyrics cover the main area without leaving the current page.
import { create } from "zustand";

type Toggle = (open?: boolean) => void;

// Remembered across launches, like the page under them.
const PERSISTED = ["lyricsOpen", "desktopLyricsOpen"] as const;

const saved = (key: string) => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

export const useUi = create<{
  lyricsOpen: boolean;
  desktopLyricsOpen: boolean;
  queueOpen: boolean;
  shortcutsOpen: boolean;
  toggleLyrics: Toggle;
  toggleDesktopLyrics: Toggle;
  toggleQueue: Toggle;
  toggleShortcuts: Toggle;
}>((set) => ({
  lyricsOpen: saved("lyricsOpen"),
  desktopLyricsOpen: saved("desktopLyricsOpen"),
  queueOpen: false,
  shortcutsOpen: false,
  toggleLyrics: (open) => set((s) => ({ lyricsOpen: open ?? !s.lyricsOpen })),
  toggleDesktopLyrics: (open) => set((s) => ({ desktopLyricsOpen: open ?? !s.desktopLyricsOpen })),
  toggleQueue: (open) => set((s) => ({ queueOpen: open ?? !s.queueOpen })),
  toggleShortcuts: (open) => set((s) => ({ shortcutsOpen: open ?? !s.shortcutsOpen })),
}));

useUi.subscribe((s, prev) => {
  for (const key of PERSISTED) {
    if (s[key] === prev[key]) continue;
    try {
      localStorage.setItem(key, s[key] ? "1" : "0");
    } catch {}
  }
});
