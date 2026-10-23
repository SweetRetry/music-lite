import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@ncm-lite/ui/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ncm-lite/ui/components/ui/tooltip";
import { Link } from "@tanstack/react-router";
import { CalendarBlankIcon, HeartIcon, PlusIcon } from "@phosphor-icons/react";
import type { PlaylistSummary } from "../api";
import { cover } from "../format";
import { useLibrary } from "../library";
import { scoped } from "../mode";
import { DAILY_ORIGIN, playlistOrigin, usePlayer } from "../player";
import { Account } from "./Account";
import { PlaylistContextMenu } from "./playlist/actions";
import { openPlaylistDialog } from "./playlist/dialogs";

// Links mark themselves aria-current="page". Hover is sidebar-accent; the current route is a light red
// tint with red text, which aria variants keep over hover and press. Press nudges the row instead of a third fill.
const item =
  "h-10 gap-3 transition-transform active:scale-[0.98] aria-[current=page]:bg-sidebar-primary/10 aria-[current=page]:font-medium aria-[current=page]:text-sidebar-primary dark:aria-[current=page]:bg-sidebar-primary/15";
// Glyph slot the same size as a playlist cover, so labels line up. No resting fill: a chip would melt into the hover row.
const glyph = "grid size-7 shrink-0 place-items-center";

// Marks the list the queue came from, with the same bars as the playing row. They grey out on pause.
function Playing({ origin }: { origin: string }) {
  const here = usePlayer((s) => s.origin === origin);
  const playing = usePlayer((s) => s.playing);
  if (!here) return null;
  return <span className="eq ml-auto shrink-0" data-playing={playing} role="img" aria-label="正在播放" />;
}

export function Sidebar() {
  const me = useLibrary((s) => s.me);
  const likedId = me?.playlists.find((p) => p.liked)?.id;

  // "我喜欢的音乐" is the library, a different layer from playlists, so it sits with the daily mix.
  const mine = me?.playlists.filter((p) => p.mine && !p.liked) ?? [];
  const saved = me?.playlists.filter((p) => !p.mine) ?? [];

  return (
    <SidebarRoot collapsible="none" className="col-start-1 row-start-1 overflow-hidden rounded-xl border pt-[calc(var(--titlebar)-var(--gutter))]">
      <SidebarContent className="gap-4 px-1 pt-2 pb-4">
        <SidebarGroup>
          <SidebarMenu className="gap-1">
            <SidebarMenuItem>
              <SidebarMenuButton className={item} render={<Link to="/" activeOptions={{ exact: true }} />}>
                {/* A calendar page with today's date, like the official client. */}
                <span className={`relative ${glyph}`}>
                  <CalendarBlankIcon className="size-6!" />
                  <span className="absolute inset-x-0 top-3 text-center text-[9px] leading-none font-semibold tabular-nums">
                    {new Date().getDate()}
                  </span>
                </span>
                <span>每日推荐</span>
                <Playing origin={scoped(DAILY_ORIGIN)} />
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton className={item} render={<Link to="/liked" />}>
                <span className={`${glyph} text-primary`}>
                  <HeartIcon weight="fill" className="size-5!" />
                </span>
                <span>我喜欢的音乐</span>
                {likedId && <Playing origin={playlistOrigin(likedId)} />}
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
                <PlusIcon />
              </TooltipTrigger>
              <TooltipContent>新建歌单</TooltipContent>
            </Tooltip>
          }
        />
        {saved.length > 0 && <PlaylistGroup title="收藏的歌单" items={saved} />}
      </SidebarContent>
      {/* As tall as the player bar beside it, so the two top borders meet in one line. */}
      <SidebarFooter className="h-22 justify-center border-t px-5">
        <Account />
      </SidebarFooter>
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
                <Playing origin={playlistOrigin(p.id)} />
              </SidebarMenuButton>
            </PlaylistContextMenu>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
