import * as api from "./api";

export type { LyricLine, Me, Playlist, PlaylistSummary, Track } from "./api";

export const lite = {
  me: api.me,
  playlist: api.playlist,
  daily: api.daily,
  lyric: api.lyric,
  search: api.search,
  url: api.songUrl,
  like: api.like,
};

export const cover = (url: string, size: number) => (url ? `${url}?param=${size * 2}y${size * 2}` : "");

export const duration = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
