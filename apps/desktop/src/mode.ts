// Which music service the app is showing. A mode picks the provider behind the library, the player's
// lookups and the brand colors. Remembered across launches. index.html reads the same key before first
// paint, so keep KEY in sync with it.
import { create } from "zustand";

export type ProviderId = "ncm" | "qq";

export const PROVIDER_IDS: readonly ProviderId[] = ["ncm", "qq"];

const KEY = "mode";

export const isProviderId = (v: unknown): v is ProviderId => PROVIDER_IDS.some((id) => id === v);

function load(): ProviderId {
  try {
    const v = localStorage.getItem(KEY);
    return isProviderId(v) ? v : "ncm";
  } catch {
    return "ncm";
  }
}

export const useMode = create<{ mode: ProviderId }>(() => ({ mode: load() }));

useMode.subscribe((s, prev) => {
  if (s.mode === prev.mode) return;
  try {
    localStorage.setItem(KEY, s.mode);
  } catch {}
});

// Cached entries of NetEase keep their original keys, so a cache from before modes still counts.
export const scoped = (key: string, mode: ProviderId = useMode.getState().mode) => (mode === "ncm" ? key : `${mode}:${key}`);

// Whether a cache key belongs to the mode, for clearing one service's entries and leaving the other's.
export const inMode = (mode: ProviderId) => (key: string) => (key.startsWith("qq:") ? mode === "qq" : mode === "ncm");
