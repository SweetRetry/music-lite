// What one song offers and what this account may play, from the `privileges` array of
// /api/v3/song/detail (the same object the official client keeps as `songPrivilege`).
// Fields below were read off real cached payloads of the official macOS client, not from docs:
//   pl           highest bitrate (bps) this account can play right now. 320000 for a free account on a
//                VIP-only lossless song, 999000 once a membership covers it. Always a plain bitrate.
//   plLevel      the same ceiling as a level name. It can leave our ladder ("jyeffect" for members),
//                so we compare pl instead.
//   maxbr        top bitrate of the song itself, capped at 999000 even when a hi-res file exists.
//   maxBrLevel   top level of the song ("hires", "lossless", or "vivid" for spatial audio). "vivid"
//                says nothing about the plain ladder, so only an explicit "hires" is used.
//   chargeInfoList  one { rate, chargeType } per level the song lists. chargeType 0 is free, 1 needs
//                membership (only 0 and 1 were seen). A missing rate means the song lacks that level,
//                except lossless, which is listed even for songs capped at 320000, so maxbr gates it.
//   fee          song-wide billing: 0 free, 1 VIP song, 8 free at low quality and VIP above. Not needed
//                once chargeInfoList is read, so unused.
// Unconfirmed: SVIP-only tiers on the plain ladder. Nothing in the payloads separates VIP from SVIP,
// so every locked level is "VIP".
import { eapi } from "../eapi";
import { QUALITIES, RATE, type Quality } from "./quality";

export type Access = "ok" | "vip" | "none";
export type Privilege = Record<Quality, Access>;

type Raw = {
  pl?: number;
  plLevel?: string;
  maxbr?: number;
  maxBrLevel?: string;
  chargeInfoList?: { rate: number; chargeType: number }[] | null;
};

export function toPrivilege(p: Raw): Privilege {
  const rates = new Set(p.chargeInfoList?.map((c) => c.rate));
  const listed = rates.size > 0;
  const canPlay = Number(p.pl) || 0;
  const top = Number(p.maxbr) || 0;
  const has = (q: Quality) => {
    if (!listed) return true;
    if (q === "lossless") return rates.has(RATE.lossless) && top >= RATE.lossless;
    if (q === "hires") return rates.has(RATE.hires) || p.maxBrLevel === "hires";
    return rates.has(RATE[q]);
  };
  // pl may be capped at 999000 like maxbr, so an explicit plLevel also proves hi-res is playable.
  const ok = (q: Quality) => canPlay >= RATE[q] || p.plLevel === q;
  return Object.fromEntries(
    QUALITIES.map(({ level }) => [level, !has(level) ? "none" : ok(level) ? "ok" : "vip"]),
  ) as Privilege;
}

// Per song id for the session. A promise, so opening the menu twice mid-flight shares one request.
const cache = new Map<number, Promise<Privilege | null>>();

// null on any failure or a missing record; the menu then shows only its static markers.
export function privilege(id: number): Promise<Privilege | null> {
  let hit = cache.get(id);
  if (!hit) {
    hit = eapi("/api/v3/song/detail", { c: JSON.stringify([{ id }]) })
      .then((r): Privilege | null => {
        const p = r.privileges?.find((x: any) => x.id === id);
        return p ? toPrivilege(p) : null;
      })
      .catch(() => {
        cache.delete(id); // a failure is not worth remembering
        return null;
      });
    cache.set(id, hit);
  }
  return hit;
}
