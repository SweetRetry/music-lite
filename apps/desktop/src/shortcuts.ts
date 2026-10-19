// The keymap. Every shortcut lives in this table, and the cheatsheet, the tooltips and the README
// are generated from it. One window keydown listener runs it.
//
// A chord is written "Mod+Shift+L". Mod is Command. How a chord matches depends on its key:
// - Letters, digits, brackets and Space match the physical key (e.code), so they work on Cyrillic,
//   AZERTY, German and other layouts, and under an input method.
// - "/" and "?" match the typed character (e.key) and ignore Shift, because those need Shift on some layouts.
// - Arrows and Escape match e.key.
import { useEffect } from "react";
import { openPlaylistDialog } from "./components/playlist/dialogs";
import { focusSearch } from "./components/SearchBox";
import { library } from "./library";
import { player, usePlayer } from "./player";
import { router } from "./router";
import { useUi } from "./ui";

export const GROUPS = ["播放", "全局", "导航", "视图", "列表", "帮助"] as const;
type Group = (typeof GROUPS)[number];

export type Shortcut = {
  // Alternatives for the same action, the first one is the one tooltips show.
  keys: string[];
  label: string;
  group: Group;
  run: (e: KeyboardEvent) => void;
  // The shortcut only fires, and only swallows the key, while this holds.
  when?: (e: KeyboardEvent) => boolean;
  // Also fires while typing in a text field. The rest stay out of the way of editing.
  inputs?: boolean;
  // Fires again while the key is held.
  repeat?: boolean;
};

const TEXT_INPUTS = new Set(["text", "search", "email", "url", "password", "number", "tel"]);
export const isTyping = (el: unknown) =>
  el instanceof HTMLElement &&
  (el.isContentEditable ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement && TEXT_INPUTS.has(el.type)));

// Space belongs to the control when the keyboard put focus on it. A button clicked with the mouse
// keeps focus too, but there Space should still play and pause.
const ACTIVATES_ON_SPACE = "button, a[href], [role=button], [role=menuitem], [role=checkbox], [role=switch], [role=radio]";
const spaceActivates = (el: EventTarget | null) =>
  el instanceof Element && !!el.closest(ACTIVATES_ON_SPACE) && el.matches(":focus-visible");

const trackRows = (el: EventTarget | null) => {
  const row = el instanceof Element ? el.closest<HTMLElement>("tbody > tr[tabindex]") : null;
  const rows = row ? [...(row.closest("tbody")?.querySelectorAll<HTMLElement>("tr[tabindex]") ?? [])] : [];
  return { rows, at: row ? rows.indexOf(row) : -1 };
};
const moveRow = (e: KeyboardEvent, by: number) => {
  const { rows, at } = trackRows(e.target);
  rows[at + by]?.focus();
};

const hasTrack = () => !!usePlayer.getState().queue[usePlayer.getState().index];
const ui = () => useUi.getState();

