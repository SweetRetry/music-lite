import { Kbd } from "@ncm-lite/ui/components/ui/kbd";
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@ncm-lite/ui/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ncm-lite/ui/components/ui/tooltip";
import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { PlaylistSummary } from "../api";
import { cover } from "../format";
import { useLibrary } from "../library";
import { PlaylistContextMenu } from "./playlist/actions";
import { openPlaylistDialog } from "./playlist/dialogs";

// Links mark themselves aria-current="page"; the menu button takes its active look from that.
const item = "h-10 gap-3 aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium";

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
    <SidebarRoot collapsible="none" className="col-start-1 row-span-2 row-start-1 pt-(--titlebar)">
      <SidebarHeader className="px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <SidebarInput
            ref={searchRef}
            value={q}
            placeholder="搜索歌曲"
            aria-label="搜索歌曲"
            className="h-9 pr-9 pl-9"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && q.trim()) navigate({ to: "/search", search: { q: q.trim() } });
              if (e.key === "Escape") e.currentTarget.blur();
            }}
          />
          <Kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">/</Kbd>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-4 px-1 pb-4">
        <SidebarGroup>
          <SidebarMenu className="gap-1">
            <SidebarMenuItem>
              <SidebarMenuButton className={item} render={<Link to="/" />}>
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-sidebar-accent text-xs font-semibold tabular-nums">
                  {new Date().getDate()}
                </span>
                <span>每日推荐</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton className={item} render={<Link to="/liked" />}>
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-sidebar-accent text-destructive">
                  <Heart className="fill-current" />
                </span>
                <span>我喜欢的音乐</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <PlaylistGroup
          title="创建的歌单"
          items={mine}
          action={
            <Tooltip>
              <TooltipTrigger
                render={<SidebarGroupAction aria-label="新建歌单" onClick={() => openPlaylistDialog({ kind: "create" })} />}
              >
                <Plus />
              </TooltipTrigger>
              <TooltipContent>新建歌单</TooltipContent>
            </Tooltip>
          }
        />
        {saved.length > 0 && <PlaylistGroup title="收藏的歌单" items={saved} />}
      </SidebarContent>
    </SidebarRoot>
  );
}

function PlaylistGroup({ title, items, action }: { title: string; items: PlaylistSummary[]; action?: React.ReactNode }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      {action}
      <SidebarMenu className="gap-1">
        {items.map((p) => (
          <SidebarMenuItem key={p.id}>
            <PlaylistContextMenu playlist={p}>
              <SidebarMenuButton className={item} render={<Link to="/playlist/$id" params={{ id: p.id }} />}>
                <img className="size-7 shrink-0 rounded-md" src={cover(p.cover, 28)} alt="" />
                <span>{p.name}</span>
              </SidebarMenuButton>
            </PlaylistContextMenu>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
