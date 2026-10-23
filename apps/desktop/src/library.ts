// The signed-in account: profile, playlists and liked songs. Shared by every view.
import { create } from "zustand";
import type * as api from "./api";
import { invoke } from "@tauri-apps/api/core";
import { clear, drop, peek, put } from "./cache";
import { inMode, type ProviderId, scoped, useMode } from "./mode";
import { player, playlistOrigin, usePlayer } from "./player";
import { isHere, provider } from "./providers";

type Library = {
  me: api.Me | null;
  liked: Set<number>;
  error: string;
  // No account on either service: the app shows the NetEase sign-in.
  signedOut: boolean;
  // Opened playlists, seeded from the persistent cache. Views read them from here, so a
  // mutation that patches an entry updates the page in place.
  opened: Record<number, api.Playlist>;
  load: () => Promise<void>;
  // Shows another service: its cached account first, then whatever the server says.
  enter: (mode: ProviderId) => Promise<void>;
  // Fetches and replaces opened[id]; the old copy stays until the new one lands.
  reload: (id: number) => Promise<api.Playlist>;
  likedPlaylist: () => api.PlaylistSummary | undefined;
  toggleLike: (track: api.Track) => Promise<void>;
  createPlaylist: (name: string, isPrivate: boolean) => Promise<number>;
  renamePlaylist: (id: number, name: string) => Promise<void>;
  deletePlaylist: (id: number) => Promise<void>;
  subscribePlaylist: (id: number, on: boolean) => Promise<void>;
  addTracks: (pid: number, tracks: api.Track[]) => Promise<void>;
  removeTracks: (pid: number, tracks: api.Track[]) => Promise<void>;
};

// Playlists the user may edit: created by them, and not the liked one, which 喜欢 manages.
export const editable = (me: api.Me | null, id: number) =>
  !!me?.playlists.some((p) => p.id === id && p.mine && !p.liked);

export const takenDown = (tracks: api.Track[]) => tracks.filter((t) => t.unavailable);

// Track writes to one playlist go out one at a time, so a burst of edits lands in order.
const writes = new Map<number, Promise<unknown>>();
function serial<T>(pid: number, run: () => Promise<T>): Promise<T> {
  const next = (writes.get(pid) ?? Promise.resolve()).catch(() => {}).then(run);
  writes.set(pid, next);
  return next;
}

// The library on screen belongs to one service. An answer that comes back after the mode changed is for the
// other one, and must not land here.
const stale = (mode: ProviderId) => useMode.getState().mode !== mode;

