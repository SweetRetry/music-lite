// View state that is not a route. Lyrics cover the main area without leaving the current page.
import { create } from "zustand";

type Toggle = (open?: boolean) => void;

export const useUi = create<{
  lyricsOpen: boolean;
  queueOpen: boolean;
  shortcutsOpen: boolean;
  toggleLyrics: Toggle;
  toggleQueue: Toggle;
  toggleShortcuts: Toggle;
}>((set) => ({
  // Remembered across launches, like the page under them.
  lyricsOpen: (() => {
    try {
      return localStorage.getItem("lyricsOpen") === "1";
    } catch {
      return false;
    }
  })(),
  queueOpen: false,
  shortcutsOpen: false,
  toggleLyrics: (open) => set((s) => ({ lyricsOpen: open ?? !s.lyricsOpen })),
  toggleQueue: (open) => set((s) => ({ queueOpen: open ?? !s.queueOpen })),
  toggleShortcuts: (open) => set((s) => ({ shortcutsOpen: open ?? !s.shortcutsOpen })),
}));

useUi.subscribe((s, prev) => {
  if (s.lyricsOpen === prev.lyricsOpen) return;
  try {
    localStorage.setItem("lyricsOpen", s.lyricsOpen ? "1" : "0");
  } catch {}
});
