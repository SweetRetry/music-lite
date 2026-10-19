// The signed-in account: profile, playlists and liked songs. Shared by every view.
import { create } from "zustand";
import * as api from "./api";
import { clear, drop, peek, put } from "./cache";
import * as pl from "./api/playlists";

type Library = {
  me: api.Me | null;
  liked: Set<number>;
  error: string;
  // Opened playlists, seeded from the persistent cache. Views read them from here, so a
  // mutation that patches an entry updates the page in place.
  opened: Record<number, api.Playlist>;
  load: () => Promise<void>;
  // Fetches and replaces opened[id]; the old copy stays until the new one lands.
  reload: (id: number) => Promise<api.Playlist>;
  likedPlaylist: () => api.PlaylistSummary | undefined;
  toggleLike: (id: number) => Promise<void>;
  createPlaylist: (name: string, isPrivate: boolean) => Promise<number>;
  renamePlaylist: (id: number, name: string) => Promise<void>;
  deletePlaylist: (id: number) => Promise<void>;
  subscribePlaylist: (id: number, on: boolean) => Promise<void>;
  addTracks: (pid: number, tracks: api.Track[]) => Promise<void>;
  removeTracks: (pid: number, ids: number[]) => Promise<void>;
};

// Playlists the user may edit: created by them, and not the liked one, which 喜欢 manages.
export const editable = (me: api.Me | null, id: number) =>
  !!me?.playlists.some((p) => p.id === id && p.mine && !p.liked);

// Track writes to one playlist go out one at a time, so a burst of edits lands in order.
const writes = new Map<number, Promise<unknown>>();
function serial<T>(pid: number, run: () => Promise<T>): Promise<T> {
  const next = (writes.get(pid) ?? Promise.resolve()).catch(() => {}).then(run);
  writes.set(pid, next);
  return next;
}

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
    const playlists = await pl.userPlaylists(me.uid).catch(() => null);
    if (playlists) set((s) => (s.me ? { me: { ...s.me, playlists } } : {}));
  };

  // Start from the persisted account so the sidebar and liked hearts paint on the first frame.
  const cachedMe = peek<api.Me>("me");
  const cachedOpened: Record<number, api.Playlist> = {};
  for (const p of cachedMe?.playlists ?? []) {
    const copy = peek<api.Playlist>(`playlist:${p.id}`);
    if (copy) cachedOpened[p.id] = copy;
  }

  return {
    me: cachedMe ?? null,
    liked: new Set(cachedMe?.liked),
    error: "",
    opened: cachedOpened,
    async load() {
      try {
        const me = await api.me();
        // Another account signed in since the last run: nothing cached for the old one may show.
        const prev = get().me;
        if (prev && prev.uid !== me.uid) {
          clear();
          set({ opened: {} });
        }
        set({ me, liked: new Set(me.liked), error: "" });
      } catch (e) {
        // With a cached account the app is usable offline, so only a cold failure is fatal.
        if (!get().me) set({ error: (e as Error).message });
        return;
      }
      // Warm the liked list so the first click on 我喜欢的音乐 is instant.
      const likedId = get().likedPlaylist()?.id;
      if (likedId && !get().opened[likedId]) get().reload(likedId).catch(() => {});
    },
    // Queued behind pending writes to the same playlist, so a fetch never returns a copy older than them.
    reload: (id) =>
      serial(id, async () => {
        const p = await api.playlist(id, get().me?.uid ?? 0);
        set((s) => ({ opened: { ...s.opened, [id]: p } }));
        return p;
      }),
    likedPlaylist: () => get().me?.playlists.find((p) => p.liked),
    async toggleLike(id) {
      const next = !get().liked.has(id);
      const apply = (on: boolean) =>
        set((s) => {
          const liked = new Set(s.liked);
          on ? liked.add(id) : liked.delete(id);
          return { liked };
        });
      apply(next);
      const ok = await api.like(id, next).then(
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
      const id = await pl.create(me.uid, name, isPrivate);
      await refreshPlaylists();
      return id;
    },
    async renamePlaylist(id, name) {
      await pl.rename(id, name);
      set((s) => ({
        me: s.me && { ...s.me, playlists: s.me.playlists.map((p) => (p.id === id ? { ...p, name } : p)) },
      }));
      patchOpened(id, (p) => ({ ...p, name }));
    },
    async deletePlaylist(id) {
      await pl.remove(id);
      set((s) => ({ me: s.me && { ...s.me, playlists: s.me.playlists.filter((p) => p.id !== id) } }));
      set((s) => {
        const { [id]: _, ...opened } = s.opened;
        return { opened };
      });
      drop(`playlist:${id}`);
    },
    async subscribePlaylist(id, on) {
      await pl.subscribe(id, on);
      await refreshPlaylists();
    },
    // The server decides where new songs go, so an open copy is refetched rather than guessed at.
    async addTracks(pid, tracks) {
      await serial(pid, () =>
        pl.addTracks(
          pid,
          tracks.map((t) => t.id),
        ),
      );
      if (get().opened[pid]) get().reload(pid).catch(() => {});
      refreshPlaylists();
    },
    // Optimistic: the rows go now and come back where they were if the server refuses.
    async removeTracks(pid, ids) {
      const gone = new Set(ids);
      const removed: [number, api.Track][] = [];
      setTracks(pid, (tracks) =>
        tracks.filter((t, i) => {
          if (!gone.has(t.id)) return true;
          removed.push([i, t]);
          return false;
        }),
      );
      try {
        await serial(pid, () => pl.removeTracks(pid, ids));
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
  if (s.me && (s.me !== prev.me || s.liked !== prev.liked)) put("me", { ...s.me, liked: [...s.liked] });
  if (s.opened !== prev.opened) {
    for (const [id, p] of Object.entries(s.opened)) if (p !== prev.opened[+id]) put(`playlist:${id}`, p);
  }
});

// Actions are stable, so non-React code and event handlers can call them without subscribing.
export const library = useLibrary.getState();
