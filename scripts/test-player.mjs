// Run with node --test scripts/test-player.mjs. Exercises the actual shared player through its public actions.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
const audios = [];
globalThis.Audio = class extends EventTarget {
  constructor() { super(); this.currentTime = 0; this.paused = true; this.volume = 0.8; this.readyState = 4; this.playbackRate = 1; audios.push(this); }
  set src(value) { this.source = value; this.currentTime = 0; }
  get src() { return this.source ?? ""; }
  getAttribute(name) { return name === "src" ? this.src : null; }
  removeAttribute() { this.source = ""; }
  load() {}
  async play() { this.paused = false; this.dispatchEvent(new Event("play")); }
  pause() { this.paused = true; this.dispatchEvent(new Event("pause")); }
};
globalThis.HTMLMediaElement = { HAVE_FUTURE_DATA: 3 };

const require = createRequire(new URL("../apps/desktop/package.json", import.meta.url));
const { createServer } = await import(pathToFileURL(require.resolve("vite")));
const server = await createServer({ root: new URL("../apps/desktop", import.meta.url).pathname, server: { middlewareMode: true, hmr: false }, appType: "custom" });
const { player, usePlayer } = await server.ssrLoadModule("/src/player.ts");
const { providers } = await server.ssrLoadModule("/src/providers.ts");
const audio = audios[0];
const realRandom = Math.random;
const track = (id, src = "ncm") => ({ id, src, mid: `mid${id}`, name: `Song ${id}`, artists: [], album: { id: 0, name: "" }, cover: "", durationMs: 10000, vip: false });
const current = () => usePlayer.getState().queue[usePlayer.getState().index]?.id;
let calls = [];
let unavailable = new Set();
function reset() {
  player.clear(); player.setPlaybackMode("repeat-all"); calls = []; unavailable = new Set(); Math.random = realRandom;
  for (const src of ["ncm", "qq"]) providers[src].songUrl = async (song, quality) => {
    calls.push({ id: song.id, src, quality });
    return unavailable.has(song.id) ? null : { url: `https://audio.example/${src}/${song.id}`, level: "exhigh", br: 320000 };
  };
}
async function ended() { audio.paused = true; audio.dispatchEvent(new Event("ended")); await new Promise(setImmediate); }

try {
  await test("shared playback modes", async (t) => {
    await t.test("list repeat advances and wraps for both services", async () => {
      for (const src of ["ncm", "qq"]) {
        reset(); await player.playQueue([track(1, src), track(2, src)], 0);
        await ended(); assert.equal(current(), 2);
        await ended(); assert.equal(current(), 1);
        assert.deepEqual(calls.map(({ id, src }) => ({ id, src })), [{ id: 1, src }, { id: 2, src }, { id: 1, src }]);
      }
    });
    await t.test("single repeat restarts the song while manual next and previous still navigate", async () => {
      reset(); await player.playQueue([track(1), track(2)], 0); player.setPlaybackMode("repeat-one");
      audio.currentTime = 10; await ended(); assert.equal(current(), 1); assert.equal(audio.currentTime, 0);
      await player.next(); assert.equal(current(), 2);
      await player.prev(); assert.equal(current(), 1);
    });
    await t.test("changing mode preserves the current stream and position and remembers the preference", async () => {
      reset(); await player.playQueue([track(1), track(2)], 0); player.seek(4);
      const source = audio.src; const count = calls.length;
      player.setPlaybackMode("shuffle");
      assert.equal(audio.src, source); assert.equal(audio.currentTime, 4); assert.equal(calls.length, count);
      assert.equal(storage.get("playbackMode"), "shuffle");
      assert.equal(usePlayer.getState().playing, true);
    });
    await t.test("shuffle visits each song once per round, reshuffles, and preserves history across rounds", async () => {
      reset(); Math.random = () => 0;
      await player.playQueue([track(1), track(2), track(3), track(4), track(5)], 0); player.setPlaybackMode("shuffle");
      const rounds = [[current()]];
      for (let i = 0; i < 4; i++) { await player.next(); rounds[0].push(current()); }
      rounds.push([]);
      for (let i = 0; i < 5; i++) { await player.next(); rounds[1].push(current()); }
      assert.deepEqual([...rounds[0]].sort(), [1, 2, 3, 4, 5]);
      assert.deepEqual([...rounds[1]].sort(), [1, 2, 3, 4, 5]);
      assert.notEqual(rounds[0][4], rounds[1][0]); assert.notDeepEqual(rounds[0], rounds[1]);
      assert.deepEqual(rounds, [[1, 3, 4, 5, 2], [3, 2, 4, 5, 1]]);
      const latest = current(); await player.prev(); assert.equal(current(), rounds[1][3]);
      await player.next(); assert.equal(current(), latest);
      for (let i = 0; i < 5; i++) await player.prev();
      assert.equal(current(), rounds[0][4]);
      assert.deepEqual(usePlayer.getState().queue.map((song) => song.id), [1, 2, 3, 4, 5]);
    });
    await t.test("shuffle honors explicit play-next and a jump without repeating that upcoming song", async () => {
      reset(); await player.playQueue([track(1), track(2), track(3), track(4)], 0); player.setPlaybackMode("shuffle");
      player.playNext(track(3)); await player.next(); assert.equal(current(), 3);
      await player.prev(); assert.equal(current(), 1); await player.next(); assert.equal(current(), 3);
      await player.jumpTo(usePlayer.getState().queue.findIndex((song) => song.id === 4)); assert.equal(current(), 4);
      await player.next(); assert.equal(current(), 2);
    });
    await t.test("queue removal and replacement leave no stale shuffle entries", async () => {
      reset(); await player.playQueue([track(1), track(2), track(3)], 0); player.setPlaybackMode("shuffle");
      player.remove(1); await player.next(); assert.equal(current(), 3);
      await player.remove(usePlayer.getState().index); assert.equal(current(), 1);
      await player.next(); assert.equal(current(), 1);
      await player.playQueue([track(7, "qq"), track(8, "qq")], 1); await player.next(); assert.equal(current(), 7);
    });
    await t.test("all-unplayable queues terminate in every mode", async () => {
      for (const mode of ["repeat-one", "repeat-all", "shuffle"]) {
        reset(); unavailable = new Set([1, 2, 3]); player.setPlaybackMode(mode);
        await player.playQueue([track(1), track(2), track(3)], 0);
        assert.deepEqual([...new Set(calls.map((call) => call.id))].sort(), [1, 2, 3]);
        assert.equal(calls.length, 3); assert.equal(usePlayer.getState().loading, false); assert.equal(usePlayer.getState().playing, false);
        assert.equal(usePlayer.getState().notice, "这些歌都暂时无法播放");
      }
    });
    await t.test("a restored player keeps its selected mode", async () => {
      reset(); player.setPlaybackMode("repeat-one");
      const restored = await server.ssrLoadModule("/src/player.ts?restored");
      assert.equal(restored.usePlayer.getState().playbackMode, "repeat-one");
    });
  });
} finally {
  Math.random = realRandom; player.clear(); await server.close();
  delete globalThis.Audio; delete globalThis.HTMLMediaElement; delete globalThis.localStorage;
}
