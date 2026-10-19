// Right-click menu for one track row. Playlist actions plug in here.
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@ncm-lite/ui/components/ui/context-menu";
import { useNavigate } from "@tanstack/react-router";
import type { PlaylistSummary, Track } from "../api";
import { library, useLibrary } from "../library";
import { player } from "../player";

export function TrackMenu({
  tracks,
  index,
  children,
}: {
  tracks: Track[];
  index: number;
  // The playlist the rows belong to, when the table shows one.
  playlist?: PlaylistSummary;
  children: React.ReactElement;
}) {
  const track = tracks[index];
  const liked = useLibrary((s) => s.liked);
  const navigate = useNavigate();
  return (
    <ContextMenu>
      <ContextMenuTrigger render={children} />
      <ContextMenuContent>
        <ContextMenuItem onClick={() => player.playQueue(tracks, index)}>播放</ContextMenuItem>
        <ContextMenuItem onClick={() => library.toggleLike(track.id)}>
          {liked.has(track.id) ? "取消喜欢" : "喜欢"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        {track.artists.map((a) => (
          <ContextMenuItem key={a.id} onClick={() => navigate({ to: "/artist/$id", params: { id: a.id } })}>
            歌手：{a.name}
          </ContextMenuItem>
        ))}
        {track.album.id > 0 && (
          <ContextMenuItem onClick={() => navigate({ to: "/album/$id", params: { id: track.album.id } })}>
            专辑：{track.album.name}
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
