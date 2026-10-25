// The desktop lyrics window, as a bar or (#island) as an island at the top of the screen. It holds no player:
// the main window sends the song and the clock (see desktopLyrics.ts), and the buttons here go back as the
// same "control" events the tray sends.
import "@music-lite/ui/globals.css";
import { Button } from "@music-lite/ui/components/ui/button";
import {
  ArrowLineDownIcon,
  ArrowLineUpIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  XIcon,
} from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { cursorPosition, getCurrentWindow } from "@tauri-apps/api/window";
import { type RefObject, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { LyricLine } from "./api";
import type { Clock, Song } from "./desktopLyrics";
import { lineAt } from "./format";

const control = (action: string) => () => emit("control", action);

// The song and the clock from the main window. The clock is a ref: it is read every frame, not rendered.
function useFeed() {
  const [song, setSong] = useState<Song>(null);
  const [playing, setPlaying] = useState(false);
  const clock = useRef<Clock>({ ms: 0, at: 0, playing: false });
  useEffect(() => {
    const off = [
      listen<Song>("desktop-lyrics:song", (e) => setSong(e.payload)),
      listen<Clock>("desktop-lyrics:clock", (e) => {
        clock.current = e.payload;
        setPlaying(e.payload.playing);
      }),
    ];
    emit("desktop-lyrics:ready");
    return () => off.forEach((p) => p.then((f) => f()));
  }, []);
  useEffect(() => {
    if (song) document.documentElement.dataset.brand = song.brand;
  }, [song?.brand]);
  return { song, playing, clock };
}

// Each frame: run the clock forward from the last report, find the line, and fill the words of every
// word-timed line under root. React re-renders only when the line changes.
function useActiveLine(song: Song, clock: RefObject<Clock>, root: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(-1);
  useEffect(() => {
    const lines = song?.lines;
    if (!lines?.length) return setActive(-1);
    let frame = 0;
    let last = -2;
    const tick = () => {
      const c = clock.current;
      const ms = c.playing ? c.ms + Date.now() - c.at : c.ms;
      const i = lineAt(lines, ms);
      if (i !== last) setActive((last = i));
      const words = lines[i]?.words;
      if (words) {
        root.current?.querySelectorAll(".karaoke").forEach((k) =>
          [...k.children].forEach((el, n) => {
            const p = Math.min(1, Math.max(0, (ms - words[n].ms) / words[n].durationMs));
            (el as HTMLElement).style.setProperty("--p", `${p * 100}%`);
          }),
        );
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [song?.lines]);
  return active;
}

// The line being sung. Word-timed lines fill in the brand color as they are sung; others are colored whole.
function Sung({ line, at, fallback }: { line?: LyricLine; at: number; fallback: string }) {
  if (!line) return <span>{fallback}</span>;
  if (!line.words) return <span className="text-primary">{line.text}</span>;
  return (
    <span className="karaoke" key={at}>
      {line.words.map((w, k) => (
        <span key={k} className="bg-[linear-gradient(90deg,var(--brand)_var(--p,0%),#fff_var(--p,0%))] bg-clip-text text-transparent">
          {w.text}
        </span>
      ))}
    </span>
  );
}

// Under the line: its translation, or else the next line. Before the first line, the artist.
const subLine = (song: Song, active: number) => {
  const line = song?.lines[active];
  return line ? line.trans || song?.lines[active + 1]?.text : song?.artist;
};

function Transport({ playing }: { playing: boolean }) {
  return (
    <>
      <Button variant="ghost" size="icon-sm" className="text-white" aria-label="上一首" onClick={control("prev")}>
        <SkipBackIcon weight="fill" />
      </Button>
      <Button variant="ghost" size="icon-sm" className="text-white" aria-label={playing ? "暂停" : "播放"} onClick={control("toggle")}>
        {playing ? <PauseIcon weight="fill" /> : <PlayIcon weight="fill" />}
      </Button>
      <Button variant="ghost" size="icon-sm" className="text-white" aria-label="下一首" onClick={control("next")}>
        <SkipForwardIcon weight="fill" />
      </Button>
    </>
  );
}

const CloseButton = () => (
  <Button variant="ghost" size="icon-sm" className="text-white" aria-label="关闭桌面歌词" title="关闭桌面歌词" onClick={control("desktopLyrics")}>
    <XIcon />
  </Button>
);

function Bar() {
  const { song, playing, clock } = useFeed();
  const lineRef = useRef<HTMLDivElement>(null);
  const active = useActiveLine(song, clock, lineRef);

  // The window moves by dragging anywhere but the buttons.
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest("button")) getCurrentWindow().startDragging();
  };

  const sub = subLine(song, active);

  return (
    <div
      className="group relative flex h-screen cursor-default select-none flex-col items-center justify-center gap-[3vh] rounded-2xl px-6 text-center transition-colors duration-150 hover:bg-black/45"
      onMouseDown={onMouseDown}
    >
      <div className="absolute top-2 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <Button variant="ghost" size="icon-sm" className="text-white" aria-label="切换为灵动岛" title="切换为灵动岛" onClick={control("lyricsIsland")}>
          <ArrowLineUpIcon />
        </Button>
        <Transport playing={playing} />
        <CloseButton />
      </div>
      {/* A drop shadow, not a text shadow: a text shadow would paint over the word fill. */}
      <div className="grid w-full gap-[2vh] drop-shadow-[0_1px_3px_rgb(0_0_0/0.7)]" ref={lineRef}>
        <p className="truncate text-[clamp(18px,24vh,48px)] font-semibold leading-tight text-white">
          <Sung line={song?.lines[active]} at={active} fallback={song?.title ?? "Music Lite"} />
        </p>
        {sub && <p className="truncate text-[clamp(13px,13vh,26px)] font-medium leading-tight text-white/75">{sub}</p>}
      </div>
    </div>
  );
}

// Bars that bob while playing and rest low while paused.
function Beat({ playing }: { playing: boolean }) {
  return (
    <span className="flex h-3.5 items-center gap-[2px]" aria-hidden>
      {[0.9, 0.6, 1, 0.7].map((d, i) => (
        <span
          key={i}
          className="h-full w-[3px] origin-center rounded-full bg-primary transition-transform duration-300"
          style={playing ? { animation: `eq ${d}s ease-in-out ${-i * 0.23}s infinite` } : { transform: "scaleY(0.3)" }}
        />
      ))}
    </span>
  );
}

// The island window is fixed at this size, in points, and placed at the top middle of the screen by Rust.
// The island inside grows to the expanded size; the rest of the window is see-through and lets clicks pass.
const WINDOW = { width: 500, height: 260 };
const COMPACT_WIDTH = 320;
const EXPANDED_WIDTH = 460;
// A pause before folding, so brushing past the edge does not snap it shut.
const LEAVE_MS = 200;

type Notch = { width: number; height: number };

// The window cannot see the mouse while it lets clicks through, so it asks where the cursor is instead. Over
// the island it takes clicks and opens; elsewhere it passes them on and folds.
function useHover(target: RefObject<HTMLElement | null>, placed: boolean) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!placed) return;
    const win = getCurrentWindow();
    let origin: { x: number; y: number; scale: number } | null = null;
    let inside = false;
    let leftAt = 0;
    let busy = false;
    Promise.all([win.outerPosition(), win.scaleFactor()]).then(([p, scale]) => (origin = { x: p.x, y: p.y, scale }));
    win.setIgnoreCursorEvents(true);
    const id = setInterval(async () => {
      const el = target.current;
      if (!origin || !el || busy) return;
      busy = true;
      const c = await cursorPosition().finally(() => (busy = false));
      const x = (c.x - origin.x) / origin.scale;
      const y = (c.y - origin.y) / origin.scale;
      const r = el.getBoundingClientRect();
      const over = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      if (over) leftAt = 0;
      else if (inside && !leftAt) leftAt = Date.now();
      const next = over || (inside && Date.now() - leftAt < LEAVE_MS);
      if (next === inside) return;
      inside = next;
      win.setIgnoreCursorEvents(!inside);
      setOpen(inside);
    }, 50);
    return () => clearInterval(id);
  }, [placed]);
  return open;
}

