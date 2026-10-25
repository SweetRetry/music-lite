// The desktop lyrics: a see-through window above every app, showing the line being sung, as a bar or as an
// island at the top of the screen. The player lives in the main window, so this side loads the lyrics and
// broadcasts the song and the clock. The lyrics window only draws.
import { isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { type LyricLine, type Track, srcOf } from "./api";
import { artistNames, cover } from "./format";
import { cachedLyric, loadLyric } from "./lyrics";
import type { ProviderId } from "./mode";
import { player, usePlayer } from "./player";
import { type DesktopLyricsMode, useUi } from "./ui";

// One window per mode. The island's label is also in lib.rs (window-state denylist) and the capabilities.
const LABELS: Record<DesktopLyricsMode, string> = { bar: "desktop-lyrics", island: "lyrics-island" };

// The island stays put and sizes itself, so it is created hidden and shows once placed.
const WINDOWS = {
  bar: { url: "desktop-lyrics.html", width: 760, height: 140, minWidth: 360, minHeight: 96, center: true, resizable: true },
  island: { url: "desktop-lyrics.html#island", width: 500, height: 260, resizable: false, visible: false },
} satisfies Record<DesktopLyricsMode, object>;

// The window asks for both on load, and gets each again whenever it changes.
export type Song = { title: string; artist: string; cover: string; brand: ProviderId; lines: LyricLine[] } | null;
// Where playback was at the wall clock time `at`. The window runs it forward while playing.
export type Clock = { ms: number; at: number; playing: boolean };

let song: Song = null;
let shown: Track | undefined;

const sendSong = () => emit("desktop-lyrics:song", song).catch(() => {});
const sendClock = () =>
  emit<Clock>("desktop-lyrics:clock", { ms: player.time() * 1000, at: Date.now(), playing: usePlayer.getState().playing }).catch(() => {});

async function follow(track: Track | undefined) {
  shown = track;
  song = track ? { title: track.name, artist: artistNames(track), cover: cover(track.cover, 48), brand: srcOf(track), lines: cachedLyric(track) ?? [] } : null;
  sendSong();
  if (!track || cachedLyric(track)) return;
  const lines = await loadLyric(track).catch(() => []);
  if (shown !== track || !song) return;
  song = { ...song, lines };
  sendSong();
}

const destroy = async (label: string) => (await WebviewWindow.getByLabel(label))?.destroy();

async function open(mode: DesktopLyricsMode) {
  const other = mode === "bar" ? "island" : "bar";
  await destroy(LABELS[other]);
  if (await WebviewWindow.getByLabel(LABELS[mode])) return;
  follow(current());
  // The bar comes back where it was last time, by the window-state plugin.
  const w = new WebviewWindow(LABELS[mode], {
    ...WINDOWS[mode],
    title: "桌面歌词",
    transparent: true,
    decorations: false,
    shadow: false,
    alwaysOnTop: true,
    visibleOnAllWorkspaces: true,
    skipTaskbar: true,
    focus: false,
    acceptFirstMouse: true,
  });
  w.once("tauri://error", () => useUi.getState().toggleDesktopLyrics(false));
}

async function close() {
  shown = undefined;
  song = null;
  await Promise.all(Object.values(LABELS).map(destroy));
}

const current = () => {
  const { queue, index } = usePlayer.getState();
  return queue[index];
};

if (isTauri()) {
  listen("desktop-lyrics:ready", () => {
    sendSong();
    sendClock();
  });

  const sync = () => {
    const { desktopLyricsOpen, desktopLyricsMode } = useUi.getState();
    (desktopLyricsOpen ? open(desktopLyricsMode) : close()).catch(() => {});
  };
  sync();
  useUi.subscribe((s, prev) => (s.desktopLyricsOpen !== prev.desktopLyricsOpen || s.desktopLyricsMode !== prev.desktopLyricsMode) && sync());

  usePlayer.subscribe((s, prev) => {
    if (!useUi.getState().desktopLyricsOpen) return;
    if (current() !== shown) follow(current());
    if (s.playing !== prev.playing || s.position !== prev.position) sendClock();
  });
}
