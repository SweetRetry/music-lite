import index from "../web/index.html";
import * as api from "./api";
import { ApiError } from "./eapi";

const json = (fn: (req: Bun.BunRequest<any>) => Promise<unknown>) => async (req: Bun.BunRequest<any>) => {
  try {
    return Response.json(await fn(req));
  } catch (e) {
    const status = e instanceof ApiError ? 502 : 500;
    console.error(e);
    return Response.json({ error: (e as Error).message }, { status });
  }
};

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.PORT ?? 4163),
  development: process.env.NODE_ENV !== "production",
  routes: {
    "/": index,
    "/lite/me": json(() => api.me()),
    "/lite/playlist/:id": json((req) => api.playlist(Number(req.params.id))),
    "/lite/search": json((req) => api.search(new URL(req.url).searchParams.get("q") ?? "")),
    "/lite/daily": json(() => api.daily()),
    "/lite/lyric/:id": json((req) => api.lyric(Number(req.params.id))),
    "/lite/url/:id": json(async (req) => ({ url: await api.songUrl(Number(req.params.id)) })),
    "/lite/like/:id": {
      POST: json(async (req) => {
        const { liked } = (await req.json()) as { liked: boolean };
        await api.like(Number(req.params.id), liked);
        return { liked };
      }),
    },
  },
});

console.log(`NCM Lite on ${server.url}`);
