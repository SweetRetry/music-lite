// Artist payloads, normalized. The official client's /api/artist/v3/detail needs a cache_key signed by
// its native layer and returns 400 without one; /api/v1/artist/{id} returns the same artist + hotSongs.
import { type Track, https, toTrack } from "../api";
import { eapi } from "../eapi";
import { type AlbumCard, toAlbumCard } from "./album";

export type Artist = {
  id: number;
  name: string;
  alias: string;
  intro: string;
  avatar: string;
  songCount: number;
  albumCount: number;
  hotSongs: Track[];
  albums: AlbumCard[];
};

export async function artist(id: number): Promise<Artist> {
  const [detail, albums] = await Promise.all([
    eapi(`/api/v1/artist/${id}`),
    eapi(`/api/artist/albums/${id}`, { limit: 100, offset: 0 }),
  ]);
  const a = detail.artist ?? {};
  const hotSongs: Track[] = (detail.hotSongs ?? []).slice(0, 50).map(toTrack);
  return {
    id,
    name: a.name ?? "",
    alias: [...(a.alias ?? []), ...(a.trans ? [a.trans] : [])].join(" / "),
    intro: (a.briefDesc ?? "").trim(),
    avatar: https(a.picUrl ?? a.img1v1Url),
    songCount: a.musicSize ?? hotSongs.length,
    albumCount: a.albumSize ?? 0,
    hotSongs,
    albums: (albums.hotAlbums ?? []).map(toAlbumCard),
  };
}
