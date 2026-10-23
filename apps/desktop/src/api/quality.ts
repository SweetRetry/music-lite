// Sound quality levels as the official client names them in `level` of /api/song/enhance/player/url/v1.
export const QUALITIES = [
  { level: "standard", label: "标准" },
  { level: "higher", label: "较高" },
  { level: "exhigh", label: "极高" },
  { level: "lossless", label: "无损" },
  { level: "hires", label: "Hi-Res" },
] as const;

export type Quality = (typeof QUALITIES)[number]["level"];
export type QualityOption = { level: Quality; label: string };

export const DEFAULT_QUALITY: Quality = "exhigh";

export const isQuality = (v: unknown): v is Quality => QUALITIES.some((q) => q.level === v);

// Position in QUALITIES, or -1 for levels the menu does not offer (jymaster, sky, ...).
export const rank = (level: string) => QUALITIES.findIndex((q) => q.level === level);

// A shared preference can name a tier the other service does not offer.
export const qualityFor = (quality: Quality, options: readonly QualityOption[]): Quality =>
  options.findLast((q) => rank(q.level) <= rank(quality))?.level ?? "standard";

export const qualityLabel = (level: string) => QUALITIES.find((q) => q.level === level)?.label ?? level;

// The server answers with a level and a bitrate in bits per second. Fall back to br if level is missing.
const BY_BITRATE: [number, string][] = [
  [1999000, "hires"],
  [999000, "lossless"],
  [320000, "exhigh"],
  [192000, "higher"],
  [0, "standard"],
];
export const levelOf = (level: unknown, br: number) =>
  typeof level === "string" && level ? level : (BY_BITRATE.find(([min]) => br >= min)?.[1] ?? "standard");

// Bitrate (bits per second) the server lists for each level in a privilege's chargeInfoList.
export const RATE: Record<Quality, number> = {
  standard: 128000,
  higher: 192000,
  exhigh: 320000,
  lossless: 999000,
  hires: 1999000,
};

// Levels that need 黑胶VIP even for a free song. Shown before any song is loaded.
export const VIP_LEVELS: ReadonlySet<string> = new Set<Quality>(["lossless", "hires"]);
