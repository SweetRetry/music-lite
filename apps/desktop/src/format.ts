import type { LyricLine, Track } from "./api";

export const cover = (url: string, size: number) => (url ? `${url}?param=${size * 2}y${size * 2}` : "");

export const duration = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const artistNames = (t: Track) => t.artists.map((a) => a.name).join(" / ");

// The lyric line sung at ms, or -1 before the first.
export function lineAt(lines: LyricLine[], ms: number) {
  let i = -1;
  while (i + 1 < lines.length && lines[i + 1].ms <= ms) i++;
  return i;
}
