// The three things the lite client does: list my playlists, open one, search. Plus a playable URL.
// Raw NetEase payloads are normalized here so the UI only ever sees Track and Playlist.
import { eapi } from "./eapi";
import { levelOf, type Quality } from "./api/quality";
import type { ProviderId } from "./mode";

// QQ Music names its artists and albums by a mid, a string, next to the numeric id.
export type Ref = { id: number; name: string; mid?: string };

// What an artist or album page is addressed by.
export const pageId = (r: Ref) => r.mid ?? String(r.id);

export type Track = {
  id: number;
  name: string;
  artists: Ref[];
  album: Ref;
  cover: string;
  durationMs: number;
  // fee 1 means the song needs a VIP subscription to play in full.
  vip: boolean;
  // Taken down (privilege.st < 0, -200 in every case seen): NetEase still lists it but serves no audio.
  // Optional because copies cached before this field existed lack it.
  unavailable?: boolean;
  reason?: string;
  // Which service the song comes from. Absent means NetEase, which is what copies cached before QQ Music had.
  src?: ProviderId;
  // QQ Music plays and edits a song by its mid, a string, next to the numeric id.
  mid?: string;
};

// Which service a song comes from.
export const srcOf = (t: Track): ProviderId => t.src ?? "ncm";

export type LyricWord = { ms: number; durationMs: number; text: string };
// words is present when NetEase has word-level timing (yrc) for the song.
export type LyricLine = { ms: number; text: string; trans?: string; words?: LyricWord[] };

// liked marks the account's "我喜欢的音乐" playlist, which the UI treats as the library, not as a playlist.
export type PlaylistSummary = { id: number; name: string; cover: string; trackCount: number; mine: boolean; liked: boolean };
export type Playlist = PlaylistSummary & { creator: string; tracks: Track[] };
export type Me = { uid: number; nickname: string; avatar: string; playlists: PlaylistSummary[]; liked: number[] };

