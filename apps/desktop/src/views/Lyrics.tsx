import { useEffect, useRef, useState } from "react";
import { lyric, type LyricLine } from "../api";
import { Notice } from "../components/states";
import { artistNames, cover } from "../format";
import { player, usePlayer } from "../player";

const lyricCache = new Map<number, LyricLine[]>();

export function LyricsView() {
  const { queue, index } = usePlayer();
  const track = queue[index];
  const [lines, setLines] = useState<LyricLine[] | null>(null);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledAt = useRef(0);

  useEffect(() => {
    if (!track) return;
    setError("");
    const cached = lyricCache.get(track.id);
    if (cached) return setLines(cached);
    setLines(null);
    let live = true;
    lyric(track.id).then(
      (l) => {
        lyricCache.set(track.id, l);
        if (live) setLines(l);
      },
      (e) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [track?.id]);

  // Each frame: find the current line, and for word-timed lines fill each word by its own clock.
  // Word progress is written to CSS directly so React re-renders only when the line changes.
  useEffect(() => {
    if (!lines) return;
    let frame = 0;
    let last = -2;
    const tick = () => {
      const ms = player.time() * 1000;
      let i = -1;
      while (i + 1 < lines.length && lines[i + 1].ms <= ms) i++;
      if (i !== last) setActive((last = i));
      const words = lines[i]?.words;
      if (words) {
        scrollRef.current?.querySelectorAll<HTMLElement>(`[data-line="${i}"] .karaoke > span`).forEach((el, k) => {
          const p = Math.min(1, Math.max(0, (ms - words[k].ms) / words[k].durationMs));
          el.style.setProperty("--p", `${p * 100}%`);
        });
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [lines]);

  // Follow the song unless the reader scrolled in the last 3 seconds.
  useEffect(() => {
    if (active < 0 || Date.now() - userScrolledAt.current < 3000) return;
    scrollRef.current
      ?.querySelector(`[data-line="${active}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [active]);

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
        className="lyrics__scroll"
        ref={scrollRef}
        onWheel={() => (userScrolledAt.current = Date.now())}
      >
        {error && <Notice message={`歌词没加载出来。${error}`} />}
        {!error && !lines && <p className="state muted">加载中</p>}
        {lines?.length === 0 && <p className="lyrics__empty muted">这首歌没有歌词</p>}
        {lines?.map((l, i) => (
          <button
            key={i}
            data-line={i}
            className="lyrics__line"
            aria-current={i === active}
            onClick={() => player.seek(l.ms / 1000)}
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