// The key is the shortcut's id, for looking one up with shortcutKeys().
export const shortcuts = {
  playPause: {
    keys: ["Space"],
    label: "播放 / 暂停",
    group: "播放",
    run: player.toggle,
    when: (e) => !spaceActivates(e.target),
  },
  next: { keys: ["Mod+ArrowRight"], label: "下一首", group: "播放", run: player.next },
  prev: { keys: ["Mod+ArrowLeft"], label: "上一首", group: "播放", run: player.prev },
  volumeUp: { keys: ["Mod+ArrowUp"], label: "音量加大", group: "播放", run: () => player.adjustVolume(0.1), repeat: true },
  volumeDown: { keys: ["Mod+ArrowDown"], label: "音量减小", group: "播放", run: () => player.adjustVolume(-0.1), repeat: true },
  seekForward: { keys: ["Mod+Shift+ArrowRight"], label: "快进 5 秒", group: "播放", run: () => player.seekBy(5), repeat: true },
  seekBack: { keys: ["Mod+Shift+ArrowLeft"], label: "快退 5 秒", group: "播放", run: () => player.seekBy(-5), repeat: true },
  like: {
    keys: ["Mod+L"],
    label: "喜欢 / 取消喜欢当前歌曲",
    group: "播放",
    run: () => {
      const { queue, index } = usePlayer.getState();
      library.toggleLike(queue[index].id);
    },
    when: hasTrack,
    inputs: true,
  },

  // Registered system-wide in src-tauri/src/shortcuts.rs, so they work while the window is hidden.
  // These entries only document them; the keydown listener never sees Option chords.
  globalToggle: { keys: ["Mod+Alt+P"], label: "播放 / 暂停", group: "全局", run: () => {}, when: () => false },
  globalPrev: { keys: ["Mod+Alt+ArrowLeft"], label: "上一首", group: "全局", run: () => {}, when: () => false },
  globalNext: { keys: ["Mod+Alt+ArrowRight"], label: "下一首", group: "全局", run: () => {}, when: () => false },
  globalVolumeUp: { keys: ["Mod+Alt+ArrowUp"], label: "音量加大", group: "全局", run: () => {}, when: () => false },
  globalVolumeDown: { keys: ["Mod+Alt+ArrowDown"], label: "音量减小", group: "全局", run: () => {}, when: () => false },
  globalLike: { keys: ["Mod+Alt+L"], label: "喜欢 / 取消喜欢当前歌曲", group: "全局", run: () => {}, when: () => false },

  search: {
    keys: ["Mod+F", "/"],
    label: "搜索",
    group: "导航",
    run: focusSearch,
    // Slash is a letter to type while typing; Cmd+F is not.
    when: (e) => e.key !== "/" || !isTyping(e.target),
    inputs: true,
  },
  back: { keys: ["Mod+["], label: "后退", group: "导航", run: () => router.history.back(), inputs: true },
  forward: { keys: ["Mod+]"], label: "前进", group: "导航", run: () => router.history.forward(), inputs: true },
  daily: { keys: ["Mod+1"], label: "每日推荐", group: "导航", run: () => router.navigate({ to: "/" }), inputs: true },
  liked: { keys: ["Mod+2"], label: "我喜欢的音乐", group: "导航", run: () => router.navigate({ to: "/liked" }), inputs: true },

  lyrics: {
    keys: ["Mod+Shift+L"],
    label: "展开 / 收起歌词",
    group: "视图",
    run: () => ui().toggleLyrics(),
    when: () => ui().lyricsOpen || hasTrack(),
    inputs: true,
  },
  // Escape backs out one layer: leave the text field first, then close the lyrics.
  escape: {
    keys: ["Escape"],
    label: "退出输入框，收起歌词",
    group: "视图",
    run: (e) => (isTyping(e.target) ? (e.target as HTMLElement).blur() : ui().toggleLyrics(false)),
    // An open queue panel closes on Escape by itself, and the lyrics stay.
    when: (e) => isTyping(e.target) || (ui().lyricsOpen && !ui().queueOpen),
    inputs: true,
  },
  queue: { keys: ["Mod+Shift+Q"], label: "打开 / 关闭播放队列", group: "视图", run: () => ui().toggleQueue(), inputs: true },
  newPlaylist: {
    keys: ["Mod+N"],
    label: "新建歌单",
    group: "视图",
    run: () => openPlaylistDialog({ kind: "create" }),
    inputs: true,
  },

  rowUp: {
    keys: ["ArrowUp"],
    label: "上一行",
    group: "列表",
    run: (e) => moveRow(e, -1),
    when: (e) => trackRows(e.target).at >= 0,
    repeat: true,
  },
  rowDown: {
    keys: ["ArrowDown"],
    label: "下一行",
    group: "列表",
    run: (e) => moveRow(e, 1),
    when: (e) => trackRows(e.target).at >= 0,
    repeat: true,
  },
  playRow: {
    keys: ["Enter"],
    label: "播放选中的歌曲",
    group: "列表",
    // TrackTable handles Enter on its rows. This entry only documents it.
    run: () => {},
    when: () => false,
  },

  help: { keys: ["?"], label: "快捷键", group: "帮助", run: () => ui().toggleShortcuts(true) },
} satisfies Record<string, Shortcut>;

export type ShortcutId = keyof typeof shortcuts;

// Parsing

type Matcher = { char?: string; code?: string; key?: string; mod: boolean; shift: boolean };

const CODES: Record<string, string> = { "[": "BracketLeft", "]": "BracketRight", Space: "Space" };

function parse(chord: string): Matcher {
  const parts = chord.split("+");
  const key = parts.at(-1)!;
  const mod = parts.includes("Mod");
  const shift = parts.includes("Shift");
  if (key === "/" || key === "?") return { char: key, mod, shift };
  if (/^[A-Z]$/.test(key)) return { code: `Key${key}`, mod, shift };
  if (/^[0-9]$/.test(key)) return { code: `Digit${key}`, mod, shift };
  if (CODES[key]) return { code: CODES[key], mod, shift };
  return { key, mod, shift };
}

function matches(m: Matcher, e: KeyboardEvent) {
  if (e.ctrlKey || e.altKey) return false;
  if (m.char) return !e.metaKey && e.key === m.char;
  return e.metaKey === m.mod && e.shiftKey === m.shift && (m.code ? e.code === m.code : e.key === m.key);
}

const compiled = Object.values(shortcuts as Record<ShortcutId, Shortcut>).map((s) => ({
  s,
  matchers: s.keys.map(parse),
}));

// Display

const GLYPHS: Record<string, string> = {
  Mod: "⌘",
  Shift: "⇧",
  Alt: "⌥",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Escape: "Esc",
  Space: "空格",
};

// "Mod+Shift+L" as the caps to draw: ["⌘", "⇧", "L"].
export const caps = (chord: string) => chord.split("+").map((k) => GLYPHS[k] ?? k);

// The first chord of a shortcut, for tooltips.
export const primaryChord = (id: ShortcutId) => (shortcuts[id] as Shortcut).keys[0];

export const grouped = GROUPS.map((group) => ({
  group,
  items: compiled.map((c) => c.s).filter((s) => s.group === group),
}));

// Dispatch

// Keys go to the dialog or menu while one is open, not to the app behind it.
const MODAL = "[data-slot=dialog-content], [data-slot=alert-dialog-content], [data-slot=sheet-content], [role=menu]";

function onKeyDown(e: KeyboardEvent) {
  // isComposing is an input method choosing a candidate. Escape and Enter belong to it.
  if (e.defaultPrevented || e.isComposing) return;
  if (e.target instanceof Element && e.target.closest(MODAL)) return;
  const typing = isTyping(e.target);
  for (const { s, matchers } of compiled) {
    if (typing && !s.inputs) continue;
    if (e.repeat && !s.repeat) continue;
    if (!matchers.some((m) => matches(m, e))) continue;
    if (s.when && !s.when(e)) continue;
    e.preventDefault();
    s.run(e);
    return;
  }
}

export function useShortcuts() {
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