// NetEase hands out http:// media URLs. The packaged app runs on a secure origin where WebKit
// blocks those, and the same CDNs serve https.
export const https = (url: string | null | undefined) => url?.replace(/^http:\/\//, "https://") ?? "";

// Every song list payload carries a privilege per song, except /api/v3/song/detail, which returns them
// in a separate array that the caller passes in.
export const toTrack = (s: any, privilege = s.privilege): Track => ({
  id: s.id,
  name: s.name,
  artists: (s.ar ?? []).map((a: any) => ({ id: a.id, name: a.name })),
  album: { id: s.al?.id ?? 0, name: s.al?.name ?? "" },
  cover: https(s.al?.picUrl),
  durationMs: s.dt ?? 0,
  vip: s.fee === 1,
  unavailable: (privilege?.st ?? 0) < 0,
});

export const toSummary = (p: any, uid: number): PlaylistSummary => ({
  id: p.id,
  name: p.specialType === 5 ? "我喜欢的音乐" : p.name,
  cover: https(p.coverImgUrl),
  trackCount: p.trackCount,
  mine: p.userId === uid,
  liked: p.specialType === 5 && p.userId === uid,
});

// null when signed out.
export async function me(): Promise<Me | null> {
  const { account, profile } = await eapi("/api/nuser/account/get");
  if (!account) return null;
  const uid = account.id;
  const [{ playlist }, { ids }] = await Promise.all([
    eapi("/api/user/playlist", { uid, limit: 1000, offset: 0, includeVideo: true }),
    eapi("/api/song/like/get", { uid }),
  ]);
  return {
    uid,
    nickname: profile?.nickname ?? "",
    avatar: https(profile?.avatarUrl),
    playlists: playlist.map((p: any) => toSummary(p, uid)),
    liked: ids,
  };
}

export async function songDetails(ids: number[]): Promise<Track[]> {
  const batches: number[][] = [];
  for (let i = 0; i < ids.length; i += 500) batches.push(ids.slice(i, i + 500));
  const results = await Promise.all(
    batches.map((b) => eapi("/api/v3/song/detail", { c: JSON.stringify(b.map((id) => ({ id }))) })),
  );
  // privileges is not index-aligned with songs (it also has entries for ids that returned no song).
  return results.flatMap((r) => {
    const privileges = new Map(r.privileges?.map((p: any) => [p.id, p]));
    return r.songs.map((s: any) => toTrack(s, privileges.get(s.id)));
  });
}

// uid is the signed-in account, so mine and liked describe the viewer, not the creator.
export async function playlist(id: number, uid: number): Promise<Playlist> {
  const { playlist: p } = await eapi("/api/v6/playlist/detail", { id, n: 0, s: 0 });
  const tracks = await songDetails(p.trackIds.map((t: any) => t.id));
  return { ...toSummary(p, uid), creator: p.creator?.nickname ?? "", tracks };
}

export async function search(keyword: string): Promise<Track[]> {
  const { result } = await eapi("/api/cloudsearch/pc", { s: keyword, type: 1, limit: 60, offset: 0, total: true });
  return (result?.songs ?? []).map(toTrack);
}

// level is what the server actually served, which can be lower than asked for (no VIP, no such file).
// br is in bits per second.
export type SongSource = { url: string; level: string; br: number };

// Returns null when the song has no playable source for this account (region, copyright, removed).
export async function songUrl(id: number, level: Quality): Promise<SongSource | null> {
  const { data } = await eapi("/api/song/enhance/player/url/v1", {
    ids: JSON.stringify([id]),
    level,
    encodeType: "aac",
  });
  const d = data[0];
  if (!d?.url) return null;
  const br = Number(d.br) || 0;
  return { url: https(d.url), level: levelOf(d.level, br), br };
}

export async function daily(): Promise<Track[]> {
  const { data } = await eapi("/api/v3/discovery/recommend/songs");
  return data.dailySongs.map((s: any) => ({ ...toTrack(s), reason: s.reason ?? undefined }));
}

// LRC lines may carry several timestamps. Credit lines arrive as JSON objects and are dropped.
export function parseLrc(lrc = ""): Map<number, string> {
  const lines = new Map<number, string>();
  for (const row of lrc.split("\n")) {
    const stamps = [...row.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    const text = row.replace(/\[[^\]]*\]/g, "").trim();
    for (const [, m, s] of stamps) lines.set(Math.round((Number(m) * 60 + Number(s)) * 1000), text);
  }
  return lines;
}

// yrc rows look like [lineStart,lineDuration](wordStart,wordDuration,0)word(...)word
function parseYrc(yrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const row of yrc.split("\n")) {
    const head = row.match(/^\[(\d+),(\d+)\]/);
    if (!head) continue;
    const words = [...row.matchAll(/\((\d+),(\d+),\d+\)([^(]*)/g)].map(([, ms, d, text]) => ({
      ms: Number(ms),
      durationMs: Number(d),
      text,
    }));
    const text = words.map((w) => w.text).join("").trim();
    if (text) lines.push({ ms: Number(head[1]), text, words });
  }
  return lines;
}

// Version -1 asks for every lyric kind the song has; 0 makes the server omit yrc.
export async function lyric(id: number): Promise<LyricLine[]> {
  const res = await eapi("/api/song/lyric/v1", { id, cp: false, tv: -1, lv: -1, rv: -1, kv: -1, yv: -1, ytv: -1, yrv: -1 });
  if (res.yrc?.lyric) {
    const trans = parseLrc(res.ytlrc?.lyric || res.tlyric?.lyric);
    const lines = parseYrc(res.yrc.lyric);
    if (lines.length) return lines.map((l) => ({ ...l, trans: trans.get(l.ms) || undefined }));
  }
  const trans = parseLrc(res.tlyric?.lyric);
  return [...parseLrc(res.lrc?.lyric)]
    .sort(([a], [b]) => a - b)
    .filter(([, text]) => text)
    .map(([ms, text]) => ({ ms, text, trans: trans.get(ms) || undefined }));
}

export async function like(id: number, liked: boolean): Promise<void> {
  await eapi("/api/radio/like", { trackId: id, like: liked, alg: "itembased", time: 3 });
}
