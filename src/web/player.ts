// One audio element, one queue. Songs without a playable source are skipped, not fatal.
import { useEffect, useSyncExternalStore } from "react";
import { cover, lite, type Track } from "./lite";

export type PlayerState = {
  queue: Track[];
  index: number;
  playing: boolean;
  loading: boolean;
  position: number;
  duration: number;
  volume: number;
  notice: string;
};

const audio = new Audio();
const listeners = new Set<() => void>();

const savedVolume = (() => {
  try {
    return Number(localStorage.getItem("volume") ?? 0.8);
  } catch {
    return 0.8;
  }
})();
audio.volume = savedVolume;

let state: PlayerState = {
  queue: [],
  index: -1,
  playing: false,
  loading: false,
  position: 0,
  duration: 0,
  volume: savedVolume,
  notice: "",
};

const set = (patch: Partial<PlayerState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

let loadToken = 0;

async function load(index: number, skipped = 0): Promise<void> {
  const track = state.queue[index];
  if (!track) return set({ playing: false });
  const token = ++loadToken;
  set({ index, loading: true, position: 0, duration: track.durationMs / 1000, notice: "" });
  const url = await lite.url(track.id).catch(() => null);
  if (token !== loadToken) return;
  if (!url) {
    if (skipped + 1 >= state.queue.length) return set({ loading: false, playing: false, notice: "这些歌都暂时无法播放" });
    set({ notice: `「${track.name}」无法播放，已跳过` });
    return load((index + 1) % state.queue.length, skipped + 1);
  }
  audio.src = url;
  await audio.play().catch(() => set({ playing: false }));
  set({ loading: false });
  updateMediaSession(track);
}

function updateMediaSession(t: Track) {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.name,
    artist: t.artists,
    album: t.album,
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
    if (state.index < 0) return;
    audio.paused ? audio.play() : audio.pause();
  },
  next() {
    if (state.queue.length) load((state.index + 1) % state.queue.length);
  },
  prev() {
    if (audio.currentTime > 3) audio.currentTime = 0;
    else if (state.queue.length) load((state.index - 1 + state.queue.length) % state.queue.length);
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

export function usePlayer(): PlayerState {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );
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
