#!/usr/bin/env node
// Follows the official recommendation page's onPlayDaily30 flow.
// --client-login reads the macOS client's existing ticket. It is only sent to y.qq.com.
import { execFileSync } from "node:child_process";
import { zzcSign } from "./qq-music-probe.mjs";

const usage = `Usage: node scripts/qq-music-daily-probe.mjs [--client-login]
Without flags, tries the same flow anonymously.
--client-login uses the official macOS client's existing session.
Output includes RPC parameters, statuses, the daily card, and its songs.
Login tickets and cookies are never printed.`;

function readSession() {
  // plistlib resolves binary plists and NSKeyedArchiver UIDs without third-party packages.
  const source = `
import json, pathlib, plistlib
try:
    path = pathlib.Path.home() / 'Library/Containers/com.tencent.QQMusicMac/Data/Library/Preferences/com.tencent.QQMusicMac.plist'
    prefs = plistlib.loads(path.read_bytes())
    archive = plistlib.loads(prefs['AutoLoginUserInfo'])
    objects = archive['$objects']
    def ref(value):
        return objects[value.data] if isinstance(value, plistlib.UID) else value
    root = ref(archive['$top']['root'])
    users = ref(root['userArray'])['NS.objects']
    user = ref(users[0])
    def field(key, fallback=None):
        return ref(user.get(key, fallback))
    session = dict(uin=str(field('strUserAccount') or field('nUserId') or ''), authst=field('strAuthst') or '', loginType=field('loginType', 0))
    if not session['uin'] or not session['authst']:
        raise ValueError()
    print(json.dumps(session))
except Exception:
    raise SystemExit('QQ Music client session is unavailable')
`;
  try {
    return JSON.parse(execFileSync("python3", ["-c", source], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  } catch {
    throw new Error("Cannot read the QQ Music client session");
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) return console.log(usage);
  if (args.some((arg) => arg !== "--client-login")) throw new Error(usage);
  const session = args.includes("--client-login") ? readSession() : null;
  let token = 5381;
  for (const char of session?.authst ?? "") token = (token * 33 + char.charCodeAt(0)) | 0;
  token &= 0x7fffffff;
  const comm = {
    format: "json", ct: 6, cv: 90000, platform: "wk_v17", uid: "", guid: "",
    inCharset: "utf-8", outCharset: "utf-8", notice: 0, needNewCode: 1,
    uin: session?.uin ?? 0, g_tk_new_20200303: token, g_tk: token,
  };
  if (session) Object.assign(comm, { qq: session.uin, authst: session.authst, tmeLoginType: String(session.loginType) });
  const exchanges = [];
  const sensitiveKeys = new Set(["authst", "cookie", "qqmusic_key", "qm_keyst", "skey", "p_skey", "token", "access_token"]);
  const sanitize = (value) => JSON.parse(JSON.stringify(value, (key, item) => {
    if (sensitiveKeys.has(key.toLowerCase())) return "[redacted]";
    return typeof item === "string" && session?.authst ? item.replaceAll(session.authst, "[redacted]") : item;
  }));

  async function request(module, method, param) {
    const rpc = { module, method, param };
    const body = JSON.stringify({ comm, req_1: rpc });
    const url = new URL("https://u6.y.qq.com/cgi-bin/musics.fcg");
    url.searchParams.set("_", String(Date.now()));
    url.searchParams.set("sign", zzcSign(body));
    const headers = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", Referer: "https://y.qq.com/", Origin: "https://y.qq.com" };
    if (session) headers.Cookie = `uin=${session.uin}; qqmusic_uin=${session.uin}; qqmusic_key=${session.authst}; qm_keyst=${session.authst}; tmeLoginType=${session.loginType}`;
    const response = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`QQ Music returned HTTP ${response.status}`);
    const reply = await response.json();
    const result = reply.req_1;
    exchanges.push({ module, method, param, httpStatus: response.status, code: reply.code, requestCode: result?.code });
    if (reply.code !== 0 || result?.code !== 0) {
      throw Object.assign(new Error(`${module}.${method} returned ${reply.code}/${result?.code}`), { exchanges });
    }
    return result.data;
  }

  const feed = await request("music.recommend.RecommendFeed", "get_recommend_feed", { direction: 0, page: 1, v_cache: [], v_uniq: [], s_num: 0 });
  const cards = feed.v_shelf?.find((shelf) => shelf.id === 301)?.v_niche?.[0]?.v_card ?? [];
  const card = cards.find((item) => item.title === "每日30首");
  if (!card) {
    console.log(JSON.stringify(sanitize({ authenticated: Boolean(session), exchanges, shelfIds: feed.v_shelf?.map((shelf) => shelf.id) ?? [], dailyCard: null }), null, 2));
    return;
  }
  if (!/^\d+$/.test(String(card.id)) || !Number.isSafeInteger(Number(card.id))) throw new Error("The daily card has an invalid playlist ID");
  const playlist = await request("music.srfDissInfo.aiDissInfo", "uniform_get_Dissinfo", { disstid: Number(card.id), userinfo: 1, tag: 1, guid: "" });
  console.log(JSON.stringify(sanitize({ authenticated: Boolean(session), exchanges, dailyCard: card, songCount: playlist.songlist?.length ?? 0, playlist }), null, 2));
}

main().catch((error) => {
  if (error.exchanges) console.log(JSON.stringify({ exchanges: error.exchanges }, null, 2));
  // Never dump an error object that could carry a child process's session stdout.
  console.error(error.message);
  process.exitCode = 1;
});
