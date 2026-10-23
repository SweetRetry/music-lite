#!/usr/bin/env node
// Replays the public wk_v17 page requests. No cookies or local login data are read.
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const usage = `Usage:
  node scripts/qq-music-probe.mjs artist <singerMid>
  node scripts/qq-music-probe.mjs album <albumMid>
  node scripts/qq-music-probe.mjs songs <singerMid> [param-json]
  node scripts/qq-music-probe.mjs albums <singerMid> [param-json]

Optional param-json overrides the songs/albums pagination, order, or types.
Example: songs 0025NhlN2yWrP4 '{"begin":30,"num":30,"order":0}'
Add --dry-run to print the signed request without sending it.
Output contains the exact request and the unmodified JSON response.
Each req_N has its own code. A top-level code of 0 does not imply all succeeded.`;

export function zzcSign(payload) {
  const digest = createHash("sha1").update(payload).digest();
  const hex = digest.toString("hex").toUpperCase();
  const pick = (indices) => indices.map((i) => hex[i] ?? "").join("");
  const mask = [89, 39, 179, 150, 218, 82, 58, 252, 177, 52, 186, 123, 120, 64, 242, 133, 143, 161, 121, 179];
  const middle = Buffer.from(digest.map((byte, i) => byte ^ mask[i]))
    .toString("base64").replace(/[\\/+=]/g, "");
  return ("zzc" + pick([23, 14, 6, 36, 16, 40, 7, 19]) + middle + pick([16, 1, 32, 12, 19, 27, 8, 5])).toLowerCase();
}

const rpc = (module, method, param) => ({ module, method, param });

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes("--help")) {
    console.log(usage);
    return;
  }
  const dryRun = args.includes("--dry-run");
  const [mode, mid, overrides, ...extra] = args.filter((arg) => arg !== "--dry-run");
  if (!["artist", "album", "songs", "albums"].includes(mode) || !/^[a-zA-Z0-9]+$/.test(mid ?? "") || extra.length) {
    throw new Error(usage);
  }
  if (overrides && mode !== "songs" && mode !== "albums") throw new Error("param-json is only supported for songs/albums");
  const param = overrides ? JSON.parse(overrides) : {};
  if (param === null || Array.isArray(param) || typeof param !== "object") throw new Error("param-json must be an object");

  let calls;
  if (mode === "artist") {
    calls = [
      rpc("music.musichallSinger.SingerInfoInter", "GetSingerDetail", { singer_mids: [mid], pic: 1, group_singer: 1, wiki_singer: 1, ex_singer: 1 }),
      rpc("music.musichallSong.SongListInter", "GetSingerSongList", { singerMid: mid, begin: 0, num: 10, order: 1 }),
      rpc("music.musichallAlbum.AlbumListServer", "GetAlbumList", { singerMid: mid, order: 1, num: 30, begin: 0 }),
      rpc("music.musichallAlbum.SelectedAlbumServer", "SelectedAlbumList", { singerMid: mid }),
      rpc("Concern.ConcernSystemServer", "cgi_qry_concern_status", { vec_userinfo: [{ usertype: 1, userid: mid }], opertype: 5, encrypt_singerid: 1 }),
      rpc("music.SimilarSingerSvr", "GetSimilarSingerList", { singerMid: mid, num: 6 }),
      rpc("MvService.MvInfoProServer", "GetSingerMvList", { singerid: 0, singermid: mid, tagid: 0, start: 0, count: 6, order: 1 }),
      rpc("music.sociality.KolFansVIPAccount", "Singer2PkgUinStr", { SingerMIDs: [mid] }),
    ];
  } else if (mode === "album") {
    calls = [
      rpc("music.musichallAlbum.OtherAlbumList", "OtherAlbumList", { albumMid: mid, order: 0, num: 6 }),
      rpc("music.musichallAlbum.AlbumInfoServer", "GetAlbumDetail", { albumMid: mid }),
      rpc("music.musichallAlbum.AlbumSongList", "GetAlbumSongList", { albumMid: mid, begin: 0, num: 1000, order: 2 }),
      rpc("music.musicasset.AlbumFavRead", "IsAlbumFan", { v_albumMid: [mid] }),
      rpc("mall.MusicMallSvr", "QueryAlbumDetail", { albummid: mid }),
    ];
  } else if (mode === "songs") {
    calls = [rpc("music.musichallSong.SongListInter", "GetSingerSongList", { singerMid: mid, begin: 0, num: 30, order: 1, ...param })];
  } else {
    calls = [rpc("music.musichallAlbum.AlbumListServer", "GetAlbumList", { singerMid: mid, order: 0, num: 30, begin: 0, ...param })];
  }

  const payload = Object.fromEntries(calls.map((call, i) => [`req_${i}`, call]));
  payload.comm = { g_tk: 5381, uin: 0, format: "json", ct: 6, cv: 1770, platform: "wk_v17", uid: "", guid: "" };
  // Sign and send the same serialized bytes. Whitespace/key order affect the signature.
  const body = JSON.stringify(payload);
  const url = new URL("https://u6.y.qq.com/cgi-bin/musics.fcg");
  url.searchParams.set("_", String(Date.now()));
  url.searchParams.set("sign", zzcSign(body));
  const request = {
    url: url.href,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", Referer: "https://y.qq.com/", Origin: "https://y.qq.com" },
    body,
  };
  if (dryRun) {
    console.log(JSON.stringify({ request }, null, 2));
    return;
  }
  const response = await fetch(request.url, { ...request, signal: AbortSignal.timeout(15_000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
  console.log(JSON.stringify({ request, httpStatus: response.status, response: JSON.parse(text) }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
