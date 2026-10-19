import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { PlaylistSummary } from "../api";
import { cover } from "../format";
import { Icon } from "../icons";
import { useLibrary } from "../library";
import { Account } from "./Account";

export function Sidebar({ searchRef }: { searchRef: React.RefObject<HTMLInputElement | null> }) {
  const me = useLibrary((s) => s.me);
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  useEffect(() => {
    const keyword = q.trim();
    if (!keyword) return;
    const t = setTimeout(() => navigate({ to: "/search", search: { q: keyword }, replace: true }), 350);
    return () => clearTimeout(t);
  }, [q]);

  // "我喜欢的音乐" is the library, a different layer from playlists, so it sits with the daily mix.
  const mine = me?.playlists.filter((p) => p.mine && !p.liked) ?? [];
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
            if (e.key === "Enter" && q.trim()) navigate({ to: "/search", search: { q: q.trim() } });
            if (e.key === "Escape") e.currentTarget.blur();
          }}
        />
        <kbd>/</kbd>
      </label>
      <div className="sidebar__scroll">
        <Link className="sidebar__item" to="/">
          <span className="day-tile">{new Date().getDate()}</span>
          <span>每日推荐</span>
        </Link>
        <Link className="sidebar__item" to="/liked">
          <span className="day-tile day-tile--liked">
            <Icon name="heart" filled />
          </span>
          <span>我喜欢的音乐</span>
        </Link>
        <PlaylistGroup title="创建的歌单" items={mine} />
        {saved.length > 0 && <PlaylistGroup title="收藏的歌单" items={saved} />}
      </div>
      <Account />
    </nav>
  );
}

function PlaylistGroup({ title, items }: { title: string; items: PlaylistSummary[] }) {
  return (
    <section className="group">
      <h2 className="group__title">{title}</h2>
      {items.map((p) => (
        <Link key={p.id} className="sidebar__item" to="/playlist/$id" params={{ id: p.id }}>
          <img src={cover(p.cover, 24)} alt="" />
          <span>{p.name}</span>
        </Link>
      ))}
    </section>
  );
}
