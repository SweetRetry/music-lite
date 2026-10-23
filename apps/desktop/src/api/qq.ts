// QQ Music, normalized to the same Track, Playlist and Me as NetEase so the UI never sees the difference.
// The calls are the ones the QQ Music Mac client makes (module and method names come from its binary).
import { type LyricLine, type Me, type Playlist, type PlaylistSummary, type SongSource, type Track, https, parseLrc } from "../api";
import { qqapi, qqInvoke } from "../qqapi";
import type { Album, AlbumCard } from "./album";
import type { Artist } from "./artist";
import type { Privilege } from "./privilege";
import { qualityFor, rank, type Quality, type QualityOption } from "./quality";
import type { SuggestionGroup } from "./suggest";
import type { Vip } from "./vip";

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

// An unreadable login must retain its permission error instead of looking signed out.
const uin = () => qqInvoke<string | null>("qq_login");

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
    // Only the first page supplies the header. Song-only responses leave its fields empty.
    onlysonglist: begin === 0 ? 0 : 1,
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

export const QUALITIES = [
  { level: "standard", label: "标准" },
  { level: "exhigh", label: "高品质" },
  { level: "lossless", label: "无损" },
  { level: "hires", label: "Hi-Res" },
] as const satisfies readonly QualityOption[];

const FILES = [
  { prefix: "RS01", ext: "flac", level: "hires", size: "size_hires" },
  { prefix: "F000", ext: "flac", level: "lossless", size: "size_flac" },
  { prefix: "M800", ext: "mp3", level: "exhigh", size: "size_320mp3" },
  { prefix: "M500", ext: "mp3", level: "standard", size: "size_128mp3" },
  { prefix: "C400", ext: "m4a", level: "standard", size: "size_96aac" },
] as const;

type SongDetail = { track_info?: { interval: number; file?: { media_mid?: string } & Record<string, unknown> } };
type Vkeys = { sip?: string[]; midurlinfo?: { filename: string; purl: string }[] };

// A vkey can exist even for a nonexistent file. The song's file sizes must gate every candidate first.
async function sources(track: Track, quality: Quality) {
  if (!track.mid) return [];
  const [id, detail] = await Promise.all([
    uin(),
    qqapi<SongDetail>("music.pf_song_detail_svr", "get_song_detail_yqq", { song_mid: track.mid }),
  ]);
  if (!id) return [];
  const info = detail.track_info;
  const media = info?.file?.media_mid ?? track.mid;
  const files = FILES.filter((f) => rank(f.level) <= rank(quality) && Number(info?.file?.[f.size]) > 0)
    .map((f) => ({ ...f, filename: `${f.prefix}${media}${media}.${f.ext}` }));
  if (!files.length) return [];
  const { sip, midurlinfo } = await qqapi<Vkeys>("music.vkey.GetVkey", "UrlGetVkey", {
    guid: "10000",
    songmid: files.map(() => track.mid),
    songtype: files.map(() => 0),
    uin: id,
    loginflag: 1,
    platform: "20",
    filename: files.map((f) => f.filename),
  });
  return files.map((f) => {
    const purl = midurlinfo?.find((m) => m.filename === f.filename)?.purl;
    return {
      level: f.level,
      br: info?.interval ? Math.round(Number(info.file?.[f.size]) * 8 / info.interval) : 0,
      url: purl && sip?.[0] ? https(new URL(purl, sip[0]).href) : "",
    };
  });
}

// Try the chosen tier and then lower files that both exist and are playable by this account.
export async function songUrl(track: Track, quality: Quality): Promise<SongSource | null> {
  return (await sources(track, qualityFor(quality, QUALITIES))).find((s) => s.url) ?? null;
}

export async function privilege(track: Track): Promise<Privilege | null> {
  try {
    const files = await sources(track, "hires");
    const access = (q: Quality) => {
      const tier = files.filter((f) => f.level === q);
      return tier.some((f) => f.url) ? "ok" : tier.length ? "vip" : "none";
    };
    return { standard: access("standard"), higher: "none", exhigh: access("exhigh"), lossless: access("lossless"), hires: access("hires") };
  } catch {
    return null;
  }
}

// The official membership page maps HugeVip to 超级会员. These dates are always China time.
export async function vip(): Promise<Vip | null> {
  const { identity, svip } = await qqapi("VipLogin.VipLoginInter", "vip_login_base");
  const kinds = [
    { active: identity?.HugeVip === 1, name: "超级会员", end: identity?.HugeVipEnd },
    { active: identity?.vip === 1, name: svip === 1 ? "豪华绿钻" : "绿钻", end: identity?.overdate },
  ];
  for (const { active, name, end } of kinds) {
    if (!active || typeof end !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(end)) continue;
    const expireMs = Date.parse(`${end.replace(" ", "T")}+08:00`);
    if (expireMs > Date.now()) return { name, expireMs };
  }
  return null;
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

// Both native smartbox methods use search_id, unlike the full search's searchid.
export async function suggest(keyword: string): Promise<SuggestionGroup[]> {
  const param = { query: keyword, search_id: String(Date.now()), num_per_page: 4 };
  const [words, hits] = await Promise.all([
    qqapi("music.smartboxCgi.SmartBoxCgi", "GetSmartBoxResult", param),
    qqapi("music.smartboxCgi.SmartBoxCgi", "GetSmartBoxResultForPc", param),
  ]);
  if (hits.code !== 0 || hits.subcode !== 0) throw new Error("暂时无法获取搜索建议");
  const hints = new Set<string>((words.items ?? []).filter((s: any) => s.res_type === "search" && s.hint)
    .map((s: any) => s.hint));
  const groups: SuggestionGroup[] = [
    { value: "搜索建议", items: [...hints].slice(0, 6).map((keyword) => ({ kind: "keyword", keyword })) },
    { value: "歌手", items: (hits.data?.singer?.singer_list ?? []).slice(0, 2)
      .map((s: any) => ({ kind: "artist", id: s.mid, name: s.name, avatar: https(s.pic) })) },
    { value: "专辑", items: (hits.data?.album?.album_list ?? []).slice(0, 3)
      .map((a: any) => ({ kind: "album", id: a.mid, name: a.name, artist: a.singer ?? "" })) },
  ];
  return groups.filter((g) => g.items.length);
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
