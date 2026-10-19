// What you can do to a whole playlist, defined once and rendered as the sidebar's right-click
// menu and the playlist page's … menu.
import { Button } from "@ncm-lite/ui/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@ncm-lite/ui/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ncm-lite/ui/components/ui/dropdown-menu";
import { Ellipsis } from "lucide-react";
import { toast } from "sonner";
import type { PlaylistSummary } from "../../api";
import { editable, library, useLibrary } from "../../library";
import { failed, openPlaylistDialog } from "./dialogs";

type Action = { label: string; run: () => void; destructive?: boolean };

function usePlaylistActions(playlist: PlaylistSummary): Action[] {
  const me = useLibrary((s) => s.me);
  if (!me) return [];
  if (editable(me, playlist.id))
    return [
      { label: "重命名", run: () => openPlaylistDialog({ kind: "rename", playlist }) },
      { label: "删除歌单", run: () => openPlaylistDialog({ kind: "delete", playlist }), destructive: true },
    ];
  const own = me.playlists.find((p) => p.id === playlist.id)?.mine ?? false;
  if (own) return [];
  const collected = me.playlists.some((p) => p.id === playlist.id);
  const toggle = (on: boolean) =>
    library.subscribePlaylist(playlist.id, on).then(
      () => toast.success(on ? "已收藏" : "已取消收藏"),
      (e) => failed(on ? "没能收藏" : "没能取消收藏", e),
    );
  return [collected ? { label: "取消收藏", run: () => toggle(false) } : { label: "收藏", run: () => toggle(true) }];
}

export function PlaylistContextMenu({
  playlist,
  children,
}: {
  playlist: PlaylistSummary;
  children: React.ReactElement;
}) {
  const actions = usePlaylistActions(playlist);
  if (!actions.length) return children;
  return (
    <ContextMenu>
      <ContextMenuTrigger render={children} />
      <ContextMenuContent>
        {actions.map((a) => (
          <ContextMenuItem key={a.label} variant={a.destructive ? "destructive" : "default"} onClick={a.run}>
            {a.label}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function PlaylistMoreMenu({ playlist }: { playlist: PlaylistSummary }) {
  const actions = usePlaylistActions(playlist);
  if (!actions.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="icon-lg" aria-label="更多" />}>
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {actions.map((a) => (
          <DropdownMenuItem key={a.label} variant={a.destructive ? "destructive" : "default"} onClick={a.run}>
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
