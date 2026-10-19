import type { LyricLine, Me, Playlist, Track } from "../server/api";

export type { LyricLine, Me, Playlist, PlaylistSummary, Track } from "../server/api";

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body;
}

export const lite = {
  me: () => get<Me>("/lite/me"),
  playlist: (id: number) => get<Playlist>(`/lite/playlist/${id}`),
  daily: () => get<Track[]>("/lite/daily"),
  lyric: (id: number) => get<LyricLine[]>(`/lite/lyric/${id}`),
  search: (q: string) => get<Track[]>(`/lite/search?q=${encodeURIComponent(q)}`),
  url: (id: number) => get<{ url: string | null }>(`/lite/url/${id}`).then((r) => r.url),
  like: (id: number, liked: boolean) =>
    get(`/lite/like/${id}`, { method: "POST", body: JSON.stringify({ liked }) }),
};

export const cover = (url: string, size: number) => (url ? `${url}?param=${size * 2}y${size * 2}` : "");

export const duration = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
