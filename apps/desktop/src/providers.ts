// A music service, as the library, the player and the views see it. Each one answers the same questions in
// terms of Track, Playlist and Me. What a service cannot do it leaves out, and the UI hides it.
import * as api from "./api";
import * as albums from "./api/album";
import * as artists from "./api/artist";
import * as pl from "./api/playlists";
import { type Privilege, privilege } from "./api/privilege";
import type { Quality } from "./api/quality";
import * as qq from "./api/qq";
import { type SuggestionGroup, suggest } from "./api/suggest";
import { type Vip, vip } from "./api/vip";
import { type ProviderId, useMode } from "./mode";

export type Provider = {
  id: ProviderId;
  // The service's name in sentences, and a short one for the switch.
  name: string;
  short: string;
  // A service that borrows the login of its own client, which this app cannot sign in to. What to tell the user
  // while that client is signed out.
  borrowedLogin?: { signedIn: () => Promise<boolean>; hint: string };
  // The hour the daily recommendations change, where the service makes it known.
  dailyHour?: number;
  // A private flag when creating a playlist.
  privatePlaylists: boolean;
  // null when signed out.
  me: () => Promise<api.Me | null>;
  daily: () => Promise<api.Track[]>;
  playlist: (id: number, uid: number) => Promise<api.Playlist>;
  playlists: (uid: number) => Promise<api.PlaylistSummary[]>;
  like: (track: api.Track, on: boolean) => Promise<void>;
  create: (uid: number, name: string, isPrivate: boolean) => Promise<number>;
  rename: (id: number, name: string) => Promise<void>;
  remove: (id: number) => Promise<void>;
  // Collecting the playlist of someone else.
  subscribe?: (id: number, on: boolean) => Promise<void>;
  addTracks: (id: number, tracks: api.Track[]) => Promise<void>;
  removeTracks: (id: number, tracks: api.Track[]) => Promise<void>;
  search: (keyword: string) => Promise<api.Track[]>;
  // Suggestions under the search box while typing.
  suggest?: (keyword: string) => Promise<SuggestionGroup[]>;
  songUrl: (track: api.Track, quality: Quality) => Promise<api.SongSource | null>;
  lyric: (track: api.Track) => Promise<api.LyricLine[]>;
  // Addressed by what pageId gives: the numeric id of NetEase, the mid of QQ Music.
  artist: (id: string) => Promise<artists.Artist>;
  album: (id: string) => Promise<albums.Album>;
  // The membership badge.
  vip?: () => Promise<Vip | null>;
  // Which sound qualities a song offers this account. A service without it has no choice of quality.
  privilege?: (track: api.Track) => Promise<Privilege | null>;
  // The pages of an artist after the first one the artist call returns. Absent where the service has none.
  artistSongs?: (id: string, begin: number) => Promise<api.Track[]>;
  artistAlbums?: (id: string, begin: number) => Promise<albums.AlbumCard[]>;
};

const ncm: Provider = {
  id: "ncm",
  name: "网易云音乐",
  short: "网易云",
  dailyHour: 6,
  privatePlaylists: true,
  me: api.me,
  daily: api.daily,
  playlist: api.playlist,
  playlists: pl.userPlaylists,
  like: (track, on) => api.like(track.id, on),
  create: pl.create,
  rename: pl.rename,
  remove: pl.remove,
  subscribe: pl.subscribe,
  addTracks: (id, tracks) => pl.addTracks(id, tracks.map((t) => t.id)),
  removeTracks: (id, tracks) => pl.removeTracks(id, tracks.map((t) => t.id)),
  search: api.search,
  songUrl: (track, quality) => api.songUrl(track.id, quality),
  lyric: (track) => api.lyric(track.id),
  suggest,
  artist: artists.artist,
  album: albums.album,
  vip,
  privilege: (track) => privilege(track.id),
};

const qqMusic: Provider = {
  id: "qq",
  name: "QQ 音乐",
  short: "QQ 音乐",
  borrowedLogin: { signedIn: qq.signedIn, hint: "请先登录 QQ 音乐客户端" },
  privatePlaylists: false,
  me: qq.me,
  daily: qq.daily,
  playlist: qq.playlist,
  playlists: qq.userPlaylists,
  like: qq.like,
  create: qq.create,
  rename: qq.rename,
  remove: qq.remove,
  addTracks: qq.addTracks,
  removeTracks: qq.removeTracks,
  search: qq.search,
  songUrl: (track) => qq.songUrl(track),
  lyric: qq.lyric,
  artist: qq.artist,
  album: qq.album,
  artistSongs: qq.artistSongs,
  artistAlbums: qq.artistAlbums,
};

export const providers: Record<ProviderId, Provider> = { ncm, qq: qqMusic };

// The provider of the mode on screen.
export const provider = () => providers[useMode.getState().mode];
export const useProvider = () => providers[useMode((s) => s.mode)];

// A song belongs to the service it came from, which can differ from the mode on screen while it plays on.
export const providerOf = (track: api.Track) => providers[api.srcOf(track)];

// Whether the library on screen is the song's own, and so can like it, rate it and open its pages.
export const isHere = (track: api.Track) => api.srcOf(track) === useMode.getState().mode;

// Whether names of a song from `src` can open artist and album pages in the mode on screen.
export const useCanBrowse = (src: ProviderId = "ncm") => useMode((s) => src === s.mode);

export const useIsHere = (track: api.Track | undefined) => useMode((s) => !track || api.srcOf(track) === s.mode);
