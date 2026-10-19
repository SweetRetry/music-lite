// One audio element, one queue. Songs without a playable source are skipped, not fatal.
import { useEffect } from "react";
import { create } from "zustand";
import { songUrl, type Track } from "./api";
import { DEFAULT_QUALITY, isQuality, type Quality } from "./api/quality";
import { artistNames, cover } from "./format";

export type PlayerState = {
  queue: Track[];
  index: number;
  playing: boolean;
  loading: boolean;
  position: number;
  duration: number;
  volume: number;
  notice: string;
  // What the user asked for, and what the server actually served for the current song.
  quality: Quality;
  source: { level: string; br: number } | null;
};

const audio = new Audio();

const savedVolume = (() => {
  try {
    return Number(localStorage.getItem("volume") ?? 0.8);
  } catch {
    return 0.8;
  }
})();
audio.volume = savedVolume;

const savedQuality = (() => {
  try {
    const q = localStorage.getItem("quality");
    return isQuality(q) ? q : DEFAULT_QUALITY;
  } catch {
    return DEFAULT_QUALITY;
  }
})();

export const usePlayer = create<PlayerState>(() => ({
  queue: [],
  index: -1,
  playing: false,
  loading: false,
  position: 0,
  duration: 0,
  volume: savedVolume,
  notice: "",
  quality: savedQuality,
  source: null,
}));

const set = usePlayer.setState;
const state = () => usePlayer.getState();

let loadToken = 0;

// keep is a quality switch: same song, same position, and the old stream keeps playing until the new URL arrives.
async function load(index: number, skipped = 0, keep?: { at: number; play: boolean }): Promise<void> {
  const track = state().queue[index];
  if (!track) return set({ playing: false });
  const token = ++loadToken;
  set(
    keep
      ? { loading: true }
      : { index, loading: true, position: 0, duration: track.durationMs / 1000, notice: "", source: null },
  );
  const src = await songUrl(track.id, state().quality).catch(() => null);
  if (token !== loadToken) return;
  if (!src) {
    if (keep) return set({ loading: false, notice: "这个音质暂时无法播放" });
    if (skipped + 1 >= state().queue.length) return set({ loading: false, playing: false, notice: "这些歌都暂时无法播放" });
    set({ notice: `「${track.name}」无法播放，已跳过` });
    return load((index + 1) % state().queue.length, skipped + 1);
  }
  audio.src = src.url;
  if (keep) {
    audio.currentTime = keep.at;
    set({ position: keep.at, notice: "" });
  }
  set({ source: { level: src.level, br: src.br } });
  if (!keep || keep.play) await audio.play().catch(() => set({ playing: false }));
  set({ loading: false });
  updateMediaSession(track);
}

function updateMediaSession(t: Track) {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.name,
    artist: artistNames(t),
    album: t.album.name,
    artwork: [{ src: cover(t.cover, 256), sizes: "512x512" }],
  });
}

export const player = {
  // Read straight from the element; timeupdate only fires about 4 times a second.
  time: () => audio.currentTime,
  playQueue(queue: Track[], index: number) {
    set({ queue });
    return load(index);
  },
  toggle() {
    if (state().index < 0) return;
    audio.paused ? audio.play() : audio.pause();
  },
  next() {
    if (state().queue.length) load((state().index + 1) % state().queue.length);
  },
  prev() {
    if (audio.currentTime > 3) audio.currentTime = 0;
    else if (state().queue.length) load((state().index - 1 + state().queue.length) % state().queue.length);
  },
  jumpTo(index: number) {
    if (state().queue[index]) load(index);
  },
  remove(index: number) {
    const { queue, index: current } = state();
    if (!queue[index]) return;
    const next = queue.filter((_, i) => i !== index);
    if (index < current) return set({ queue: next, index: current - 1 });
    if (index > current) return set({ queue: next });
    set({ queue: next });
    // The song that slid into the removed slot plays next.
    if (next.length) load(Math.min(index, next.length - 1));
    else player.clear();
  },
  clear() {
    loadToken++;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
    set({ queue: [], index: -1, playing: false, loading: false, position: 0, duration: 0, notice: "", source: null });
  },
  // Insert right after the current song. A copy elsewhere in the queue moves instead of doubling up.
  playNext(track: Track) {
    const { queue, index } = state();
    const current = queue[index];
    if (!current) return player.playQueue([track], 0);
    if (current.id === track.id) return;
    const rest = queue.filter((t) => t === current || t.id !== track.id);
    const at = rest.indexOf(current);
    set({ queue: [...rest.slice(0, at + 1), track, ...rest.slice(at + 1)], index: at });
  },
  setQuality(quality: Quality) {
    if (quality === state().quality) return;
    set({ quality });
    try {
      localStorage.setItem("quality", quality);
    } catch {}
    const { index, queue, loading } = state();
    if (!queue[index]) return;
    // Mid-load the element still holds the previous song, so restart the new one instead of resuming.
    load(index, 0, loading ? undefined : { at: audio.currentTime, play: !audio.paused });
  },
  seek(seconds: number) {
    audio.currentTime = seconds;
    set({ position: seconds });
  },
  setVolume(volume: number) {
    audio.volume = volume;
    set({ volume });
    try {
      localStorage.setItem("volume", String(volume));
    } catch {}
  },
};

audio.addEventListener("play", () => set({ playing: true }));
audio.addEventListener("pause", () => set({ playing: false }));
audio.addEventListener("timeupdate", () => set({ position: audio.currentTime }));
audio.addEventListener("durationchange", () => isFinite(audio.duration) && set({ duration: audio.duration }));
audio.addEventListener("ended", () => player.next());

if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", () => audio.play());
  navigator.mediaSession.setActionHandler("pause", () => audio.pause());
  navigator.mediaSession.setActionHandler("nexttrack", () => player.next());
  navigator.mediaSession.setActionHandler("previoustrack", () => player.prev());
}

export function usePlayerShortcuts(focusSearch: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement;
      if ((e.metaKey && e.key === "f") || (!typing && e.key === "/")) {
        e.preventDefault();
        focusSearch();
      } else if (!typing && e.code === "Space") {
        e.preventDefault();
        player.toggle();
      } else if (!typing && e.metaKey && e.key === "ArrowRight") player.next();
      else if (!typing && e.metaKey && e.key === "ArrowLeft") player.prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusSearch]);
}
