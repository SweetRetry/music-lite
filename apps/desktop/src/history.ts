// Recent search keywords, newest first, kept across launches. They belong to the person, not to a
// service, so switching between NetEase and QQ Music keeps them.
import { create } from "zustand";

const KEY = "searchHistory";
const LIMIT = 10;

const load = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
};

export const useHistory = create<{
  keywords: string[];
  remember: (keyword: string) => void;
  forget: (keyword: string) => void;
  clear: () => void;
}>((set) => ({
  keywords: load(),
  remember: (keyword) => set((s) => ({ keywords: [keyword, ...s.keywords.filter((k) => k !== keyword)].slice(0, LIMIT) })),
  forget: (keyword) => set((s) => ({ keywords: s.keywords.filter((k) => k !== keyword) })),
  clear: () => set({ keywords: [] }),
}));

useHistory.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s.keywords));
  } catch {}
});
