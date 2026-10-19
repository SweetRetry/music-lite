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
  lyricsOpen: false,
  queueOpen: false,
  shortcutsOpen: false,
  toggleLyrics: (open) => set((s) => ({ lyricsOpen: open ?? !s.lyricsOpen })),
  toggleQueue: (open) => set((s) => ({ queueOpen: open ?? !s.queueOpen })),
  toggleShortcuts: (open) => set((s) => ({ shortcutsOpen: open ?? !s.shortcutsOpen })),
}));
