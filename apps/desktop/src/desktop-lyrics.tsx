// The desktop lyrics window. It holds no player: the main window sends the song and the clock (see
// desktopLyrics.ts), and the buttons here go back as the same "control" events the tray sends.
import "@music-lite/ui/globals.css";
import { Button } from "@music-lite/ui/components/ui/button";
import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon, XIcon } from "@phosphor-icons/react";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Clock, Song } from "./desktopLyrics";
import { lineAt } from "./format";

const control = (action: string) => () => emit("control", action);

function DesktopLyrics() {
  const [song, setSong] = useState<Song>(null);
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState(-1);
  const clock = useRef<Clock>({ ms: 0, at: 0, playing: false });
  const lineRef = useRef<HTMLDivElement>(null);

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

  // Each frame: run the clock forward from the last report, find the line, fill its words.
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
        lineRef.current?.querySelectorAll<HTMLElement>(".karaoke > span").forEach((el, k) => {
          const p = Math.min(1, Math.max(0, (ms - words[k].ms) / words[k].durationMs));
          el.style.setProperty("--p", `${p * 100}%`);
        });
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [song?.lines]);

  // The window moves by dragging anywhere but the buttons.
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest("button")) getCurrentWindow().startDragging();
  };

  const line = song?.lines[active];
  // Under the line: its translation, or else the next line, dimmed.
  const sub = line ? line.trans || song?.lines[active + 1]?.text : song?.artist;

  return (
    <div
      className="group relative flex h-screen cursor-default select-none flex-col items-center justify-center gap-[3vh] rounded-2xl px-6 text-center transition-colors duration-150 hover:bg-black/45"
      onMouseDown={onMouseDown}
    >
      <div className="absolute top-2 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <Button variant="ghost" size="icon-sm" className="text-white" aria-label="上一首" onClick={control("prev")}>
          <SkipBackIcon weight="fill" />
        </Button>
        <Button variant="ghost" size="icon-sm" className="text-white" aria-label={playing ? "暂停" : "播放"} onClick={control("toggle")}>
          {playing ? <PauseIcon weight="fill" /> : <PlayIcon weight="fill" />}
        </Button>
        <Button variant="ghost" size="icon-sm" className="text-white" aria-label="下一首" onClick={control("next")}>
          <SkipForwardIcon weight="fill" />
        </Button>
        <Button variant="ghost" size="icon-sm" className="text-white" aria-label="关闭桌面歌词" onClick={control("desktopLyrics")}>
          <XIcon />
        </Button>
      </div>
      {/* A drop shadow, not a text shadow: a text shadow would paint over the word fill. */}
      <div className="grid w-full gap-[2vh] drop-shadow-[0_1px_3px_rgb(0_0_0/0.7)]" ref={lineRef}>
        <p className="truncate text-[clamp(18px,24vh,48px)] font-semibold leading-tight text-white">
          {line?.words ? (
            <span className="karaoke" key={active}>
              {line.words.map((w, k) => (
                <span
                  key={k}
                  className="bg-[linear-gradient(90deg,var(--brand)_var(--p,0%),#fff_var(--p,0%))] bg-clip-text text-transparent"
                >
                  {w.text}
                </span>
              ))}
            </span>
          ) : (
            <span className={line ? "text-primary" : undefined}>{line?.text ?? song?.title ?? "Music Lite"}</span>
          )}
        </p>
        {sub && <p className="truncate text-[clamp(13px,13vh,26px)] font-medium leading-tight text-white/75">{sub}</p>}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<DesktopLyrics />);
