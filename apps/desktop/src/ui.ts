// View state that is not a route. Lyrics cover the main area without leaving the current page.
import { create } from "zustand";

type Toggle = (open?: boolean) => void;

// The desktop lyrics as a bar the user places, or as an island hanging from the top of the screen.
export type DesktopLyricsMode = "bar" | "island";

// Remembered across launches, like the page under them.
const PERSISTED = ["lyricsOpen", "desktopLyricsOpen"] as const;

const saved = (key: string) => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

const savedMode = (): DesktopLyricsMode => {
  try {
    return localStorage.getItem("desktopLyricsMode") === "island" ? "island" : "bar";
  } catch {
    return "bar";
  }
};

export const useUi = create<{
  lyricsOpen: boolean;
  desktopLyricsOpen: boolean;
  desktopLyricsMode: DesktopLyricsMode;
  queueOpen: boolean;
  shortcutsOpen: boolean;
  toggleLyrics: Toggle;
  toggleDesktopLyrics: Toggle;
  setDesktopLyricsMode: (mode: DesktopLyricsMode) => void;
  toggleQueue: Toggle;
  toggleShortcuts: Toggle;
}>((set) => ({
  lyricsOpen: saved("lyricsOpen"),
  desktopLyricsOpen: saved("desktopLyricsOpen"),
  desktopLyricsMode: savedMode(),
  queueOpen: false,
  shortcutsOpen: false,
  toggleLyrics: (open) => set((s) => ({ lyricsOpen: open ?? !s.lyricsOpen })),
  toggleDesktopLyrics: (open) => set((s) => ({ desktopLyricsOpen: open ?? !s.desktopLyricsOpen })),
  setDesktopLyricsMode: (desktopLyricsMode) => set({ desktopLyricsMode }),
  toggleQueue: (open) => set((s) => ({ queueOpen: open ?? !s.queueOpen })),
  toggleShortcuts: (open) => set((s) => ({ shortcutsOpen: open ?? !s.shortcutsOpen })),
}));

useUi.subscribe((s, prev) => {
  if (s.desktopLyricsMode !== prev.desktopLyricsMode) {
    try {
      localStorage.setItem("desktopLyricsMode", s.desktopLyricsMode);
    } catch {}
  }
  for (const key of PERSISTED) {
    if (s[key] === prev[key]) continue;
    try {
      localStorage.setItem(key, s[key] ? "1" : "0");
    } catch {}
  }
});
