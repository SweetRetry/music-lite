// Album payloads, normalized. The official client's /api/album/v3/detail needs a cache_key signed by its
// native layer and returns 400 without one; /api/v1/album/{id} returns { album, songs } instead.
import { type Ref, type Track, https, toTrack } from "../api";
import { eapi } from "../eapi";

export type AlbumCard = { id: string; name: string; cover: string; year: string };
export type Album = {
  id: string;
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
  id: String(a.id),
  name: a.name,
  cover: https(a.picUrl),
  year: year(a.publishTime),
});

export async function album(id: string): Promise<Album> {
  const res = await eapi(`/api/v1/album/${id}`);
  const info = res.album ?? {};
  const cover = https(info.picUrl);
  const tracks: Track[] = (res.songs ?? []).map((s: any) => {
    const t = toTrack(s);
    return { ...t, cover: t.cover || cover };
  });
  return {
    id,
    name: info.name ?? "",
    cover,
    artists: (info.artists ?? []).map((a: any) => ({ id: a.id, name: a.name })),
    publishTime: info.publishTime ?? 0,
    trackCount: info.size ?? tracks.length,
    description: (info.description ?? "").trim(),
    tracks,
  };
}
