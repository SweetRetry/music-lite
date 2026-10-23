#!/usr/bin/env node
// Read-only probes using the same local sessions and wire formats as the app.
// Session secrets stay in memory and are sent only to the corresponding music service.
import { execFileSync } from "node:child_process";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import { zzcSign } from "./qq-music-probe.mjs";

export function qqSession() {
  const source = `
import json, pathlib, plistlib
p = plistlib.loads((pathlib.Path.home() / 'Library/Containers/com.tencent.QQMusicMac/Data/Library/Preferences/com.tencent.QQMusicMac.plist').read_bytes())
a = plistlib.loads(p['AutoLoginUserInfo']); objects = a['$objects']
def ref(value):
    return objects[value.data] if isinstance(value, plistlib.UID) else value
user = ref(ref(ref(a['$top']['root'])['userArray'])['NS.objects'][0])
print(json.dumps(dict(uin=str(ref(user.get('strUserAccount')) or ref(user.get('nUserId'))), authst=ref(user['strAuthst']), loginType=ref(user['loginType']))))
`;
  try {
    return JSON.parse(execFileSync("python3", ["-c", source], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  } catch {
    throw new Error("Cannot read the QQ Music client session");
  }
}

function ncmSession() {
  let stored = { kind: "official" };
  try {
    stored = JSON.parse(readFileSync(`${homedir()}/Library/Application Support/com.sweetretry.musiclite/login.json`, "utf8"));
  } catch {}
  if (stored.kind === "own") return stored;
  if (stored.kind === "signedout") throw new Error("Music Lite is signed out");
  const buf = readFileSync(`${homedir()}/Library/HTTPStorages/com.netease.163music.binarycookies`);
  if (buf.subarray(0, 4).toString() !== "cook") throw new Error("Invalid official NetEase cookie file");
  const cookies = [];
  const pages = buf.readUInt32BE(4);
  let offset = 8 + pages * 4;
  for (let p = 0; p < pages; p++) {
    const size = buf.readUInt32BE(8 + p * 4);
    const page = buf.subarray(offset, offset + size);
    offset += size;
    for (let i = 0; i < page.readUInt32LE(4); i++) {
      const record = page.subarray(page.readUInt32LE(8 + i * 4));
      const str = (at) => {
        const start = record.readUInt32LE(at);
        return record.subarray(start, record.indexOf(0, start)).toString();
      };
      cookies.push({ domain: str(16), name: str(20), value: str(28) });
    }
  }
  const get = (name) => cookies.find((c) => c.domain.endsWith("music.163.com") && c.name === name)?.value ?? "";
  const session = { music_u: get("MUSIC_U"), csrf: get("__csrf") };
  if (!session.music_u) throw new Error("The official NetEase client is signed out");
  return session;
}

export async function ncmRequest(path, params = {}) {
  const session = ncmSession();
  const header = {
    os: "osx", appver: "3.1.13", osver: "15.0", deviceId: randomBytes(16).toString("hex").toUpperCase(),
    requestId: `${Date.now()}_1`, MUSIC_U: session.music_u, __csrf: session.csrf,
  };
  const body = JSON.stringify({ ...params, header: JSON.stringify(header), e_r: false });
  const digest = createHash("md5").update(`nobody${path}use${body}md5forencrypt`).digest("hex");
  const cipher = createCipheriv("aes-128-ecb", Buffer.from("e82ckenh8dichen8"), null);
  const encrypted = Buffer.concat([cipher.update(`${path}-36cd479b6b5-${body}-36cd479b6b5-${digest}`), cipher.final()]);
  const response = await fetch(`https://interface.music.163.com/eapi/${path.slice(5)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: Object.entries(header).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; ") },
    body: `params=${encrypted.toString("hex").toUpperCase()}`, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`NetEase HTTP ${response.status}`);
  let raw = Buffer.from(await response.arrayBuffer());
  if (raw[0] !== 123) {
    const decipher = createDecipheriv("aes-128-ecb", Buffer.from("e82ckenh8dichen8"), null);
    raw = Buffer.concat([decipher.update(raw), decipher.final()]);
  }
  const result = JSON.parse(raw.toString());
  if (result.code !== 200) throw new Error(`${path} returned ${result.code}`);
  return result;
}

export async function qqRequest(module, method, param = {}, identity = "client") {
  const session = qqSession();
  const comm = identity === "web"
    ? { ct: 24, cv: 4747474, format: "json", inCharset: "utf-8", outCharset: "utf-8", notice: 0, platform: "yqq.json", needNewCode: 1 }
    : { ct: 11, cv: 13020508, format: "json", inCharset: "utf-8", outCharset: "utf-8" };
  Object.assign(comm, { uin: session.uin, qq: session.uin, authst: session.authst, tmeLoginType: String(session.loginType) });
  const body = JSON.stringify({ comm, req_0: { module, method, param } });
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-128-gcm", Buffer.from("bd305f10d0ff74b6ef54dab835b5e1cf", "hex"), nonce);
  const sealed = Buffer.concat([nonce, cipher.update(body), cipher.final(), cipher.getAuthTag()]).toString("base64");
  const response = await fetch(`https://u6.y.qq.com/cgi-bin/musics.fcg?_=${Date.now()}&encoding=ag-1&sign=${zzcSign(body)}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8", Referer: "https://y.qq.com/", Cookie: `uin=${session.uin}; qqmusic_uin=${session.uin}; qqmusic_key=${session.authst}; qm_keyst=${session.authst}; tmeLoginType=${session.loginType}` },
    body: sealed, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`QQ Music HTTP ${response.status}`);
  let raw = Buffer.from(await response.arrayBuffer());
  if (raw[0] !== 123) {
    const key = Buffer.from("7a3f8c1d5e9b2f0a6c4d7e8b1f3a5c9d0e2b6f4a81", "hex");
    raw = raw.map((b, i) => b ^ key[i % key.length]);
  }
  const result = JSON.parse(raw.toString());
  if (result.code !== 0 || result.req_0?.code !== 0) throw new Error(`${module}.${method} returned ${result.code}/${result.req_0?.code}`);
  return result.req_0.data;
}

async function main() {
  const results = await Promise.allSettled([
    ncmRequest("/api/music-vip-membership/client/vip/info").then(({ data }) => ({
      service: "ncm", serverNow: data.now,
      memberships: [["redplus", "黑胶SVIP"], ["associator", "黑胶VIP"], ["musicPackage", "音乐包"]]
        .filter(([key]) => Number(data[key]?.expireTime) > Number(data.now))
        .map(([key, name]) => ({ name, expireMs: Number(data[key].expireTime), expireAt: new Date(Number(data[key].expireTime)).toISOString() })),
    })),
    qqRequest("VipLogin.VipLoginInter", "vip_login_base").then((data) => ({
      service: "qq", vip: data.identity?.vip, svip: data.svip, hugeVip: data.identity?.HugeVip,
      vipExpireAt: data.identity?.overdate, svipExpireAt: data.send, hugeVipExpireAt: data.identity?.HugeVipEnd,
      timeZone: "Asia/Shanghai",
    })),
  ]);
  console.log(JSON.stringify(results.map((r, i) => r.status === "fulfilled" ? r.value : { service: i === 0 ? "ncm" : "qq", error: r.reason.message }), null, 2));
  if (results.some((r) => r.status === "rejected")) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
