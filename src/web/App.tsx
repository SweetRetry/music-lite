import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { cover, duration, lite, type LyricLine, type Me, type Playlist, type PlaylistSummary, type Track } from "./lite";
import { player, usePlayer, usePlayerShortcuts } from "./player";

type View = { kind: "daily" } | { kind: "playlist"; id: number } | { kind: "search"; q: string };

const playlistCache = new Map<number, Playlist>();

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>({ kind: "daily" });
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    lite
      .me()
      .then((m) => {
        setMe(m);
        setLiked(new Set(m.liked));
      })
      .catch((e) => setError(e.message));
  }, []);

  usePlayerShortcuts(useCallback(() => searchRef.current?.focus(), []));

  useEffect(() => {
    if (!lyricsOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLyricsOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lyricsOpen]);

  const navigate = (v: View) => {
    setView(v);
    setLyricsOpen(false);
  };

  const toggleLike = async (id: number) => {
    const next = !liked.has(id);
    const apply = (on: boolean) =>
      setLiked((s) => {
        const copy = new Set(s);
        on ? copy.add(id) : copy.delete(id);
        return copy;
      });
    apply(next);
    if (me?.playlists[0]) playlistCache.delete(me.playlists[0].id);
    await lite.like(id, next).catch(() => apply(!next));
  };

  if (error) return <Fatal message={error} />;

  return (
    <div className="shell">
      <Sidebar me={me} view={view} onNavigate={navigate} searchRef={searchRef} />
      {lyricsOpen ? (
        <LyricsView />
      ) : (
        <main className="main">
          {view.kind === "daily" && <DailyView />}
          {view.kind === "playlist" && <PlaylistView key={view.id} id={view.id} />}
          {view.kind === "search" && <SearchView key={view.q} q={view.q} />}
        </main>
      )}
      <PlayerBar
        liked={liked}
        onLike={toggleLike}
        lyricsOpen={lyricsOpen}
        onToggleLyrics={() => setLyricsOpen((o) => !o)}
      />
    </div>
  );
}

function Sidebar({
  me,
  view,
  onNavigate,
  searchRef,
}: {
  me: Me | null;
  view: View;
  onNavigate: (v: View) => void;
  searchRef: React.RefObject<HTMLInputElement>;
}) {
  const [q, setQ] = useState("");

  useEffect(() => {
    const keyword = q.trim();
    if (!keyword) return;
    const t = setTimeout(() => onNavigate({ kind: "search", q: keyword }), 350);
    return () => clearTimeout(t);
  }, [q]);

  const mine = me?.playlists.filter((p) => p.mine) ?? [];
  const saved = me?.playlists.filter((p) => !p.mine) ?? [];

  return (
    <nav className="sidebar">
      <label className="search">
        <Icon name="search" />
        <input
          ref={searchRef}
          value={q}
          placeholder="搜索歌曲"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q.trim()) onNavigate({ kind: "search", q: q.trim() });
            if (e.key === "Escape") e.currentTarget.blur();
          }}
        />
        <kbd>/</kbd>
      </label>
      <div className="sidebar__scroll">
        <button
          className="sidebar__item"
          aria-current={view.kind === "daily"}
          onClick={() => onNavigate({ kind: "daily" })}
        >
          <span className="day-tile">{new Date().getDate()}</span>
          <span>每日推荐</span>
        </button>
        <PlaylistGroup title="创建的歌单" items={mine} view={view} onNavigate={onNavigate} />
        {saved.length > 0 && <PlaylistGroup title="收藏的歌单" items={saved} view={view} onNavigate={onNavigate} />}
      </div>
      {me && (
        <div className="sidebar__me">
          <img src={cover(me.avatar, 24)} alt="" />
          <span>{me.nickname}</span>
        </div>
      )}
    </nav>
  );
}

