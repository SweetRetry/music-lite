import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@ncm-lite/ui/components/ui/skeleton";
import { lyric, type LyricLine } from "../api";
import { peek, put } from "../cache";
import { Notice } from "../components/states";
import { artistNames, cover } from "../format";
import { player, usePlayer } from "../player";

// Lyrics never change once published, so a cached copy is final and is never refetched.
const cacheKey = (id: number) => `lyric:${id}`;

// The view eases to the new line with this time constant, settling in about half a second.
const FOLLOW_MS = 150;
// After the reader scrolls, leave the view alone this long.
const PAUSE_MS = 3000;

// The offset that puts a line's middle at the middle of the view.
const centered = (el: HTMLElement, view: HTMLElement) => el.offsetTop + el.offsetHeight / 2 - view.clientHeight / 2;

const SKELETON_WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-2/5", "w-3/5", "w-4/5", "w-1/2"];

export function LyricsView() {
  const { queue, index } = usePlayer();
  const track = queue[index];
  const [lines, setLines] = useState<LyricLine[] | null>(() => (track && peek<LyricLine[]>(cacheKey(track.id))) || null);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState("");
  const viewRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // How far the content is moved up, in float pixels. Shared by the follow and the wheel.
  const offset = useRef(0);
  const userScrolledAt = useRef(0);

  useEffect(() => {
    if (!track) return;
    setError("");
    const cached = peek<LyricLine[]>(cacheKey(track.id));
    if (cached) return setLines(cached);
    setLines(null);
    let live = true;
    lyric(track.id).then(
      (l) => {
        if (l.length) put(cacheKey(track.id), l);
        if (live) setLines(l);
      },
      (e) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [track?.id]);

  // Each frame: find the current line, fill word-timed lines by their own clock, and glide the view.
  // Word progress is written to CSS directly so React re-renders only when the line changes.
  // The view moves by transform, not scrollTop: scrollTop snaps to whole pixels, which judders on a slow glide.
  useEffect(() => {
    const view = viewRef.current;
    const content = contentRef.current;
    if (!lines || !view || !content) return;
    const els = content.querySelectorAll<HTMLElement>("[data-line]");
    let frame = 0;
    let last = -2;
    let prev = performance.now();
    let placed = false;
    const tick = (now: number) => {
      const dt = Math.min(now - prev, 100);
      prev = now;
      const ms = player.time() * 1000;
      let i = -1;
      while (i + 1 < lines.length && lines[i + 1].ms <= ms) i++;
      if (i !== last) setActive((last = i));
      const words = lines[i]?.words;
      if (words) {
        els[i]?.querySelectorAll<HTMLElement>(".karaoke > span").forEach((el, k) => {
          const p = Math.min(1, Math.max(0, (ms - words[k].ms) / words[k].durationMs));
          el.style.setProperty("--p", `${p * 100}%`);
        });
      }
      // The view rests on the current line and moves only when the line changes. Before the first line, line 0.
      if (els.length && Date.now() - userScrolledAt.current >= PAUSE_MS) {
        const target = centered(els[Math.max(i, 0)], view);
        // The first placement snaps; after that line changes and seeks glide.
        offset.current = placed ? offset.current + (target - offset.current) * (1 - Math.exp(-dt / FOLLOW_MS)) : target;
        placed = true;
        content.style.transform = `translateY(${-offset.current}px)`;
      }
      frame = requestAnimationFrame(tick);
    };
    tick(prev);
    return () => cancelAnimationFrame(frame);
  }, [lines]);

  // The wheel moves the same offset the follow uses, kept between the first and the last line.
  const onWheel = (e: React.WheelEvent) => {
    const view = viewRef.current;
    const content = contentRef.current;
    const els = content?.querySelectorAll<HTMLElement>("[data-line]");
    if (!view || !content || !els?.length) return;
    userScrolledAt.current = Date.now();
    const top = centered(els[0], view);
    const bottom = centered(els[els.length - 1], view);
    offset.current = Math.min(Math.max(offset.current + e.deltaY, top), bottom);
    content.style.transform = `translateY(${-offset.current}px)`;
  };

  if (!track) return <main className="main"><p className="state muted">还没有在播放的歌</p></main>;

  return (
    <main className="lyrics">
      <aside className="lyrics__meta">
        <img src={cover(track.cover, 240)} alt="" />
        <h1>{track.name}</h1>
        <p className="muted">{artistNames(track)}</p>
        <p className="muted">{track.album.name}</p>
      </aside>
      <div className="lyrics__scroll" ref={viewRef} onWheel={onWheel}>
        {/* relative makes this the offsetParent, so line offsetTop is measured from the moving content. */}
        <div className="relative will-change-transform" ref={contentRef}>
        {error && <Notice message={`歌词没加载出来。${error}`} />}
        {!error && !lines && (
          <div className="grid gap-4 px-3" aria-hidden>
            {SKELETON_WIDTHS.map((w, i) => (
              <Skeleton key={i} className={`h-7 ${w}`} />
            ))}
          </div>
        )}
        {lines?.length === 0 && <p className="lyrics__empty muted">这首歌没有歌词</p>}
        {lines?.map((l, i) => (
          <button
            key={i}
            data-line={i}
            // Scale, not weight, marks the current line: weight would reflow and move the scroll target.
            className="lyrics__line origin-left scale-[0.96] aria-[current=true]:scale-100"
            aria-current={i === active}
            onClick={() => {
              userScrolledAt.current = 0;
              player.seek(l.ms / 1000);
            }}
          >
            {l.words ? (
              <span className="karaoke">
                {l.words.map((w, k) => (
                  <span key={k}>{w.text}</span>
                ))}
              </span>
            ) : (
              <span>{l.text}</span>
            )}
            {l.trans && <span className="lyrics__trans">{l.trans}</span>}
          </button>
        ))}
        </div>
      </div>
    </main>
  );
}
