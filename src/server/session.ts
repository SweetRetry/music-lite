// Reuses the login of the official macOS client by reading its cookie jar.
// The cookie stays in memory and never leaves this machine except toward music.163.com.
import { homedir } from "node:os";
import { readFileSync } from "node:fs";

const JAR = `${homedir()}/Library/HTTPStorages/com.netease.163music.binarycookies`;

type Cookie = { domain: string; name: string; value: string };

// Apple binarycookies: big-endian page table, little-endian cookie records.
export function parseBinaryCookies(buf: Buffer): Cookie[] {
  if (buf.toString("ascii", 0, 4) !== "cook") throw new Error("Not a binarycookies file");
  const pages = buf.readInt32BE(4);
  let offset = 8 + pages * 4;
  const cookies: Cookie[] = [];
  for (let p = 0; p < pages; p++) {
    const size = buf.readInt32BE(8 + p * 4);
    const page = buf.subarray(offset, offset + size);
    offset += size;
    const count = page.readInt32LE(4);
    for (let i = 0; i < count; i++) {
      const rec = page.subarray(page.readInt32LE(8 + i * 4));
      const str = (at: number) => rec.toString("utf8", at, rec.indexOf(0, at));
      cookies.push({
        domain: str(rec.readInt32LE(16)),
        name: str(rec.readInt32LE(20)),
        value: str(rec.readInt32LE(28)),
      });
    }
  }
  return cookies;
}

export function readOfficialSession(): { MUSIC_U: string; __csrf: string } {
  const cookies = parseBinaryCookies(readFileSync(JAR)).filter((c) => c.domain.endsWith("music.163.com"));
  const get = (name: string) => cookies.find((c) => c.name === name)?.value ?? "";
  const MUSIC_U = get("MUSIC_U");
  if (!MUSIC_U) throw new Error("No login found. Sign in once in the official NetEase Music app.");
  return { MUSIC_U, __csrf: get("__csrf") };
}
