// Run with node --test scripts/test-music-capabilities.mjs. Exercises the actual app adapters.
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
const ncm = await server.ssrLoadModule("/src/api/vip.ts");
const quality = await server.ssrLoadModule("/src/api/quality.ts");
const qqAccess = await server.ssrLoadModule("/src/qqapi.ts");
const rawSong = {
  id: 81, mid: "song81", name: "测试歌曲", interval: 200,
  singer: [{ id: 18, mid: "singer18", name: "歌手" }],
  album: { id: 27, mid: "album27", name: "专辑" }, pay: { pay_play: 1 },
};
const track = {
  id: 81, mid: "song81", src: "qq", name: "测试歌曲",
  artists: [{ id: 18, mid: "singer18", name: "歌手" }],
  album: { id: 27, mid: "album27", name: "专辑" },
  cover: "https://y.gtimg.cn/music/photo_new/T002R300x300M000album27.jpg",
  durationMs: 200000, vip: true,
};
function mockInvoke(handler) {
  globalThis.window = { __TAURI_INTERNALS__: { invoke: handler } };
}
function mockAudio({ file = {}, playable = [], responseOrder, denied = false } = {}) {
  const calls = [];
  mockInvoke(async (command, args) => {
    calls.push({ command, ...args });
    if (command === "qq_login") return "10001";
    if (args.method === "get_song_detail_yqq") {
      return { track_info: { interval: 200, file: { media_mid: "media81", ...file } } };
    }
    if (args.method === "UrlGetVkey") {
      const replies = args.param.filename.map((filename) => ({
        filename, purl: !denied && playable.some((prefix) => filename.startsWith(prefix)) ? `${filename}?vkey=fixture` : "",
      }));
      return { sip: ["http://audio.example/"], midurlinfo: responseOrder === "reverse" ? replies.reverse() : replies };
    }
    throw new Error(`Unexpected command ${command}/${args?.method}`);
  });
  return calls;
}
const allFiles = {
  size_hires: 50000000, size_flac: 25000000, size_320mp3: 8000000, size_128mp3: 3200000, size_96aac: 2400000,
};
const actualNow = Date.now;
try {
  await test("QQ playlist includes its title, creator and playlist cover", async () => {
    mockInvoke(async (_command, args) => {
      assert.equal(args.method, "CgiGetDiss");
      return {
        dirinfo: args.param.onlysonglist === 0
          ? { dirid: 6, title: "华语", picurl: "http://image.example/playlist.jpg", creator: { nick: "创建者" } }
          : { dirid: 6, title: "", picurl: "", creator: { nick: "" } },
        songlist: [rawSong], total_song_num: 1,
      };
    });
    assert.deepEqual(await qq.playlist(7620399605), {
      id: 7620399605, name: "华语", cover: "https://image.example/playlist.jpg",
      trackCount: 1, mine: true, liked: false, creator: "创建者", tracks: [track],
    });
  });
  await test("QQ login access", async (t) => {
    const deferred = () => {
      let resolve;
      let reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      return { promise, resolve, reject };
    };
    let picker = deferred();
    let pickerOpened = deferred();
    let pickerCount = 0;
    let granted = false;
    mockInvoke(async (command) => {
      if (command === "qq_request_access") {
        pickerCount++;
        pickerOpened.resolve();
        return picker.promise;
      }
      if (!granted) throw "QQ_PERMISSION_DENIED";
      if (command === "qq_login") return "10001";
      return { body: { song: { list: [rawSong] } } };
    });
    await t.test("concurrent denied calls share one automatic picker and cancellation gives one actionable line", async () => {
      const pending = Promise.allSettled([qq.signedIn(), qq.search("测试")]);
      await pickerOpened.promise;
      await new Promise(setImmediate);
      assert.equal(pickerCount, 1);
      picker.resolve(false);
      assert.deepEqual((await pending).map((result) => ({ status: result.status, message: result.reason?.message })), [
        { status: "rejected", message: "需要授权读取 QQ 音乐登录。" },
        { status: "rejected", message: "需要授权读取 QQ 音乐登录。" },
      ]);
      assert.equal(qqAccess.useQqAccess.getState().denied, true);
    });
    await t.test("another denied request does not automatically reopen a cancelled picker", async () => {
      await assert.rejects(qq.search("测试"), (error) => error.message === "需要授权读取 QQ 音乐登录。");
      assert.equal(pickerCount, 1);
    });
    await t.test("manual grant retries in the same session and concurrent denied calls join that picker", async () => {
      picker = deferred();
      pickerOpened = deferred();
      const manual = qqAccess.requestQqAccess();
      const pending = Promise.all([manual, qq.signedIn(), qq.search("测试")]);
      await pickerOpened.promise;
      await new Promise(setImmediate);
      assert.equal(pickerCount, 2);
      granted = true;
      picker.resolve(true);
      assert.deepEqual(await pending, [true, true, [track]]);
      assert.equal(qqAccess.useQqAccess.getState().denied, false);
    });
    await t.test("a delayed denial issued before grant retries after that grant without another picker", async () => {
      const stale = deferred();
      const manualPicker = deferred();
      const opened = deferred();
      let requests = 0;
      let pickers = 0;
      mockInvoke(async (command) => {
        if (command === "qq_request_access") {
          pickers++;
          opened.resolve();
          return manualPicker.promise;
        }
        requests++;
        if (requests === 1) return stale.promise;
        return { body: { song: { list: [rawSong] } } };
      });
      const search = qq.search("测试");
      const manual = qqAccess.requestQqAccess();
      await opened.promise;
      manualPicker.resolve(true);
      assert.equal(await manual, true);
      stale.reject("QQ_PERMISSION_DENIED");
      assert.deepEqual(await search, [track]);
      assert.equal(requests, 2);
      assert.equal(pickers, 1);
      assert.equal(qqAccess.useQqAccess.getState().denied, false);
    });
    await t.test("service errors do not request file access", async () => {
      let pickers = 0;
      mockInvoke(async (command) => {
        if (command === "qq_request_access") { pickers++; return false; }
        throw "服务暂不可用";
      });
      await assert.rejects(qq.search("测试"), (error) => error.message === "服务暂不可用");
      assert.equal(pickers, 0);
    });
  });
  await test("QQ login read errors remain actionable instead of looking signed out", async () => {
    mockInvoke(async () => { throw "没有权限读取 QQ 音乐的登录"; });
    await assert.rejects(qq.signedIn(), /没有权限读取/);
    await assert.rejects(qq.me(), /没有权限读取/);
  });
  await test("QQ search and suggestions", async (t) => {
    await t.test("full search returns QQ tracks using the web identity", async () => {
      const calls = [];
      mockInvoke(async (command, args) => { calls.push({ command, ...args }); return { body: { song: { list: [rawSong] } } }; });
      assert.deepEqual(await qq.search("测试"), [track]);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].command, "qqapi");
      assert.equal(calls[0].module, "music.search.SearchCgiService");
      assert.equal(calls[0].method, "DoSearchForQQMusicDesktop");
      assert.equal(calls[0].comm, "web");
      assert.equal(calls[0].param.query, "测试");
    });
    await t.test("smartbox deduplicates keywords and returns navigable artist and album mids", async () => {
      mockInvoke(async (_command, args) => {
        if (args.method === "GetSmartBoxResult") return { items: [{ res_type: "search", hint: "周杰伦" }, { res_type: "search", hint: "周杰伦" }, { res_type: "song", hint: "ignored" }] };
        if (args.method === "GetSmartBoxResultForPc") return { code: 0, subcode: 0, data: {
          singer: { singer_list: [{ id: 42, mid: "singer42", name: "周杰伦", pic: "http://image.example/artist.jpg" }] },
          album: { album_list: [{ id: 43, mid: "album43", name: "七里香", singer: "周杰伦" }] },
        } };
        throw new Error(`Unexpected method ${args.method}`);
      });
      assert.deepEqual(await qq.suggest("周"), [
        { value: "搜索建议", items: [{ kind: "keyword", keyword: "周杰伦" }] },
        { value: "歌手", items: [{ kind: "artist", id: "singer42", name: "周杰伦", avatar: "https://image.example/artist.jpg" }] },
        { value: "专辑", items: [{ kind: "album", id: "album43", name: "七里香", artist: "周杰伦" }] },
      ]);
    });
    await t.test("failed smartbox response surfaces an error", async () => {
      mockInvoke(async (_command, args) => args.method === "GetSmartBoxResult" ? { items: [] } : { code: 1, subcode: 0 });
      await assert.rejects(qq.suggest("周"), /暂时无法获取搜索建议/);
    });
  });

  await test("QQ audio quality and privilege", async (t) => {
    await t.test("standard only requests standard files and uses the media mid", async () => {
      const calls = mockAudio({ file: allFiles, playable: ["M500", "C400"] });
      assert.deepEqual(await qq.songUrl(track, "standard"), {
        url: "https://audio.example/M500media81media81.mp3?vkey=fixture", level: "standard", br: 128000,
      });
      assert.deepEqual(calls.find((c) => c.method === "UrlGetVkey").param.filename, ["M500media81media81.mp3", "C400media81media81.m4a"]);
    });
    await t.test("Hi-Res without a real file is never requested even if a vkey could exist", async () => {
      const calls = mockAudio({ file: { ...allFiles, size_hires: 0 }, playable: ["RS01", "F000", "M800"] });
      assert.deepEqual(await qq.songUrl(track, "hires"), {
        url: "https://audio.example/F000media81media81.flac?vkey=fixture", level: "lossless", br: 1000000,
      });
      assert.deepEqual(calls.find((c) => c.method === "UrlGetVkey").param.filename, [
        "F000media81media81.flac", "M800media81media81.mp3", "M500media81media81.mp3", "C400media81media81.m4a",
      ]);
    });
    await t.test("account denial falls back from lossless to 320 kbps and marks the locked tier", async () => {
      mockAudio({ file: { ...allFiles, size_hires: 0 }, playable: ["M800", "M500", "C400"] });
      assert.deepEqual(await qq.songUrl(track, "lossless"), {
        url: "https://audio.example/M800media81media81.mp3?vkey=fixture", level: "exhigh", br: 320000,
      });
      assert.deepEqual(await qq.privilege(track), { standard: "ok", higher: "none", exhigh: "ok", lossless: "vip", hires: "none" });
    });
    await t.test("no authorized file produces no playable source", async () => {
      mockAudio({ file: allFiles, denied: true });
      assert.equal(await qq.songUrl(track, "hires"), null);
    });
    await t.test("reordered vkeys stay associated with their filenames", async () => {
      mockAudio({ file: allFiles, playable: ["RS01", "M500"], responseOrder: "reverse" });
      assert.deepEqual(await qq.songUrl(track, "hires"), {
        url: "https://audio.example/RS01media81media81.flac?vkey=fixture", level: "hires", br: 2000000,
      });
    });
    await t.test("a shared 192 kbps preference selects the QQ standard tier", async () => {
      assert.equal(quality.qualityFor("higher", qq.QUALITIES), "standard");
      mockAudio({ file: allFiles, playable: ["M800", "M500"] });
      assert.deepEqual(await qq.songUrl(track, "higher"), {
        url: "https://audio.example/M500media81media81.mp3?vkey=fixture", level: "standard", br: 128000,
      });
    });
  });

  await test("membership expiration", async (t) => {
    Date.now = () => 1792742400000;
    await t.test("QQ super membership preserves the exact China time independently of local timezone", async () => {
      mockInvoke(async () => ({ identity: { HugeVip: 1, HugeVipEnd: "2027-06-01 10:07:53", vip: 1, overdate: "2027-12-01 10:07:53" } }));
      assert.deepEqual(await qq.vip(), { name: "超级会员", expireMs: 1811815673000 });
    });
    await t.test("QQ falls back to its active green membership", async () => {
      mockInvoke(async () => ({ identity: { HugeVip: 0, vip: 1, overdate: "2027-06-01 10:07:53" } }));
      assert.deepEqual(await qq.vip(), { name: "绿钻", expireMs: 1811815673000 });
    });
    await t.test("QQ distinguishes luxury green membership and falls back after super membership expires", async () => {
      mockInvoke(async () => ({ svip: 1, identity: { HugeVip: 1, HugeVipEnd: "2020-06-01 10:07:53", vip: 1, overdate: "2027-06-01 10:07:53" } }));
      assert.deepEqual(await qq.vip(), { name: "豪华绿钻", expireMs: 1811815673000 });
    });
    await t.test("expired or absent QQ memberships show no active membership", async () => {
      for (const identity of [{ HugeVip: 1, HugeVipEnd: "2020-06-01 10:07:53", vip: 1, overdate: "2020-06-01 10:07:53" }, {}, { HugeVip: 1, HugeVipEnd: "invalid" }]) {
        mockInvoke(async () => ({ identity }));
        assert.equal(await qq.vip(), null);
      }
    });
    await t.test("NCM prefers active SVIP over a later VIP expiration", async () => {
      mockInvoke(async () => ({ data: { now: 1792742400000, redplus: { expireTime: 1792943999000 }, associator: { expireTime: 1811815673000 } } }));
      assert.deepEqual(await ncm.vip(), { name: "黑胶SVIP", expireMs: 1792943999000 });
    });
    await t.test("NCM falls back from expired SVIP to active VIP", async () => {
      mockInvoke(async () => ({ data: { now: 1792742400000, redplus: { expireTime: 1700000000000 }, associator: { expireTime: 1792943999000 } } }));
      assert.deepEqual(await ncm.vip(), { name: "黑胶VIP", expireMs: 1792943999000 });
    });
    await t.test("NCM expired memberships and never-member payloads show no active membership", async () => {
      for (const data of [{ now: 1792742400000, redplus: { expireTime: 1700000000000 }, associator: { expireTime: 1700000000000 } }, { now: 1792742400000, associator: {}, musicPackage: {} }]) {
        mockInvoke(async () => ({ data }));
        assert.equal(await ncm.vip(), null);
      }
    });
    Date.now = actualNow;
  });
} finally {
  Date.now = actualNow;
  delete globalThis.window;
  await server.close();
}
