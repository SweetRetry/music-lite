// The official UI calls fetch("/api/...") and the native CEF layer rewrites it into an
// encrypted /eapi/ request. This module is that native layer.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readOfficialSession } from "./session";

const KEY = Buffer.from("e82ckenh8dichen8");
const HOST = "https://interface.music.163.com";
const APPVER = "3.1.13";

const aes = (data: Buffer, decrypt = false) => {
  const c = decrypt ? createDecipheriv("aes-128-ecb", KEY, null) : createCipheriv("aes-128-ecb", KEY, null);
  return Buffer.concat([c.update(data), c.final()]);
};

export function encryptParams(path: string, body: object): string {
  const text = JSON.stringify(body);
  const digest = createHash("md5").update(`nobody${path}use${text}md5forencrypt`).digest("hex");
  return aes(Buffer.from(`${path}-36cd479b6b5-${text}-36cd479b6b5-${digest}`)).toString("hex").toUpperCase();
}

const session = readOfficialSession();
const deviceId = randomBytes(16).toString("hex").toUpperCase();

const header = () => ({
  os: "osx",
  appver: APPVER,
  osver: "15.0",
  deviceId,
  requestId: `${Date.now()}_${Math.floor(Math.random() * 1000)}`,
  MUSIC_U: session.MUSIC_U,
  __csrf: session.__csrf,
});

export class ApiError extends Error {
  constructor(public path: string, public code: number, message: string) {
    super(`${path} returned ${code}: ${message}`);
  }
}

export async function eapi<T = any>(path: `/api/${string}`, body: Record<string, unknown> = {}): Promise<T> {
  const h = header();
  const res = await fetch(HOST + path.replace(/^\/api\//, "/eapi/"), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) NeteaseMusicDesktop/${APPVER}`,
      Cookie: Object.entries(h).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; "),
    },
    body: new URLSearchParams({ params: encryptParams(path, { ...body, header: JSON.stringify(h), e_r: false }) }),
  });
  const raw = Buffer.from(await res.arrayBuffer());
  const json = JSON.parse(raw[0] === 0x7b ? raw.toString() : aes(raw, true).toString());
  if (json.code !== 200) throw new ApiError(path, json.code, json.message ?? json.msg ?? "unknown");
  return json;
}
