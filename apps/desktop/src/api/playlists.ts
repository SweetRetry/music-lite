// Playlist CRUD. Endpoints and param shapes follow the official client's hybrid bundle.
// Every call here changes the signed-in account.
import { type PlaylistSummary, toSummary } from "../api";
import { eapi } from "../eapi";

// The official client sends privacy 10 for a private playlist and 0 for a public one.
export async function create(uid: number, name: string, isPrivate: boolean): Promise<number> {
  const res = await eapi("/api/playlist/create", { uid, name, privacy: isPrivate ? 10 : 0 });
  return res.id ?? res.playlist?.id;
}

export async function rename(id: number, name: string): Promise<void> {
  await eapi("/api/playlist/update/name", { id, name });
}

// Deleting takes `pid`, not `id`.
export async function remove(id: number): Promise<void> {
  await eapi("/api/playlist/delete", { pid: id });
}

// Collecting someone else's playlist. The official client "deletes" a collected playlist this way too.
export async function subscribe(id: number, on: boolean): Promise<void> {
  await eapi(on ? "/api/playlist/subscribe" : "/api/playlist/unsubscribe", { id });
}

// op "add" and "del" take the songs to change.
async function manipulate(pid: number, op: "add" | "del", ids: number[]): Promise<void> {
  await eapi("/api/v1/playlist/manipulate/tracks", { pid, op, trackIds: JSON.stringify(ids) });
}

export const addTracks = (pid: number, ids: number[]) => manipulate(pid, "add", ids);
export const removeTracks = (pid: number, ids: number[]) => manipulate(pid, "del", ids);

// Just the playlist list, to refresh sidebar counts and covers after a change.
export async function userPlaylists(uid: number): Promise<PlaylistSummary[]> {
  const { playlist } = await eapi("/api/user/playlist", { uid, limit: 1000, offset: 0, includeVideo: true });
  return playlist.map((p: any) => toSummary(p, uid));
}

// The native layer reports failures as "<path> returned <code>: <message>". Keep the message.
export const reason = (e: unknown) => String((e as Error)?.message ?? e).replace(/^.* returned -?\d+: ?/, "");
