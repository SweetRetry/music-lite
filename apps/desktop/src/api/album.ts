// Album payloads, normalized. Endpoint as the official client calls it: /api/album/v3/detail.
import { type Ref, type Track, https, toTrack } from "../api";
import { eapi } from "../eapi";

export type AlbumCard = { id: number; name: string; cover: string; year: string };
export type Album = {
  id: number;
  name: string;
  cover: string;
  artists: Ref[];
  publishTime: number;
  trackCount: number;
  description: string;
  tracks: Track[];
};

const year = (ms: number) => (ms > 0 ? String(new Date(ms).getFullYear()) : "");

export const toAlbumCard = (a: any): AlbumCard => ({
  id: a.id,
  name: a.name,
  cover: https(a.picUrl),
  year: year(a.publishTime),
});

export async function album(id: number): Promise<Album> {
  const res = await eapi("/api/album/v3/detail", { id });
  // The payload has called its header `info` and `album` in different client versions.
  const info = res.info ?? res.album ?? {};
  const cover = https(info.picUrl ?? info.cover ?? info.coverUrl);
  const tracks: Track[] = (res.songs ?? []).map((s: any) => {
    const t = toTrack(s);
    return { ...t, cover: t.cover || cover };
  });
  return {
    id,
    name: info.name ?? "",
    cover,
    artists: (info.artists ?? (info.artist ? [info.artist] : [])).map((a: any) => ({ id: a.id, name: a.name })),
    publishTime: info.publishTime ?? 0,
    trackCount: info.size ?? tracks.length,
    description: (info.description ?? info.desc ?? "").trim(),
    tracks,
  };
}