export const useLibrary = create<Library>((set, get) => {
  const patchOpened = (id: number, patch: (p: api.Playlist) => api.Playlist) =>
    set((s) => (s.opened[id] ? { opened: { ...s.opened, [id]: patch(s.opened[id]) } } : {}));

  const setTracks = (id: number, tracks: (t: api.Track[]) => api.Track[]) =>
    patchOpened(id, (p) => {
      const next = tracks(p.tracks);
      return { ...p, tracks: next, trackCount: next.length };
    });

  // Counts and covers in the sidebar come from the server. Failures here are not worth a screen.
  const refreshPlaylists = async () => {
    const me = get().me;
    if (!me) return;
    const mode = useMode.getState().mode;
    const playlists = await provider().playlists(me.uid).catch(() => null);
    if (playlists && !stale(mode)) set((s) => (s.me ? { me: { ...s.me, playlists } } : {}));
  };

  // Nothing of the last account stays: not its cache, and not its queue. The other service's stay.
  const signOut = () => {
    const mode = useMode.getState().mode;
    clear(inMode(mode));
    const playing = usePlayer.getState().queue[usePlayer.getState().index];
    if (!playing || (playing.src ?? "ncm") === mode) player.clear();
    set({ me: null, liked: new Set(), opened: {}, error: "", signedOut: true });
  };

  // The persisted account of a service, so the sidebar and liked hearts paint on the first frame.
  const seed = (mode: ProviderId) => {
    const me = peek<api.Me>(scoped("me", mode));
    const opened: Record<number, api.Playlist> = {};
    for (const p of me?.playlists ?? []) {
      const copy = peek<api.Playlist>(scoped(`playlist:${p.id}`, mode));
      if (copy) opened[p.id] = copy;
    }
    return { me: me ?? null, liked: new Set(me?.liked), opened };
  };
  const first = seed(useMode.getState().mode);

  // A queue saved before the player remembered where it came from belongs to the playlist holding the same
  // songs in the same order. Checked against the cached copies now and each playlist as it loads.
  // The player saves the origin from here on.
  const adoptOrigin = (p: api.Playlist) => {
    const queued = usePlayer.getState();
    if (queued.origin || !queued.queue.length) return;
    const same = p.tracks.filter((t) => !t.unavailable).map((t) => t.id).join() === queued.queue.map((t) => t.id).join();
    if (same) usePlayer.setState({ origin: playlistOrigin(p.id) });
  };
  Object.values(first.opened).forEach(adoptOrigin);

  return {
    ...first,
    error: "",
    signedOut: false,
    async load() {
      const mode = useMode.getState().mode;
      try {
        const me = await provider().me();
        if (stale(mode)) return;
        if (!me) {
          signOut();
          // The account on screen is gone, so the other service's takes the screen. With neither, NetEase's
          // sign-in shows.
          const next = mode === "qq" ? "ncm" : (await invoke<string | null>("qq_login").catch(() => null)) ? "qq" : null;
          if (next && !stale(mode)) await get().enter(next);
          return;
        }
        // Another account signed in since the last run: nothing cached for the old one may show.
        const prev = get().me;
        if (prev && prev.uid !== me.uid) {
          clear(inMode(mode));
          set({ opened: {} });
        }
        set({ me, liked: new Set(me.liked), error: "", signedOut: false });
      } catch (e) {
        // With a cached account the app is usable offline, so only a cold failure is fatal.
        if (!get().me) set({ error: (e as Error).message });
        return;
      }
      // Warm the liked list so the first click on 我喜欢的音乐 is instant.
      const likedId = get().likedPlaylist()?.id;
      if (likedId && !get().opened[likedId]) get().reload(likedId).catch(() => {});
    },
    async enter(mode) {
      useMode.setState({ mode });
      set({ ...seed(mode), error: "", signedOut: false });
      await get().load();
    },
    // Queued behind pending writes to the same playlist, so a fetch never returns a copy older than them.
    reload: (id) =>
      serial(id, async () => {
        const mode = useMode.getState().mode;
        const p = await provider().playlist(id, get().me?.uid ?? 0);
        if (stale(mode)) return p;
        set((s) => ({ opened: { ...s.opened, [id]: p } }));
        adoptOrigin(p);
        return p;
      }),
    likedPlaylist: () => get().me?.playlists.find((p) => p.liked),
    async toggleLike(track) {
      // A song playing on from the other service has no heart in this library.
      if (!isHere(track)) return;
      const id = track.id;
      const next = !get().liked.has(id);
      const apply = (on: boolean) =>
        set((s) => {
          const liked = new Set(s.liked);
          on ? liked.add(id) : liked.delete(id);
          return { liked };
        });
      apply(next);
      const ok = await provider().like(track, next).then(
        () => true,
        () => false,
      );
      if (!ok) return apply(!next);
      // Refetch only after the server has the change, or an open liked list reloads the old one.
      const likedId = get().likedPlaylist()?.id;
      if (likedId && get().opened[likedId]) get().reload(likedId).catch(() => {});
    },

    async createPlaylist(name, isPrivate) {
      const me = get().me;
      if (!me) throw new Error("还没登录");
      const id = await provider().create(me.uid, name, isPrivate);
      await refreshPlaylists();
      return id;
    },
    async renamePlaylist(id, name) {
      await provider().rename(id, name);
      set((s) => ({
        me: s.me && { ...s.me, playlists: s.me.playlists.map((p) => (p.id === id ? { ...p, name } : p)) },
      }));
      patchOpened(id, (p) => ({ ...p, name }));
    },
    async deletePlaylist(id) {
      await provider().remove(id);
      set((s) => ({ me: s.me && { ...s.me, playlists: s.me.playlists.filter((p) => p.id !== id) } }));
      set((s) => {
        const { [id]: _, ...opened } = s.opened;
        return { opened };
      });
      drop(scoped(`playlist:${id}`));
    },
    async subscribePlaylist(id, on) {
      await provider().subscribe(id, on);
      await refreshPlaylists();
    },
    // The server decides where new songs go, so an open copy is refetched rather than guessed at.
    async addTracks(pid, tracks) {
      await serial(pid, () => provider().addTracks(pid, tracks));
      if (get().opened[pid]) get().reload(pid).catch(() => {});
      refreshPlaylists();
    },
    // Optimistic: the rows go now and come back where they were if the server refuses.
    async removeTracks(pid, doomed) {
      const gone = new Set(doomed.map((t) => t.id));
      const removed: [number, api.Track][] = [];
      setTracks(pid, (tracks) =>
        tracks.filter((t, i) => {
          if (!gone.has(t.id)) return true;
          removed.push([i, t]);
          return false;
        }),
      );
      try {
        await serial(pid, () => provider().removeTracks(pid, doomed));
      } catch (e) {
        setTracks(pid, (tracks) => {
          const next = [...tracks];
          for (const [i, t] of removed) next.splice(i, 0, t);
          return next;
        });
        throw e;
      }
      refreshPlaylists();
    },
  };
});

// Write-through: whatever the store holds is what the next launch starts from.
useLibrary.subscribe((s, prev) => {
  if (s.me && (s.me !== prev.me || s.liked !== prev.liked)) put(scoped("me"), { ...s.me, liked: [...s.liked] });
  if (s.opened !== prev.opened) {
    for (const [id, p] of Object.entries(s.opened)) if (p !== prev.opened[+id]) put(scoped(`playlist:${id}`), p);
  }
});

// Actions are stable, so non-React code and event handlers can call them without subscribing.
export const library = useLibrary.getState();
