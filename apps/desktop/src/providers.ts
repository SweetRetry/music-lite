// A music service, as the library, the player and the views see it. Each one answers the same questions in
// terms of Track, Playlist and Me. What a service cannot do is declared in `can`, and the UI hides it.
import * as api from "./api";
import * as albums from "./api/album";
import * as artists from "./api/artist";
import * as pl from "./api/playlists";
import type { Quality } from "./api/quality";
import * as qq from "./api/qq";
import { type ProviderId, useMode } from "./mode";

export type Can = {
  // A page of daily recommendations.
  daily: boolean;
  // Artist and album pages, which tracks link to.
  browse: boolean;
  // Suggestions under the search box while typing.
  suggest: boolean;
  // A choice of sound quality, and the membership badge.
  quality: boolean;
  vip: boolean;
  // A private flag when creating a playlist.
  private: boolean;
};

export type Provider = {
  id: ProviderId;
  // The service's name in sentences, and a short one for the switch.
  name: string;
  short: string;
  can: Can;
  // null when signed out.
  me: () => Promise<api.Me | null>;
  daily: () => Promise<api.Track[]>;
  playlist: (id: number, uid: number) => Promise<api.Playlist>;
  playlists: (uid: number) => Promise<api.PlaylistSummary[]>;
  like: (track: api.Track, on: boolean) => Promise<void>;
  create: (uid: number, name: string, isPrivate: boolean) => Promise<number>;
  rename: (id: number, name: string) => Promise<void>;
  remove: (id: number) => Promise<void>;
  subscribe: (id: number, on: boolean) => Promise<void>;
  addTracks: (id: number, tracks: api.Track[]) => Promise<void>;
  removeTracks: (id: number, tracks: api.Track[]) => Promise<void>;
  search: (keyword: string) => Promise<api.Track[]>;
  songUrl: (track: api.Track, quality: Quality) => Promise<api.SongSource | null>;
  lyric: (track: api.Track) => Promise<api.LyricLine[]>;
  // Addressed by what pageId gives: the numeric id of NetEase, the mid of QQ Music.
  artist: (id: string) => Promise<artists.Artist>;
  album: (id: string) => Promise<albums.Album>;
  // The pages of an artist after the first one the artist call returns. Absent where the service has none.
  artistSongs?: (id: string, begin: number) => Promise<api.Track[]>;
  artistAlbums?: (id: string, begin: number) => Promise<albums.AlbumCard[]>;
};

const ncm: Provider = {
  id: "ncm",
  name: "网易云音乐",
  short: "网易云",
  can: { daily: true, browse: true, suggest: true, quality: true, vip: true, private: true },
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
  artist: artists.artist,
  album: albums.album,
};

const qqMusic: Provider = {
  id: "qq",
  name: "QQ 音乐",
  short: "QQ 音乐",
  can: { daily: true, browse: true, suggest: false, quality: false, vip: false, private: false },
  me: qq.me,
  daily: qq.daily,
  playlist: qq.playlist,
  playlists: qq.userPlaylists,
  like: qq.like,
  create: qq.create,
  rename: qq.rename,
  remove: qq.remove,
  // The playlists of other people are not part of the library here, so there is nothing to collect.
  subscribe: () => Promise.reject(new Error("QQ 音乐不支持收藏歌单")),
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
export const providerOf = (track: api.Track) => providers[track.src ?? "ncm"];

// Whether the library on screen is the song's own, and so can like it, rate it and open its pages.
export const isHere = (track: api.Track) => (track.src ?? "ncm") === useMode.getState().mode;

// Whether names of a song from `src` can open artist and album pages in the mode on screen.
export const useCanBrowse = (src: ProviderId = "ncm") => useMode((s) => src === s.mode && providers[s.mode].can.browse);

export const useIsHere = (track: api.Track | undefined) => useMode((s) => !track || (track.src ?? "ncm") === s.mode);
