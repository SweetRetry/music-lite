// Run with node --test scripts/test-qq-daily.mjs. Loads the app's actual TypeScript through Vite.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const require = createRequire(new URL("../apps/desktop/package.json", import.meta.url));
const { createServer } = await import(pathToFileURL(require.resolve("vite")));
const server = await createServer({
  root: new URL("../apps/desktop", import.meta.url).pathname,
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
});
const qq = await server.ssrLoadModule("/src/api/qq.ts");

const feed = {
  v_shelf: [
    { id: 207, v_niche: [{ v_card: [{ id: "999", title: "每日30首" }] }] },
    { id: 301, v_niche: [{ v_card: [{ id: "12", title: "新歌推荐" }, { id: "930001", title: "每日30首" }] }] },
  ],
};

try {
  await test("QQ daily recommendations", async (t) => {
    await t.test("discovers the daily playlist and returns playable QQ tracks", async () => {
      const calls = [];
      globalThis.window = { __TAURI_INTERNALS__: { invoke: async (command, args) => {
        calls.push({ command, ...args });
        if (calls.length === 1) return feed;
        return { songlist: [{
          id: 81, mid: "song81", name: "每日歌曲", interval: 215,
          singer: [{ id: 18, mid: "singer18", name: "歌手" }],
          album: { id: 27, mid: "album27", name: "专辑" }, pay: { pay_play: 1 },
        }] };
      } } };
      assert.deepEqual(await qq.daily(), [{
        id: 81, mid: "song81", src: "qq", name: "每日歌曲",
        artists: [{ id: 18, mid: "singer18", name: "歌手" }],
        album: { id: 27, mid: "album27", name: "专辑" },
        cover: "https://y.gtimg.cn/music/photo_new/T002R300x300M000album27.jpg",
        durationMs: 215000, vip: true,
      }]);
      assert.deepEqual(calls, [
        { command: "qqapi", module: "music.recommend.RecommendFeed", method: "get_recommend_feed",
          param: { direction: 0, page: 1, v_cache: [], v_uniq: [], s_num: 0 }, comm: undefined },
        { command: "qqapi", module: "music.srfDissInfo.aiDissInfo", method: "uniform_get_Dissinfo",
          param: { disstid: 930001, userinfo: 1, tag: 1, guid: "" }, comm: undefined },
      ]);
    });

    await t.test("reports a missing daily card instead of opening another playlist", async () => {
      let calls = 0;
      globalThis.window = { __TAURI_INTERNALS__: { invoke: async () => {
        calls++;
        return { v_shelf: [{ id: 301, v_niche: [{ v_card: [{ id: "12", title: "新歌推荐" }] }] }] };
      } } };
      await assert.rejects(qq.daily(), /暂时没有每日推荐/);
      assert.equal(calls, 1);
    });

    await t.test("rejects an invalid playlist ID before requesting its songs", async () => {
      let calls = 0;
      globalThis.window = { __TAURI_INTERNALS__: { invoke: async () => {
        calls++;
        return { v_shelf: [{ id: 301, v_niche: [{ v_card: [{ id: "invalid", title: "每日30首" }] }] }] };
      } } };
      await assert.rejects(qq.daily(), /每日推荐歌单无效/);
      assert.equal(calls, 1);
    });

    await t.test("surfaces a login error from the native layer", async () => {
      globalThis.window = { __TAURI_INTERNALS__: { invoke: async () => { throw new Error("登录已过期"); } } };
      await assert.rejects(qq.daily(), /登录已过期/);
    });
  });
} finally {
  delete globalThis.window;
  await server.close();
}
