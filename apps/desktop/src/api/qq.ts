// QQ Music, normalized to the same Track, Playlist and Me as NetEase so the UI never sees the difference.
// The calls are the ones the QQ Music Mac client makes (module and method names come from its binary).
import { invoke } from "@tauri-apps/api/core";
import { type LyricLine, type Me, type Playlist, type PlaylistSummary, type SongSource, type Track, https, parseLrc } from "../api";
import { qqapi } from "../qqapi";
import type { Album, AlbumCard } from "./album";
import type { Artist } from "./artist";

// dirId 201 is the 我喜欢 folder of every account.
const LIKED_DIR = 201;

const albumCover = (mid?: string) => (mid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${mid}.jpg` : "");

export const toTrack = (s: any): Track => ({
  id: s.id,
  mid: s.mid,
  src: "qq",
  name: s.name || s.title,
  artists: (s.singer ?? []).map((a: any) => ({ id: a.id, mid: a.mid, name: a.name })),
  album: { id: s.album?.id ?? 0, mid: s.album?.mid, name: s.album?.name ?? "" },
  cover: albumCover(s.album?.mid),
  durationMs: (s.interval ?? 0) * 1000,
  // pay_play 1 is a song that needs a paid plan to play in full.
  vip: s.pay?.pay_play === 1,
});

// A signed-out client and an unreadable one both mean there is no login to use. The login screen says which.
const uin = () => invoke<string | null>("qq_login").catch(() => null);

export const signedIn = async () => !!(await uin());

type Folder = { dirId: number; tid: number; dirName: string; songNum: number; picUrl: string; invalid?: boolean };

const folders = async (uin: string): Promise<Folder[]> => {
  const { v_playlist } = await qqapi("music.musicasset.PlaylistBaseRead", "GetPlaylistByUin", { uin });
  return (v_playlist as Folder[]).filter((f) => !f.invalid);
};

const toSummary = (f: Folder): PlaylistSummary => ({
  id: f.tid,
  name: f.dirId === LIKED_DIR ? "我喜欢的音乐" : f.dirName,
  cover: https(f.picUrl),
  trackCount: f.songNum,
  mine: true,
  liked: f.dirId === LIKED_DIR,
});

// A folder is written by dirId, and read by tid. Everything above this file only knows the tid.
async function folderOf(match: (f: Folder) => boolean): Promise<Folder> {
  const id = await uin();
  const folder = id && (await folders(id)).find(match);
  if (!folder) throw new Error("没找到这个歌单");
  return folder;
}

const PAGE = 1000;

async function diss(tid: number, begin: number) {
  return qqapi("music.srfDissInfo.DissInfo", "CgiGetDiss", {
    disstid: tid,
    onlysonglist: 1,
    song_begin: begin,
    song_num: PAGE,
    userinfo: 1,
    orderlist: 1,
  });
}

async function songs(tid: number) {
  const first = await diss(tid, 0);
  const all = [...(first.songlist ?? [])];
  for (let begin = PAGE; begin < first.total_song_num; begin += PAGE) all.push(...((await diss(tid, begin)).songlist ?? []));
  return { info: first.dirinfo, tracks: all.map(toTrack) };
}

// null when the QQ Music client is not signed in.
export async function me(): Promise<Me | null> {
  const id = await uin();
  if (!id) return null;
  const [user, list] = await Promise.all([
    qqapi("userInfo.BaseUserInfoServer", "get_user_baseinfo_v2", { vec_uin: [id] }),
    folders(id),
  ]);
  const profile = user.map_userinfo?.[id];
  const playlists = list.map(toSummary);
  const liked = playlists.find((p) => p.liked);
  return {
    uid: Number(id),
    nickname: profile?.nick ?? id,
    avatar: https(profile?.headurl),
    playlists,
    liked: liked ? (await songs(liked.id)).tracks.map((t) => t.id) : [],
  };
}

export async function userPlaylists(): Promise<PlaylistSummary[]> {
  const id = await uin();
  return id ? (await folders(id)).map(toSummary) : [];
}

export async function playlist(tid: number): Promise<Playlist> {
  const { info, tracks } = await songs(tid);
  return {
    id: tid,
    name: info.dirid === LIKED_DIR ? "我喜欢的音乐" : info.title,
    cover: https(info.picurl) || tracks[0]?.cover || "",
    trackCount: tracks.length,
    mine: true,
    liked: info.dirid === LIKED_DIR,
    creator: info.creator?.nick ?? "",
    tracks,
  };
}

// The recommendation feed owns today's playlist ID. A normal playlist lookup cannot discover it.
export async function daily(): Promise<Track[]> {
  type Shelf = { id: number; v_niche?: { v_card?: { id: string; title: string }[] }[] };
  const feed = await qqapi<{ v_shelf?: Shelf[] }>("music.recommend.RecommendFeed", "get_recommend_feed", {
    direction: 0, page: 1, v_cache: [], v_uniq: [], s_num: 0,
  });
  const card = feed.v_shelf?.find((shelf) => shelf.id === 301)?.v_niche?.[0]?.v_card?.find((card) => card.title === "每日30首");
  if (!card) throw new Error("暂时没有每日推荐，稍后再试");
  const tid = Number(card.id);
  if (!Number.isSafeInteger(tid) || tid <= 0) throw new Error("每日推荐歌单无效");
  const detail = await qqapi("music.srfDissInfo.aiDissInfo", "uniform_get_Dissinfo", {
    disstid: tid, userinfo: 1, tag: 1, guid: "",
  });
  return (detail.songlist ?? []).map(toTrack);
}

// The item the client sends for a song. The server rejects a like that carries less than this.
const songInfo = (t: Track) => ({
  songType: 0,
  songId: t.id,
  songMid: t.mid,
  songName: t.name,
  singerName: t.artists[0]?.name ?? "",
  desc: t.album.name,
});

const write = (method: "AddSonglist" | "DelSonglist", folder: Folder, tracks: Track[]) =>
  qqapi("music.musicasset.PlaylistDetailWrite", method, {
    dirId: folder.dirId,
    tid: folder.tid,
    v_songInfo: tracks.map(songInfo),
  });

export const addTracks = async (tid: number, tracks: Track[]) =>
  void (await write("AddSonglist", await folderOf((f) => f.tid === tid), tracks));

export const removeTracks = async (tid: number, tracks: Track[]) =>
  void (await write("DelSonglist", await folderOf((f) => f.tid === tid), tracks));

export async function like(track: Track, on: boolean): Promise<void> {
  await write(on ? "AddSonglist" : "DelSonglist", await folderOf((f) => f.dirId === LIKED_DIR), [track]);
}

// QQ Music has no private playlists to ask for, so the flag is dropped.
export async function create(_uid: number, name: string): Promise<number> {
  const { result } = await qqapi("music.musicasset.PlaylistBaseWrite", "AddPlaylist", { dirName: name });
  return (await folderOf((f) => f.dirId === result.dirId)).tid;
}

// mask 1 changes the name and nothing else.
export const rename = async (tid: number, name: string) =>
  void (await qqapi("music.musicasset.PlaylistBaseWrite", "EditPlaylist", {
    dirId: (await folderOf((f) => f.tid === tid)).dirId,
    dirNewName: name,
    mask: 1,
  }));

export const remove = async (tid: number) =>
  void (await qqapi("music.musicasset.PlaylistBaseWrite", "DelPlaylist", {
    dirId: (await folderOf((f) => f.tid === tid)).dirId,
  }));

// Files in the order they are tried: 320k mp3, 128k mp3, 128k aac. The server leaves the address empty for
// the ones this account cannot play, and the first with an address wins.
const FILES = [
  { prefix: "M800", ext: "mp3", level: "exhigh", br: 320000 },
  { prefix: "M500", ext: "mp3", level: "standard", br: 128000 },
  { prefix: "C400", ext: "m4a", level: "standard", br: 128000 },
] as const;

// Returns null when no file has an address: a song the account cannot play, or one taken down.
export async function songUrl(track: Track): Promise<SongSource | null> {
  const mid = track.mid;
  const id = await uin();
  if (!mid || !id) return null;
  const { sip, midurlinfo } = await qqapi("music.vkey.GetVkey", "UrlGetVkey", {
    guid: "10000",
    songmid: FILES.map(() => mid),
    songtype: FILES.map(() => 0),
    uin: id,
    loginflag: 1,
    platform: "20",
    filename: FILES.map((f) => `${f.prefix}${mid}${mid}.${f.ext}`),
  });
  const at = (midurlinfo as { purl: string }[]).findIndex((m) => m.purl);
  if (at < 0) return null;
  const { level, br } = FILES[at];
  return { url: https(sip[0] + midurlinfo[at].purl), level, br };
}

const decode = (b64?: string) => (b64 ? new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))) : "");

export async function lyric(track: Track): Promise<LyricLine[]> {
  if (!track.mid) return [];
  const res = await qqapi("music.musichallSong.PlayLyricInfo", "GetPlayLyricInfo", { songMID: track.mid });
  const trans = parseLrc(decode(res.trans));
  return [...parseLrc(decode(res.lyric))]
    .sort(([a], [b]) => a - b)
    .filter(([, text]) => text)
    .map(([ms, text]) => ({ ms, text, trans: trans.get(ms) || undefined }));
}

// Searches are only answered for the web player's identity.
export async function search(keyword: string): Promise<Track[]> {
  const res = await qqapi(
    "music.search.SearchCgiService",
    "DoSearchForQQMusicDesktop",
    { searchid: String(Math.floor(Math.random() * 9e17) + 1e17), query: keyword, search_type: 0, num_per_page: 50, page_num: 1 },
    "web",
  );
  return (res.body?.song?.list ?? []).map(toTrack);
}

// The artist and album pages are the web player's, which answers to the web identity.
const SONG_PAGE = 50;
const ALBUM_PAGE = 30;
const ALBUM_SONGS = 1000;

const albumCard = (a: any): AlbumCard => ({
  id: a.albumMid,
  name: a.albumName,
  cover: albumCover(a.albumMid),
  year: String(a.publishDate ?? "").slice(0, 4),
});

// Most played first.
const singerSongs = (mid: string, begin: number) =>
  qqapi("music.musichallSong.SongListInter", "GetSingerSongList", { singerMid: mid, begin, num: SONG_PAGE, order: 1 }, "web");
const singerAlbums = (mid: string, begin: number) =>
  qqapi("music.musichallAlbum.AlbumListServer", "GetAlbumList", { singerMid: mid, order: 1, num: ALBUM_PAGE, begin }, "web");

export const artistSongs = async (mid: string, begin: number): Promise<Track[]> =>
  ((await singerSongs(mid, begin)).songList ?? []).map((s: any) => toTrack(s.songInfo));
export const artistAlbums = async (mid: string, begin: number): Promise<AlbumCard[]> =>
  ((await singerAlbums(mid, begin)).albumList ?? []).map(albumCard);

export async function artist(mid: string): Promise<Artist> {
  const [detail, hot, albums] = await Promise.all([
    qqapi(
      "music.musichallSinger.SingerInfoInter",
      "GetSingerDetail",
      { singer_mids: [mid], pic: 1, group_singer: 1, wiki_singer: 1, ex_singer: 1 },
      "web",
    ),
    singerSongs(mid, 0),
    singerAlbums(mid, 0),
  ]);
  const singer = detail.singer_list?.[0];
  if (!singer) throw new Error("没找到这个歌手");
  const hotSongs: Track[] = (hot.songList ?? []).map((s: any) => toTrack(s.songInfo));
  return {
    id: mid,
    name: singer.basic_info.name,
    alias: singer.ex_info?.foreign_name ?? "",
    intro: (singer.ex_info?.desc ?? "").trim(),
    avatar: https(singer.pic?.pic),
    songCount: hot.totalNum ?? hotSongs.length,
    albumCount: albums.total ?? 0,
    hotSongs,
    albums: (albums.albumList ?? []).map(albumCard),
  };
}

const albumSongs = (mid: string, begin: number) =>
  qqapi("music.musichallAlbum.AlbumSongList", "GetAlbumSongList", { albumMid: mid, begin, num: ALBUM_SONGS, order: 2 }, "web");

export async function album(mid: string): Promise<Album> {
  const [detail, first] = await Promise.all([
    qqapi("music.musichallAlbum.AlbumInfoServer", "GetAlbumDetail", { albumMid: mid }, "web"),
    albumSongs(mid, 0),
  ]);
  const info = detail.basicInfo;
  if (!info) throw new Error("没找到这张专辑");
  const list = [...(first.songList ?? [])];
  // An empty page ends it, so a total that overstates never loops.
  for (let page = first; list.length < first.totalNum && page.songList?.length; ) {
    page = await albumSongs(mid, list.length);
    list.push(...(page.songList ?? []));
  }
  const tracks: Track[] = list.map((s: any) => toTrack(s.songInfo));
  return {
    id: mid,
    name: info.albumName,
    cover: albumCover(mid),
    artists: (detail.singer?.singerList ?? []).map((s: any) => ({ id: s.singerID, mid: s.mid, name: s.name })),
    publishTime: Date.parse(info.publishDate) || 0,
    trackCount: first.totalNum ?? tracks.length,
    description: (info.desc ?? "").trim(),
    tracks,
  };
}
