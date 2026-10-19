import type { Track } from "./api";

export const cover = (url: string, size: number) => (url ? `${url}?param=${size * 2}y${size * 2}` : "");

export const duration = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const artistNames = (t: Track) => t.artists.map((a) => a.name).join(" / ");
