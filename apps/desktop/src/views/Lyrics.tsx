import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@ncm-lite/ui/components/ui/skeleton";
import { lyric, type LyricLine } from "../api";
import { peek, put } from "../cache";
import { Notice } from "../components/states";
import { artistNames, cover } from "../format";
import { player, usePlayer } from "../player";

// Lyrics never change once published, so a cached copy is final and is never refetched.
const cacheKey = (id: number) => `lyric:${id}`;

// Reading position eases toward its target with this time constant (about 0.15 of the gap per 60fps frame).
const FOLLOW_MS = 100;
// After the reader scrolls, leave the view alone this long.
const PAUSE_MS = 3000;

const SKELETON_WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-2/5", "w-3/5", "w-4/5", "w-1/2"];

export function LyricsView() {
  const { queue, index } = usePlayer();
  const track = queue[index];
  const [lines, setLines] = useState<LyricLine[] | null>(() => (track && peek<LyricLine[]>(cacheKey(track.id))) || null);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => {
    const box = scrollRef.current;
    if (!lines || !box) return;
    const els = box.querySelectorAll<HTMLElement>("[data-line]");
    const center = (el: HTMLElement) => el.offsetTop + el.offsetHeight / 2;
    let frame = 0;
    let last = -2;
    let prev = performance.now();
    // Our own float position: scrollTop reads back rounded, which would stall slow drifts.
    let pos = 0;
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

      if (els.length) {
        if (Date.now() - userScrolledAt.current < PAUSE_MS) {
          pos = box.scrollTop;
        } else {
          // Slide from this line's center to the next one's as the line is sung, so the view moves continuously.
          const from = center(els[Math.max(i, 0)]);
          const next = els[i + 1];
          const span = next ? lines[i + 1].ms - lines[i].ms : 0;
          const t = i >= 0 && span > 0 ? Math.min(1, (ms - lines[i].ms) / span) : 0;
          const goal = from + (next && i >= 0 ? (center(next) - from) * t : 0) - box.clientHeight / 2;
          const target = Math.min(Math.max(goal, 0), box.scrollHeight - box.clientHeight);
          // The first placement snaps; after that seeks and line changes glide.
          pos = placed ? pos + (target - pos) * (1 - Math.exp(-dt / FOLLOW_MS)) : target;
          placed = true;
          box.scrollTop = pos;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    tick(prev);
    return () => cancelAnimationFrame(frame);
  }, [lines]);

  const pause = () => (userScrolledAt.current = Date.now());

  if (!track) return <main className="main"><p className="state muted">还没有在播放的歌</p></main>;

  return (
    <main className="lyrics">
      <aside className="lyrics__meta">
        <img src={cover(track.cover, 240)} alt="" />
        <h1>{track.name}</h1>
        <p className="muted">{artistNames(track)}</p>
        <p className="muted">{track.album.name}</p>
      </aside>
      <div
        // relative makes this the offsetParent, so line offsetTop is measured from the scroll content.
        className="lyrics__scroll relative"
        ref={scrollRef}
        onWheel={pause}
        onPointerDown={pause}
        onKeyDown={pause}
      >
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
    </main>
  );
}
