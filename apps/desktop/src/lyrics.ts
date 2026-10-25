// Lyrics for a track, shared by the lyrics page and the desktop lyrics.
import { type LyricLine, type Track, srcOf } from "./api";
import { peek, put } from "./cache";
import { scoped } from "./mode";
import { providerOf } from "./providers";

// Lyrics never change once published, so a cached copy is final and is never refetched.
const cacheKey = (t: Track) => scoped(`lyric:${t.id}`, srcOf(t));

export const cachedLyric = (t: Track) => peek<LyricLine[]>(cacheKey(t));

export async function loadLyric(t: Track): Promise<LyricLine[]> {
  const cached = cachedLyric(t);
  if (cached) return cached;
  const lines = await providerOf(t).lyric(t);
  if (lines.length) put(cacheKey(t), lines);
  return lines;
}