function Island() {
  const { song, playing, clock } = useFeed();
  const [notch, setNotch] = useState<Notch | null>(null);
  const islandRef = useRef<HTMLDivElement>(null);
  const active = useActiveLine(song, clock, islandRef);
  const open = useHover(islandRef, !!notch);

  useEffect(() => {
    invoke<Notch>("island_place", WINDOW).then((n) => {
      setNotch(n);
      getCurrentWindow().show();
    });
  }, []);

  if (!notch) return null;
  const nh = notch.height;
  // With a notch, the compact island wraps it: cover and beat in the menu bar row, the line just below.
  // Without one it is a single row at the top edge of the screen.
  const compactHeight = nh ? nh + 30 : 36;
  const top = nh ? nh + 10 : 12;
  const expandedHeight = top + 166;
  const line = song?.lines[active];
  const title = song?.title ?? "Music Lite";
  const sub = subLine(song, active);

  return (
    <div
      ref={islandRef}
      data-open={open || undefined}
      className="group absolute top-0 left-1/2 -translate-x-1/2 cursor-default select-none overflow-hidden rounded-b-[18px] bg-black text-white transition-[width,height,border-radius,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] data-open:rounded-b-[28px] data-open:shadow-[0_12px_40px_rgb(0_0_0/0.45)] motion-reduce:duration-0"
      style={open ? { width: EXPANDED_WIDTH, height: expandedHeight } : { width: COMPACT_WIDTH, height: compactHeight }}
    >
      {/* Compact. Each layer keeps its own size while the island grows, so nothing reflows mid-motion. */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 transition-[opacity,scale,filter] delay-150 duration-300 group-data-open:scale-95 group-data-open:opacity-0 group-data-open:blur-sm group-data-open:delay-0 group-data-open:duration-150"
        style={{ width: COMPACT_WIDTH, height: compactHeight }}
        aria-hidden={open}
      >
        {nh ? (
          <>
            <div className="flex items-center justify-between px-3.5" style={{ height: nh }}>
              {song ? <img src={song.cover} alt="" className="size-5 rounded-[5px]" /> : <span />}
              <Beat playing={playing} />
            </div>
            <p className="truncate px-4 text-center text-[13px] leading-[22px] font-medium">
              <Sung line={line} at={active} fallback={title} />
            </p>
          </>
        ) : (
          <div className="flex h-full items-center gap-2.5 px-3">
            {song && <img src={song.cover} alt="" className="size-5 shrink-0 rounded-[5px]" />}
            <p className="min-w-0 flex-1 truncate text-center text-[13px] font-medium">
              <Sung line={line} at={active} fallback={title} />
            </p>
            <Beat playing={playing} />
          </div>
        )}
      </div>

      {/* Expanded: the song, the line and its translation, the controls. */}
      <div
        className="absolute left-1/2 flex -translate-x-1/2 scale-95 flex-col gap-3 px-5 pb-4 opacity-0 blur-sm transition-[opacity,scale,filter] duration-150 group-data-open:scale-100 group-data-open:opacity-100 group-data-open:blur-none group-data-open:delay-100 group-data-open:duration-300"
        style={{ width: EXPANDED_WIDTH, top }}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="flex items-center gap-3">
          {song && <img src={song.cover} alt="" className="size-11 shrink-0 rounded-lg" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{title}</p>
            <p className="truncate text-xs text-white/60">{song?.artist}</p>
          </div>
          <Beat playing={playing} />
        </div>
        <div className="grid gap-1 text-center">
          <p className="truncate text-xl leading-7 font-semibold">
            <Sung line={line} at={active} fallback={title} />
          </p>
          <p className="h-[18px] truncate text-[13px] leading-[18px] text-white/60">{line ? sub : ""}</p>
        </div>
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon-sm" className="text-white" aria-label="切换为歌词条" title="切换为歌词条" onClick={control("lyricsBar")}>
            <ArrowLineDownIcon />
          </Button>
          <div className="flex gap-1">
            <Transport playing={playing} />
          </div>
          <CloseButton />
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(location.hash === "#island" ? <Island /> : <Bar />);
