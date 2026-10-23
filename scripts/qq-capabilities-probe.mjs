#!/usr/bin/env node
// Read-only diagnostics. Session tickets, cookies and signed media URLs are never printed.
import { qqRequest, qqSession } from "./music-membership-probe.mjs";

const usage = "Usage: node scripts/qq-capabilities-probe.mjs [keyword] [all|search|quality|suggest]";
const summary = (song) => ({ id: song.id, mid: song.mid, name: song.name, interval: song.interval, file: song.file, pay: song.pay });

async function main() {
  if (process.argv.includes("--help")) return console.log(usage);
  const [keyword = "稻香", mode = "all", ...extra] = process.argv.slice(2);
  if (extra.length || !["all", "search", "quality", "suggest"].includes(mode)) throw new Error(usage);
  const search = (identity) => qqRequest("music.search.SearchCgiService", "DoSearchForQQMusicDesktop", {
    searchid: "123456789012345678", query: keyword, search_type: 0, num_per_page: 5, page_num: 1,
  }, identity);
  let songs = [];
  if (["all", "search"].includes(mode)) {
    for (const identity of ["web", "client"]) {
      const data = await search(identity);
      const list = data?.body?.song?.list ?? [];
      if (list.length && !songs.length) songs = list;
      console.log(JSON.stringify({ identity, count: list.length, samples: list.slice(0, 2).map(summary) }));
    }
  }
  if (["all", "quality"].includes(mode)) {
    if (!songs.length) songs = (await search("web"))?.body?.song?.list ?? [];
    for (const song of songs.slice(0, 2)) {
      const { track_info: info } = await qqRequest("music.pf_song_detail_svr", "get_song_detail_yqq", { song_mid: song.mid });
      console.log(JSON.stringify({ trackInfo: info ? summary(info) : null }));
      const media = info?.file?.media_mid ?? song.mid;
      const files = [["RS01", "flac"], ["F000", "flac"], ["M800", "mp3"], ["M500", "mp3"], ["C400", "m4a"]]
        .map(([prefix, ext]) => `${prefix}${media}${media}.${ext}`);
      const data = await qqRequest("music.vkey.GetVkey", "UrlGetVkey", {
        guid: "10000", songmid: files.map(() => song.mid), songtype: files.map(() => 0),
        uin: qqSession().uin, loginflag: 1, platform: "20", filename: files,
      });
      console.log(JSON.stringify({ song: song.name, files: data?.midurlinfo?.map((item) => ({
        filename: item.filename, hasUrl: Boolean(item.purl), result: item.result,
        matchesRequestedFilename: files.includes(item.filename), path: item.purl?.split("?")[0],
      })) }));
      // A vkey can exist for a nonexistent Hi-Res file. Confirm the CDN result itself.
      for (const item of data?.midurlinfo ?? []) {
        if (!item.purl) continue;
        const url = new URL(item.purl, data.sip[0]);
        url.protocol = "https:";
        const res = await fetch(url, { headers: { Range: "bytes=0-4095" }, signal: AbortSignal.timeout(15_000) });
        const reader = res.body?.getReader();
        const first = await reader?.read();
        await reader?.cancel();
        console.log(JSON.stringify({ mediaResponse: {
          requested: item.filename, status: res.status, type: res.headers.get("content-type"),
          length: res.headers.get("content-range") ?? res.headers.get("content-length"),
          prefix: Buffer.from(first?.value ?? []).subarray(0, 8).toString("hex"),
        } }));
      }
    }
  }
  if (["all", "suggest"].includes(mode)) {
    // QQMusic 11.10.0 SearchKeyCgi.addParam at 0x1001d9060 uses search_id, query, num_per_page=4.
    // CFStrings at 0x1023d67c0 through 0x1023d6840 contain the module, method and keys.
    for (const method of ["GetSmartBoxResultForPc", "GetSmartBoxResult"]) {
      const data = await qqRequest("music.smartboxCgi.SmartBoxCgi", method, { query: keyword, search_id: String(Date.now()), num_per_page: 4 });
      const hits = data?.data;
      console.log(JSON.stringify({ method, code: data?.code, subcode: data?.subcode,
        songs: hits?.song?.song_list, artists: hits?.singer?.singer_list, albums: hits?.album?.album_list,
        keywords: data?.items?.filter((item) => item.res_type === "search").slice(0, 6).map((item) => item.hint),
      }));
    }
  }
}

main().catch((error) => {
  // Avoid error objects. A failed child process may contain session stdout.
  console.error(error.message);
  process.exitCode = 1;
});