function PlaylistGroup({
  title,
  items,
  view,
  onNavigate,
}: {
  title: string;
  items: PlaylistSummary[];
  view: View;
  onNavigate: (v: View) => void;
}) {
  return (
    <section className="group">
      <h2 className="group__title">{title}</h2>
      {items.map((p) => (
        <button
          key={p.id}
          className="sidebar__item"
          aria-current={view.kind === "playlist" && view.id === p.id}
          onClick={() => onNavigate({ kind: "playlist", id: p.id })}
        >
          <img src={cover(p.cover, 24)} alt="" />
          <span>{p.name}</span>
        </button>
      ))}
    </section>
  );
}

function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    load().then(setData, (e) => setError(e.message));
  }, []);
  return { data, error };
}

function PlaylistView({ id }: { id: number }) {
  const { data, error } = useLoad(async () => {
    const cached = playlistCache.get(id);
    if (cached) return cached;
    const p = await lite.playlist(id);
    playlistCache.set(id, p);
    return p;
  });
  if (error) return <Notice message={`歌单没加载出来。${error}`} />;
  if (!data) return <Loading />;
  return (
    <>
      <header className="hero">
        <img className="hero__cover" src={cover(data.cover, 120)} alt="" />
        <div className="hero__text">
          <h1>{data.name}</h1>
          <p className="meta">
            {data.creator} · {data.tracks.length} 首
          </p>
          <button className="btn btn--primary" disabled={!data.tracks.length} onClick={() => player.playQueue(data.tracks, 0)}>
            <Icon name="play" />
            播放全部
          </button>
        </div>
      </header>
      <TrackTable tracks={data.tracks} />
    </>
  );
}

function DailyView() {
  const { data, error } = useLoad(lite.daily);
  if (error) return <Notice message={`每日推荐没加载出来。${error}`} />;
  if (!data) return <Loading />;
  const today = new Date();
  return (
    <>
      <header className="hero">
        <div className="hero__cover day-cover">
          <span className="day-cover__month">{today.getMonth() + 1} 月</span>
          <span className="day-cover__date">{today.getDate()}</span>
        </div>
        <div className="hero__text">
          <h1>每日推荐</h1>
          <p className="meta">根据你的口味生成，每天 6:00 更新 · {data.length} 首</p>
          <button className="btn btn--primary" disabled={!data.length} onClick={() => player.playQueue(data, 0)}>
            <Icon name="play" />
            播放全部
          </button>
        </div>
      </header>
      <TrackTable tracks={data} />
    </>
  );
}

function SearchView({ q }: { q: string }) {
  const { data, error } = useLoad(() => lite.search(q));
  if (error) return <Notice message={`搜索失败。${error}`} />;
  if (!data) return <Loading />;
  return (
    <>
      <header className="hero hero--compact">
        <div className="hero__text">
          <h1>「{q}」</h1>
          <p className="meta">{data.length ? `${data.length} 首歌曲，双击播放` : "没有找到相关歌曲，换个关键词试试"}</p>
        </div>
      </header>
      {data.length > 0 && <TrackTable tracks={data} />}
    </>
  );
}

