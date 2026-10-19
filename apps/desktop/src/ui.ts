// View state that is not a route. Lyrics cover the main area without leaving the current page.
import { create } from "zustand";

export const useUi = create<{ lyricsOpen: boolean; toggleLyrics: (open?: boolean) => void }>((set) => ({
  lyricsOpen: false,
  toggleLyrics: (open) => set((s) => ({ lyricsOpen: open ?? !s.lyricsOpen })),
}));
