// The signed-in account: profile, playlists and liked songs. Shared by every view.
import { create } from "zustand";
import * as api from "./api";

type Library = {
  me: api.Me | null;
  liked: Set<number>;
  error: string;
  load: () => Promise<void>;
  playlist: (id: number) => Promise<api.Playlist>;
  invalidate: (id: number) => void;
  likedPlaylist: () => api.PlaylistSummary | undefined;
  toggleLike: (id: number) => Promise<void>;
};

// Opened playlists, so moving around does not refetch. Mutations must invalidate.
const playlists = new Map<number, api.Playlist>();

export const useLibrary = create<Library>((set, get) => ({
  me: null,
  liked: new Set(),
  error: "",
  async load() {
    try {
      const me = await api.me();
      set({ me, liked: new Set(me.liked), error: "" });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
  async playlist(id) {
    const cached = playlists.get(id);
    if (cached) return cached;
    const p = await api.playlist(id);
    playlists.set(id, p);
    return p;
  },
  invalidate: (id) => void playlists.delete(id),
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
    const likedId = get().likedPlaylist()?.id;
    if (likedId) get().invalidate(likedId);
    await api.like(id, next).catch(() => apply(!next));
  },
}));

// Actions are stable, so non-React code and event handlers can call them without subscribing.
export const library = useLibrary.getState();
