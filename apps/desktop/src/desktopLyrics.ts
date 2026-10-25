// The desktop lyrics: a see-through window above every app, showing the line being sung. The player lives in
// the main window, so this side loads the lyrics and reports the song and the clock. The lyrics window only draws.
import { isTauri } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { type LyricLine, type Track, srcOf } from "./api";
import { artistNames } from "./format";
import { cachedLyric, loadLyric } from "./lyrics";
import type { ProviderId } from "./mode";
import { player, usePlayer } from "./player";
import { useUi } from "./ui";

export const LABEL = "desktop-lyrics";

// The window asks for both on load, and gets each again whenever it changes.
export type Song = { title: string; artist: string; brand: ProviderId; lines: LyricLine[] } | null;
// Where playback was at the wall clock time `at`. The window runs it forward while playing.
export type Clock = { ms: number; at: number; playing: boolean };

let song: Song = null;
let shown: Track | undefined;

const sendSong = () => emitTo(LABEL, "desktop-lyrics:song", song).catch(() => {});
const sendClock = () =>
  emitTo<Clock>(LABEL, "desktop-lyrics:clock", { ms: player.time() * 1000, at: Date.now(), playing: usePlayer.getState().playing }).catch(() => {});

async function follow(track: Track | undefined) {
  shown = track;
  song = track ? { title: track.name, artist: artistNames(track), brand: srcOf(track), lines: cachedLyric(track) ?? [] } : null;
  sendSong();
  if (!track || cachedLyric(track)) return;
  const lines = await loadLyric(track).catch(() => []);
  if (shown !== track || !song) return;
  song = { ...song, lines };
  sendSong();
}

async function open() {
  if (await WebviewWindow.getByLabel(LABEL)) return;
  follow(current());
  // Placed and sized where it was last time by the window-state plugin.
  const w = new WebviewWindow(LABEL, {
    url: "desktop-lyrics.html",
    title: "桌面歌词",
    width: 760,
    height: 140,
    minWidth: 360,
    minHeight: 96,
    center: true,
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
  await (await WebviewWindow.getByLabel(LABEL))?.destroy();
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

  const sync = (on: boolean) => (on ? open() : close()).catch(() => {});
  sync(useUi.getState().desktopLyricsOpen);
  useUi.subscribe((s, prev) => s.desktopLyricsOpen !== prev.desktopLyricsOpen && sync(s.desktopLyricsOpen));

  usePlayer.subscribe((s, prev) => {
    if (!useUi.getState().desktopLyricsOpen) return;
    if (current() !== shown) follow(current());
    if (s.playing !== prev.playing || s.position !== prev.position) sendClock();
  });
}
