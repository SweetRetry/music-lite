// One audio element, one queue. Songs without a playable source are skipped, not fatal.
import { create } from "zustand";
import type { Track } from "./api";
import { DEFAULT_QUALITY, isQuality, type Quality } from "./api/quality";
import { artistNames, cover } from "./format";
import { providerOf } from "./providers";

export const PLAYBACK_MODES = [
  { mode: "repeat-one", label: "单曲循环" },
  { mode: "repeat-all", label: "列表循环" },
  { mode: "shuffle", label: "随机播放" },
] as const;
export type PlaybackMode = (typeof PLAYBACK_MODES)[number]["mode"];

export type PlayerState = {
  queue: Track[];
  index: number;
  // The list the queue was started from (see playlistOrigin), or null for an album, a search, a lone song.
  origin: string | null;
  playing: boolean;
  loading: boolean;
  position: number;
  duration: number;
  volume: number;
  notice: string;
  // What the user asked for, and what the server actually served for the current song.
  quality: Quality;
  source: { level: string; br: number } | null;
  playbackMode: PlaybackMode;
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

const savedPlaybackMode = ((): PlaybackMode => {
  try {
    const mode = localStorage.getItem("playbackMode");
    if (PLAYBACK_MODES.some((item) => item.mode === mode)) return mode as PlaybackMode;
  } catch {}
  return "repeat-all";
})();

// The queue, the song and where it was are remembered, so the next launch opens where this one left off,
// paused. The element stays empty until the first play asks for the song's URL.
type Session = { queue: Track[]; index: number; origin: string | null; position: number };

const saved = ((): Session => {
  try {
    const s = JSON.parse(localStorage.getItem("session") ?? "null");
    if (Array.isArray(s?.queue) && s.queue[s.index]) return { ...s, position: Number(localStorage.getItem("position")) || 0 };
  } catch {}
  return { queue: [], index: -1, origin: null, position: 0 };
})();

export const usePlayer = create<PlayerState>(() => ({
  ...saved,
  origin: saved.origin ?? null,
  playing: false,
  loading: false,
  duration: (saved.queue[saved.index]?.durationMs ?? 0) / 1000,
  volume: savedVolume,
  notice: "",
  quality: savedQuality,
  source: null,
  playbackMode: savedPlaybackMode,
}));

const set = usePlayer.setState;
const state = () => usePlayer.getState();

let loadToken = 0;

// History is the actual traversal; the bag is the unvisited part of this round.
// Track references keep queue insertions and removals from invalidating positions.
let shuffle = { history: [] as Track[], cursor: -1, remaining: [] as Track[] };

function shuffled(tracks: Track[]): Track[] {
  const result = [...tracks];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function resetShuffle() {
  const { queue, index } = state();
  const current = queue[index];
  shuffle = { history: current ? [current] : [], cursor: current ? 0 : -1, remaining: shuffled(queue.filter((t) => t !== current)) };
}
resetShuffle();

function remember(track: Track) {
  if (state().playbackMode !== "shuffle" || shuffle.history[shuffle.cursor] === track) return;
  shuffle.history.splice(shuffle.cursor + 1);
  shuffle.history.push(track);
  const excess = Math.max(0, shuffle.history.length - Math.max(2, state().queue.length * 2));
  shuffle.history.splice(0, excess);
  shuffle.cursor = shuffle.history.length - 1;
}

function step(direction: 1 | -1): number {
  const { queue, index, playbackMode } = state();
  if (!queue.length) return -1;
  if (playbackMode !== "shuffle") return (index + direction + queue.length) % queue.length;
  if (direction < 0) {
    if (shuffle.cursor > 0) shuffle.cursor--;
    return queue.indexOf(shuffle.history[shuffle.cursor]);
  }
  if (shuffle.cursor + 1 < shuffle.history.length) return queue.indexOf(shuffle.history[++shuffle.cursor]);
  if (!shuffle.remaining.length) {
    shuffle.remaining = shuffled(queue);
    // Swap with a random later slot rather than biasing the start toward one particular song.
    if (shuffle.remaining.length > 1 && shuffle.remaining[0] === queue[index]) {
      const at = 1 + Math.floor(Math.random() * (shuffle.remaining.length - 1));
      [shuffle.remaining[0], shuffle.remaining[at]] = [shuffle.remaining[at], shuffle.remaining[0]];
    }
  }
  return queue.indexOf(shuffle.remaining.shift()!);
}

// An element without a source holds no song yet: the restored one, before its first play.
const empty = () => !audio.getAttribute("src");

// WebKit advances currentTime in coarse steps, so reading it every frame stutters. Run our own clock from
// the last reading and nudge it toward each new one. A big gap is a seek or a stall, and snaps.
let clock = { media: 0, at: 0 };
let lastReading = -1;
function smoothTime() {
  const media = audio.currentTime;
  const now = performance.now();
  if (audio.paused || audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
    clock = { media, at: now };
    return media;
  }
  const guess = clock.media + ((now - clock.at) / 1000) * audio.playbackRate;
  if (media !== lastReading) {
    lastReading = media;
    const error = media - guess;
    clock = { media: Math.abs(error) > 0.3 ? media : guess + error * 0.2, at: now };
    return clock.media;
  }
  return guess;
}

// keep resumes the current song at a position: a quality switch, where the old stream keeps playing until the
// new URL arrives, or the first play of the restored song.
async function load(index: number, attempted = new Set<Track>(), keep?: { at: number; play: boolean }): Promise<void> {
  const track = state().queue[index];
  if (!track) return set({ playing: false });
  const token = ++loadToken;
  set(
    keep
      ? { loading: true }
      : { index, loading: true, position: 0, duration: track.durationMs / 1000, notice: "", source: null },
  );
  const src = track.unavailable ? null : await providerOf(track).songUrl(track, state().quality).catch(() => null);
  if (token !== loadToken) return;
  if (!src) {
    if (keep && !empty()) return set({ loading: false, notice: "这个音质暂时无法播放" });
    attempted.add(track);
    if (attempted.size >= state().queue.length) return set({ loading: false, playing: false, notice: "这些歌都暂时无法播放" });
    set({ notice: `「${track.name}」无法播放，已跳过` });
    let next = step(1);
    while (attempted.has(state().queue[next])) next = step(1);
    return load(next, attempted);
  }
  audio.src = src.url;
  if (keep) {
    audio.currentTime = keep.at;
    set({ position: keep.at, notice: "" });
  }
  set({ source: { level: src.level, br: src.br } });
  remember(track);
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

export const playlistOrigin = (id: number) => `playlist:${id}`;
export const DAILY_ORIGIN = "daily";

export const player = {
  // Smooth to the frame; timeupdate only fires about 4 times a second.
  time: () => (empty() ? state().position : smoothTime()),
  // Songs that were taken down stay out of the queue. Asking for one directly says why nothing plays.
  playQueue(queue: Track[], index: number, origin: string | null = null) {
    const target = queue[index];
    if (target?.unavailable) return set({ notice: `「${target.name}」已下架，无法播放` });
    const playable = queue.filter((t) => !t.unavailable);
    const at = playable.indexOf(target);
    set({ queue: playable, index: at, origin });
    resetShuffle();
    return load(at);
  },
  toggle() {
    if (state().index < 0) return;
    if (empty()) load(state().index, undefined, { at: state().position, play: true });
    else audio.paused ? audio.play() : audio.pause();
  },
  next() {
    if (state().queue.length) return load(step(1));
  },
  prev() {
    if (audio.currentTime > 3) audio.currentTime = 0;
    else if (state().queue.length) return load(step(-1));
  },
  jumpTo(index: number) {
    const track = state().queue[index];
    if (!track) return;
    if (state().playbackMode === "shuffle") {
      shuffle.history.splice(shuffle.cursor + 1);
      shuffle.remaining = shuffle.remaining.filter((t) => t !== track);
    }
    return load(index);
  },
  remove(index: number) {
    const { queue, index: current } = state();
    if (!queue[index]) return;
    const next = queue.filter((_, i) => i !== index);
    const target = queue[index];
    const before = shuffle.history.slice(0, shuffle.cursor + 1).filter((t) => t !== target).length;
    shuffle.history = shuffle.history.filter((t) => t !== target);
    shuffle.cursor = before - 1;
    shuffle.remaining = shuffle.remaining.filter((t) => t !== target);
    if (index < current) return set({ queue: next, index: current - 1 });
    if (index > current) return set({ queue: next });
    set({ queue: next, index: -1 });
    // The song that slid into the removed slot plays next.
    if (next.length) return load(state().playbackMode === "shuffle" ? step(1) : Math.min(index, next.length - 1));
    else player.clear();
  },
  clear() {
    loadToken++;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
    set({ queue: [], index: -1, origin: null, playing: false, loading: false, position: 0, duration: 0, notice: "", source: null });
    resetShuffle();
  },
  // Insert right after the current song. A copy elsewhere in the queue moves instead of doubling up.
  playNext(track: Track) {
    if (track.unavailable) return set({ notice: `「${track.name}」已下架，无法播放` });
    const { queue, index } = state();
    const current = queue[index];
    if (!current) return player.playQueue([track], 0);
    const same = (t: Track) => t.id === track.id && (t.src ?? "ncm") === (track.src ?? "ncm");
    if (same(current)) return;
    // Preserve the queued object so the traversal's references remain valid.
    track = queue.find(same) ?? track;
    const rest = queue.filter((t) => t === current || !same(t));
    const at = rest.indexOf(current);
    set({ queue: [...rest.slice(0, at + 1), track, ...rest.slice(at + 1)], index: at });
    if (state().playbackMode === "shuffle") {
      shuffle.history.splice(shuffle.cursor + 1);
      shuffle.remaining = [track, ...shuffle.remaining.filter((t) => !same(t))];
    }
  },
  setPlaybackMode(playbackMode: PlaybackMode) {
    if (state().playbackMode === playbackMode) return;
    set({ playbackMode });
    resetShuffle();
    try { localStorage.setItem("playbackMode", playbackMode); } catch {}
  },
  setQuality(quality: Quality) {
    if (quality === state().quality) return;
    set({ quality });
    try {
      localStorage.setItem("quality", quality);
    } catch {}
    const { index, queue, loading } = state();
    // The restored song picks the new quality up on its first play.
    if (!queue[index] || empty()) return;
    // Mid-load the element still holds the previous song, so restart the new one instead of resuming.
    load(index, undefined, loading ? undefined : { at: audio.currentTime, play: !audio.paused });
  },
  seek(seconds: number) {
    if (!empty()) audio.currentTime = seconds;
    set({ position: seconds });
    savePosition(seconds);
  },
  // Relative seek, clamped to the song. Does nothing while no song is ready.
  seekBy(seconds: number) {
    const { index, loading, duration } = state();
    if (index < 0 || loading || !duration) return;
    player.seek(Math.min(Math.max(player.time() + seconds, 0), duration));
  },
  adjustVolume(delta: number) {
    player.setVolume(Math.round(Math.min(Math.max(state().volume + delta, 0), 1) * 100) / 100);
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
audio.addEventListener("timeupdate", () => {
  set({ position: audio.currentTime });
  savePosition(audio.currentTime);
});
audio.addEventListener("durationchange", () => isFinite(audio.duration) && set({ duration: audio.duration }));
audio.addEventListener("ended", () => {
  if (state().playbackMode === "repeat-one") load(state().index);
  else player.next();
});

function savePosition(seconds: number) {
  try {
    localStorage.setItem("position", seconds.toFixed(1));
  } catch {}
}

usePlayer.subscribe((s, prev) => {
  if (s.queue === prev.queue && s.index === prev.index && s.origin === prev.origin) return;
  try {
    localStorage.setItem("session", JSON.stringify({ queue: s.queue, index: s.index, origin: s.origin }));
  } catch {}
});

if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", () => audio.play());
  navigator.mediaSession.setActionHandler("pause", () => audio.pause());
  navigator.mediaSession.setActionHandler("nexttrack", () => player.next());
  navigator.mediaSession.setActionHandler("previoustrack", () => player.prev());
}