function TrackTable({ tracks }: { tracks: Track[] }) {
  const { queue, index, playing } = usePlayer();
  const current = queue[index]?.id;
  return (
    <table className="tracks">
      <thead>
        <tr>
          <th className="num">#</th>
          <th>标题</th>
          <th>歌手</th>
          <th>专辑</th>
          <th className="num">时长</th>
        </tr>
      </thead>
      <tbody>
        {tracks.map((t, i) => (
          <tr
            key={`${t.id}-${i}`}
            tabIndex={0}
            aria-current={t.id === current}
            onDoubleClick={() => player.playQueue(tracks, i)}
            onKeyDown={(e) => e.key === "Enter" && player.playQueue(tracks, i)}
          >
            <td className="num">{t.id === current ? <span className="eq" data-playing={playing} /> : i + 1}</td>
            <td>
              <div className="title">
                <img src={cover(t.cover, 32)} alt="" loading="lazy" />
                <span>{t.name}</span>
                {t.reason && <span className="reason">{t.reason}</span>}
              </div>
            </td>
            <td className="muted">{t.artists}</td>
            <td className="muted">{t.album}</td>
            <td className="num muted">{duration(t.durationMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PlayerBar({
  liked,
  onLike,
  lyricsOpen,
  onToggleLyrics,
}: {
  liked: Set<number>;
  onLike: (id: number) => void;
  lyricsOpen: boolean;
  onToggleLyrics: () => void;
}) {
  const s = usePlayer();
  const track = s.queue[s.index];
  const disabled = !track;
  return (
    <footer className="player">
      <div className="player__track">
        {track ? (
          <>
            <button className="player__cover" aria-label={lyricsOpen ? "收起歌词" : "展开歌词"} onClick={onToggleLyrics}>
              <img src={cover(track.cover, 44)} alt="" />
            </button>
            <div className="player__names">
              <span>{track.name}</span>
              <span className="muted">{s.notice || track.artists}</span>
            </div>
            <button
              className="icon-btn like"
              aria-label={liked.has(track.id) ? "取消喜欢" : "喜欢"}
              aria-pressed={liked.has(track.id)}
              onClick={() => onLike(track.id)}
            >
              <Icon name="heart" filled={liked.has(track.id)} />
            </button>
          </>
        ) : (
          <span className="muted">{s.notice || "双击一首歌开始播放"}</span>
        )}
      </div>
      <div className="player__center">
        <div className="player__controls">
          <button className="icon-btn" aria-label="上一首" disabled={disabled} onClick={player.prev}>
            <Icon name="prev" />
          </button>
          <button className="play-btn" aria-label={s.playing ? "暂停" : "播放"} disabled={disabled} onClick={player.toggle}>
            <Icon name={s.playing ? "pause" : "play"} />
          </button>
          <button className="icon-btn" aria-label="下一首" disabled={disabled} onClick={player.next}>
            <Icon name="next" />
          </button>
        </div>
        <div className="player__progress">
          <span className="num muted">{duration(s.position * 1000)}</span>
          <Range
            value={s.position}
            max={s.duration || 1}
            disabled={disabled || s.loading}
            label="播放进度"
            onChange={player.seek}
          />
          <span className="num muted">{duration(s.duration * 1000)}</span>
        </div>
      </div>
      <div className="player__volume">
        <button
          className="icon-btn"
          aria-label="歌词"
          aria-pressed={lyricsOpen}
          disabled={disabled}
          onClick={onToggleLyrics}
        >
          <Icon name="lyrics" />
        </button>
        <Icon name="volume" />
        <Range value={s.volume} max={1} step={0.01} label="音量" onChange={player.setVolume} />
      </div>
    </footer>
  );
}

const lyricCache = new Map<number, LyricLine[]>();

function LyricsView() {
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
    lite.lyric(track.id).then(
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
        <p className="muted">{track.artists}</p>
        <p className="muted">{track.album}</p>
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

function Range(props: {
  value: number;
  max: number;
  step?: number;
  disabled?: boolean;
  label: string;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="range"
      className="range"
      min={0}
      max={props.max}
      step={props.step ?? 0.1}
      value={props.value}
      disabled={props.disabled}
      aria-label={props.label}
      style={{ "--fill": `${(props.value / props.max) * 100}%` } as React.CSSProperties}
      onChange={(e) => props.onChange(Number(e.target.value))}
    />
  );
}

const Loading = () => <p className="state muted">加载中</p>;
const Notice = ({ message }: { message: string }) => <p className="state notice">{message}</p>;
const Fatal = ({ message }: { message: string }) => (
  <div className="fatal">
    <h1>没能连上网易云</h1>
    <p className="notice">{message}</p>
    <p className="muted">先在官方客户端里登录一次，再重启 NCM Lite。</p>
  </div>
);
