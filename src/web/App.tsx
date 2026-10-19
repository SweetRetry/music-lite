import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { cover, duration, lite, type Me, type Playlist, type PlaylistSummary, type Track } from "./lite";
import { player, usePlayer, usePlayerShortcuts } from "./player";

type View = { kind: "playlist"; id: number } | { kind: "search"; q: string };

const playlistCache = new Map<number, Playlist>();

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View | null>(null);
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    lite
      .me()
      .then((m) => {
        setMe(m);
        setLiked(new Set(m.liked));
        if (m.playlists[0]) setView({ kind: "playlist", id: m.playlists[0].id });
      })
      .catch((e) => setError(e.message));
  }, []);

  usePlayerShortcuts(useCallback(() => searchRef.current?.focus(), []));

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
      <Sidebar me={me} view={view} onNavigate={setView} searchRef={searchRef} />
      <main className="main">
        {view?.kind === "playlist" && <PlaylistView key={view.id} id={view.id} />}
        {view?.kind === "search" && <SearchView key={view.q} q={view.q} />}
      </main>
      <PlayerBar liked={liked} onLike={toggleLike} />
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
  view: View | null;
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
  view: View | null;
  onNavigate: (v: View) => void;
}) {
  return (
    <section className="group">
      <h2 className="group__title">{title}</h2>
      {items.map((p) => (
        <button
          key={p.id}
          className="sidebar__item"
          aria-current={view?.kind === "playlist" && view.id === p.id}
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

function PlayerBar({ liked, onLike }: { liked: Set<number>; onLike: (id: number) => void }) {
  const s = usePlayer();
  const track = s.queue[s.index];
  const disabled = !track;
  return (
    <footer className="player">
      <div className="player__track">
        {track ? (
          <>
            <img src={cover(track.cover, 44)} alt="" />
            <div className="player__names">
              <span>{track.name}</span>
              <span className="muted">{s.notice || track.artists}</span>
            </div>
            <button
              className="icon-btn"
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
        <Icon name="volume" />
        <Range value={s.volume} max={1} step={0.01} label="音量" onChange={player.setVolume} />
      </div>
    </footer>
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
