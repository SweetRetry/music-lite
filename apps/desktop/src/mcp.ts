// Tools for agents: search songs and tidy playlists. src-tauri/src/mcp.rs serves MCP on 127.0.0.1 and hands
// tools/list and tools/call here as "mcp" events. Every tool acts on the service on screen through the library,
// so what an agent changes shows at once, and the next launch starts from it.
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { srcOf, type Track } from "./api";
import { artistNames } from "./format";
import { editable, library, useLibrary } from "./library";
import { isProviderId, PROVIDER_IDS, useMode } from "./mode";
import { provider, providers } from "./providers";
import { router } from "./router";

type Tool = {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  run: (args: any) => Promise<unknown>;
};

// Songs an agent has been shown, by the key it was shown. QQ Music writes a song by more than its id, so a key
// alone cannot be turned back into a song. Lives for the session.
const seen = new Map<string, Track>();

const show = (t: Track) => {
  const key = `${srcOf(t)}:${t.id}`;
  seen.set(key, t);
  return { key, name: t.name, artists: artistNames(t), album: t.album.name, ...(t.unavailable && { unavailable: true }) };
};

const songs = (keys: string[]) =>
  keys.map((key) => {
    const t = seen.get(key);
    if (!t) throw new Error(`没见过 ${key}。先用 search 或 get_playlist 拿到这首歌`);
    if (srcOf(t) !== useMode.getState().mode) throw new Error(`${key} 不是${provider().name}的歌`);
    return t;
  });

const me = () => {
  const me = useLibrary.getState().me;
  if (!me) throw new Error(`${provider().name}还没登录`);
  return me;
};

// Only playlists the user made. 我喜欢的音乐 changes through like.
const writable = (id: number) => {
  if (!editable(me(), id)) throw new Error(`歌单 ${id} 不是你创建的歌单，不能改`);
  return id;
};

const str = { type: "string" };
const int = { type: "integer" };
const keys = { type: "array", items: str, description: "歌的 key，来自 search 或 get_playlist" };

const TOOLS: Tool[] = [
  {
    name: "status",
    description: "当前显示的音乐服务和账号。其余工具都作用在这个服务上，换服务用 switch_service。",
    inputSchema: { type: "object", properties: {} },
    run: async () => ({
      service: useMode.getState().mode,
      account: useLibrary.getState().me?.nickname ?? null,
      services: PROVIDER_IDS.map((id) => ({ id, name: providers[id].name })),
    }),
  },
  {
    name: "switch_service",
    description: "换到另一个音乐服务，app 会跟着切过去。",
    inputSchema: { type: "object", properties: { service: { type: "string", enum: [...PROVIDER_IDS] } }, required: ["service"] },
    run: async ({ service }) => {
      if (!isProviderId(service)) throw new Error(`没有 ${service} 这个服务`);
      if (service !== useMode.getState().mode) {
        router.navigate({ to: "/" });
        await library.enter(service);
      }
      return { service, account: useLibrary.getState().me?.nickname ?? null };
    },
  },
  {
    name: "list_playlists",
    description: "账号的歌单。mine 是自己创建的，liked 是我喜欢的音乐。",
    inputSchema: { type: "object", properties: {} },
    run: async () =>
      me().playlists.map(({ id, name, trackCount, mine, liked }) => ({ id, name, trackCount, mine, liked })),
  },
  {
    name: "get_playlist",
    description: "歌单里的歌，从服务器现取。长歌单用 offset 和 limit 分页。",
    inputSchema: {
      type: "object",
      properties: { id: int, offset: { ...int, default: 0 }, limit: { ...int, default: 500 } },
      required: ["id"],
    },
    run: async ({ id, offset = 0, limit = 500 }) => {
      const p = await library.reload(id);
      return { id: p.id, name: p.name, total: p.tracks.length, offset, tracks: p.tracks.slice(offset, offset + limit).map(show) };
    },
  },
  {
    name: "search",
    description: "搜歌。",
    inputSchema: { type: "object", properties: { keyword: str }, required: ["keyword"] },
    run: async ({ keyword }) => (await provider().search(keyword)).map(show),
  },
  {
    name: "create_playlist",
    description: "新建歌单，返回它的 id。",
    inputSchema: { type: "object", properties: { name: str }, required: ["name"] },
    run: async ({ name }) => ({ id: await library.createPlaylist(name, false) }),
  },
  {
    name: "rename_playlist",
    description: "给自己创建的歌单改名。",
    inputSchema: { type: "object", properties: { id: int, name: str }, required: ["id", "name"] },
    run: async ({ id, name }) => void (await library.renamePlaylist(writable(id), name)),
  },
  {
    name: "add_tracks",
    description: "把歌加进自己创建的歌单。",
    inputSchema: { type: "object", properties: { playlist: int, tracks: keys }, required: ["playlist", "tracks"] },
    run: async ({ playlist, tracks }) => void (await library.addTracks(writable(playlist), songs(tracks))),
  },
  {
    name: "remove_tracks",
    description: "把歌从自己创建的歌单里删掉。",
    inputSchema: { type: "object", properties: { playlist: int, tracks: keys }, required: ["playlist", "tracks"] },
    run: async ({ playlist, tracks }) => void (await library.removeTracks(writable(playlist), songs(tracks))),
  },
  {
    name: "like",
    description: "喜欢或取消喜欢这些歌，也就是加进或移出我喜欢的音乐。返回没改成的歌。",
    inputSchema: { type: "object", properties: { tracks: keys, on: { type: "boolean" } }, required: ["tracks", "on"] },
    run: async ({ tracks, on }) => {
      me();
      const todo = songs(tracks).filter((t) => useLibrary.getState().liked.has(t.id) !== on);
      // One at a time, as a person would click the hearts. toggleLike puts a heart back when the server refuses.
      for (const t of todo) await library.toggleLike(t);
      return { failed: todo.filter((t) => useLibrary.getState().liked.has(t.id) !== on).map(show) };
    },
  },
];

async function answer(method: string, params: any) {
  if (method === "tools/list") return { tools: TOOLS.map(({ run: _, ...tool }) => tool) };
  const tool = TOOLS.find((t) => t.name === params?.name);
  if (!tool) throw new Error(`没有 ${params?.name} 这个工具`);
  const result = await tool.run(params.arguments ?? {});
  return { content: [{ type: "text", text: result === undefined ? "完成" : JSON.stringify(result) }] };
}

if (isTauri()) {
  listen<{ id: number; method: string; params: any }>("mcp", ({ payload: { id, method, params } }) =>
    answer(method, params).then(
      (result) => invoke("mcp_reply", { id, result }),
      (e) => invoke("mcp_reply", { id, error: String((e as Error)?.message ?? e) }),
    ),
  );
}
