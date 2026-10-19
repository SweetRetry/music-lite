// The three things the lite client does: list my playlists, open one, search. Plus a playable URL.
// Raw NetEase payloads are normalized here so the UI only ever sees Track and Playlist.
import { eapi } from "./eapi";

export type Track = {
  id: number;
  name: string;
  artists: string;
  album: string;
  cover: string;
  durationMs: number;
};

export type PlaylistSummary = { id: number; name: string; cover: string; trackCount: number; mine: boolean };
export type Playlist = PlaylistSummary & { creator: string; tracks: Track[] };
export type Me = { uid: number; nickname: string; avatar: string; playlists: PlaylistSummary[]; liked: number[] };

const toTrack = (s: any): Track => ({
  id: s.id,
  name: s.name,
  artists: (s.ar ?? []).map((a: any) => a.name).join(" / "),
  album: s.al?.name ?? "",
  cover: s.al?.picUrl ?? "",
  durationMs: s.dt ?? 0,
});

const toSummary = (p: any, uid: number): PlaylistSummary => ({
  id: p.id,
  name: p.specialType === 5 ? "我喜欢的音乐" : p.name,
  cover: p.coverImgUrl,
  trackCount: p.trackCount,
  mine: p.userId === uid,
});

export async function me(): Promise<Me> {
  const { account, profile } = await eapi("/api/nuser/account/get");
  const uid = account.id;
  const [{ playlist }, { ids }] = await Promise.all([
    eapi("/api/user/playlist", { uid, limit: 1000, offset: 0, includeVideo: true }),
    eapi("/api/song/like/get", { uid }),
  ]);
  return {
    uid,
    nickname: profile?.nickname ?? "",
    avatar: profile?.avatarUrl ?? "",
    playlists: playlist.map((p: any) => toSummary(p, uid)),
    liked: ids,
  };
}

async function songDetails(ids: number[]): Promise<Track[]> {
  const batches: number[][] = [];
  for (let i = 0; i < ids.length; i += 500) batches.push(ids.slice(i, i + 500));
  const results = await Promise.all(
    batches.map((b) => eapi("/api/v3/song/detail", { c: JSON.stringify(b.map((id) => ({ id }))) })),
  );
  return results.flatMap((r) => r.songs.map(toTrack));
}

export async function playlist(id: number): Promise<Playlist> {
  const { playlist: p } = await eapi("/api/v6/playlist/detail", { id, n: 0, s: 0 });
  const tracks = await songDetails(p.trackIds.map((t: any) => t.id));
  return { ...toSummary(p, p.userId), creator: p.creator?.nickname ?? "", tracks };
}

export async function search(keyword: string): Promise<Track[]> {
  const { result } = await eapi("/api/cloudsearch/pc", { s: keyword, type: 1, limit: 60, offset: 0, total: true });
  return (result?.songs ?? []).map(toTrack);
}

// Returns null when the song has no playable source for this account (region, copyright, removed).
export async function songUrl(id: number): Promise<string | null> {
  const { data } = await eapi("/api/song/enhance/player/url/v1", {
    ids: JSON.stringify([id]),
    level: "exhigh",
    encodeType: "aac",
  });
  return data[0]?.url ?? null;
}

export async function like(id: number, liked: boolean): Promise<void> {
  await eapi("/api/radio/like", { trackId: id, like: liked, alg: "itembased", time: 3 });
}
