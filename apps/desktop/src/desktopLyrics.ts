// The desktop lyrics: see-through windows above every app showing the line being sung. A bar the user places,
// and an island at the top of a screen, each on or off by itself. The player lives in the main window, so this side loads the lyrics and
// broadcasts the song and the clock. The lyrics window only draws.
import { isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { type LyricLine, type Track, srcOf } from "./api";
import { artistNames, cover } from "./format";
import { cachedLyric, loadLyric } from "./lyrics";
import type { ProviderId } from "./mode";
import { useLibrary } from "./library";
import { player, usePlayer } from "./player";
import { useUi } from "./ui";

// The windows ask for both on load, and get each again whenever it changes.
export type Song = {
  title: string;
  artist: string;
  cover: string;
  brand: ProviderId;
  durationMs: number;
  liked: boolean;
  lines: LyricLine[];
} | null;
// Where playback was at the wall clock time `at`. The windows run it forward while playing.
export type Clock = { ms: number; at: number; playing: boolean };

type Kind = "bar" | "island";

// The island's label is also in lib.rs (window-state denylist) and the capabilities.
const LABELS: Record<Kind, string> = { bar: "desktop-lyrics", island: "lyrics-island" };

// The island stays put and sizes itself, so it is created hidden and shows once placed. Its screen rides in
// the URL: a new screen is a new window.
const windows = (screen: number | null) => ({
  bar: { url: "desktop-lyrics.html", width: 760, height: 140, minWidth: 360, minHeight: 96, center: true, resizable: true },
  island: { url: `desktop-lyrics.html#island=${screen ?? ""}`, width: 500, height: 260, resizable: false, visible: false },
});

let song: Song = null;
let shown: Track | undefined;

const sendSong = () => emit("desktop-lyrics:song", song).catch(() => {});
const sendClock = () =>
  emit<Clock>("desktop-lyrics:clock", { ms: player.time() * 1000, at: Date.now(), playing: usePlayer.getState().playing }).catch(() => {});

async function follow(track: Track | undefined) {
  shown = track;
  song = track ? { title: track.name, artist: artistNames(track), cover: cover(track.cover, 48), brand: srcOf(track),
        durationMs: track.durationMs,
        liked: useLibrary.getState().liked.has(track.id),
        lines: cachedLyric(track) ?? [] } : null;
  sendSong();
  if (!track || cachedLyric(track)) return;
  const lines = await loadLyric(track).catch(() => []);
  if (shown !== track || !song) return;
  song = { ...song, lines };
  sendSong();
}

const destroy = async (kind: Kind) => (await WebviewWindow.getByLabel(LABELS[kind]))?.destroy();

async function open(kind: Kind) {
  if (await WebviewWindow.getByLabel(LABELS[kind])) return;
  if (!shown) follow(current());
  // The bar comes back where it was last time, by the window-state plugin.
  const w = new WebviewWindow(LABELS[kind], {
    ...windows(useUi.getState().islandScreen)[kind],
    title: kind === "bar" ? "桌面歌词" : "灵动岛",
    transparent: true,
    decorations: false,
    shadow: false,
    alwaysOnTop: true,
    visibleOnAllWorkspaces: true,
    skipTaskbar: true,
    focus: false,
    acceptFirstMouse: true,
  });
  w.once("tauri://error", () => (kind === "bar" ? useUi.getState().toggleDesktopLyrics(false) : useUi.getState().toggleIsland(false)));
}

const anyOpen = () => useUi.getState().desktopLyricsOpen || useUi.getState().islandOpen;

const current = () => {
  const { queue, index } = usePlayer.getState();
  return queue[index];
};

if (isTauri()) {
  listen("desktop-lyrics:ready", () => {
    sendSong();
    sendClock();
  });

  const sync = (kind: Kind, on: boolean) => (on ? open(kind) : destroy(kind)).catch(() => {});
  const { desktopLyricsOpen, islandOpen } = useUi.getState();
  sync("bar", desktopLyricsOpen);
  sync("island", islandOpen);
  useUi.subscribe((s, prev) => {
    if (s.desktopLyricsOpen !== prev.desktopLyricsOpen) sync("bar", s.desktopLyricsOpen);
    if (s.islandScreen !== prev.islandScreen && s.islandOpen) destroy("island").then(() => sync("island", true));
    else if (s.islandOpen !== prev.islandOpen) sync("island", s.islandOpen);
    // With both closed nothing listens, and the next open starts from the song playing then.
    if (!anyOpen()) shown = undefined;
  });

  useLibrary.subscribe((s, prev) => {
    if (s.liked === prev.liked || !song || !shown) return;
    const liked = s.liked.has(shown.id);
    if (liked === song.liked) return;
    song = { ...song, liked };
    sendSong();
  });

  usePlayer.subscribe((s, prev) => {
    if (!anyOpen()) return;
    if (current() !== shown) follow(current());
    if (s.playing !== prev.playing || s.position !== prev.position) sendClock();
  });
}
