// The account's membership, from the same endpoint the official client reads for its profile page.
// data holds one object per membership kind, each with expireTime (ms) and vipLevel; never-VIP
// accounts get empty objects. redplus is 黑胶SVIP, associator is 黑胶VIP, musicPackage is 音乐包.
import { eapi } from "../eapi";

export type Vip = { name: string; expireMs: number };

const KINDS = [
  ["redplus", "黑胶SVIP"],
  ["associator", "黑胶VIP"],
  ["musicPackage", "音乐包"],
] as const;

// Returns null when no membership is active. The best active one wins.
export async function vip(): Promise<Vip | null> {
  const { data } = await eapi("/api/music-vip-membership/client/vip/info");
  const now = Number(data?.now) || Date.now();
  for (const [key, name] of KINDS) {
    const expireMs = Number(data?.[key]?.expireTime) || 0;
    if (expireMs > now) return { name, expireMs };
  }
  return null;
}
