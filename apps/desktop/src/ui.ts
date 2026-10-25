// View state that is not a route. Lyrics cover the main area without leaving the current page.
import { create } from "zustand";

type Toggle = (open?: boolean) => void;

// Remembered across launches, like the page under them.
const PERSISTED = ["lyricsOpen", "desktopLyricsOpen", "islandOpen", "islandScreen"] as const;

const saved = <T>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    // Flags saved before these became JSON read 1 and 0.
    if (v === "1" || v === "0") return (v === "1") as T;
    return JSON.parse(v ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
};

export const useUi = create<{
  lyricsOpen: boolean;
  // The desktop lyrics bar and the lyrics island are separate windows, each on or off by itself.
  desktopLyricsOpen: boolean;
  islandOpen: boolean;
  // The display the island sits on (see island_screens), or null for the one with the menu bar.
  islandScreen: number | null;
  queueOpen: boolean;
  shortcutsOpen: boolean;
  toggleLyrics: Toggle;
  toggleDesktopLyrics: Toggle;
  toggleIsland: Toggle;
  setIslandScreen: (id: number | null) => void;
  toggleQueue: Toggle;
  toggleShortcuts: Toggle;
}>((set) => ({
  lyricsOpen: saved("lyricsOpen", false),
  desktopLyricsOpen: saved("desktopLyricsOpen", false),
  islandOpen: saved("islandOpen", false),
  islandScreen: saved("islandScreen", null),
  queueOpen: false,
  shortcutsOpen: false,
  toggleLyrics: (open) => set((s) => ({ lyricsOpen: open ?? !s.lyricsOpen })),
  toggleDesktopLyrics: (open) => set((s) => ({ desktopLyricsOpen: open ?? !s.desktopLyricsOpen })),
  toggleIsland: (open) => set((s) => ({ islandOpen: open ?? !s.islandOpen })),
  setIslandScreen: (islandScreen) => set({ islandScreen }),
  toggleQueue: (open) => set((s) => ({ queueOpen: open ?? !s.queueOpen })),
  toggleShortcuts: (open) => set((s) => ({ shortcutsOpen: open ?? !s.shortcutsOpen })),
}));

useUi.subscribe((s, prev) => {
  for (const key of PERSISTED) {
    if (s[key] === prev[key]) continue;
    try {
      localStorage.setItem(key, JSON.stringify(s[key]));
    } catch {}
  }
});
