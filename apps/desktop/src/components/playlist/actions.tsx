// What you can do to a whole playlist, defined once and rendered as the sidebar's right-click
// menu and the playlist page's … menu.
import { Button } from "@ncm-lite/ui/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@ncm-lite/ui/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@ncm-lite/ui/components/ui/dropdown-menu";
import {
  DotsThreeIcon,
  BroomIcon,
  FolderSimpleMinusIcon,
  FolderSimplePlusIcon,
  type Icon,
  PencilSimpleIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { Fragment } from "react";
import { toast } from "sonner";
import type { PlaylistSummary } from "../../api";
import { editable, library, takenDown, useLibrary } from "../../library";
import { failed, openPlaylistDialog } from "./dialogs";

// hint is a quiet count at the row's end. A destructive action sits apart from the rest.
type Action = { label: string; icon: Icon; run: () => void; destructive?: boolean; hint?: number };

function usePlaylistActions(playlist: PlaylistSummary): Action[] {
  const me = useLibrary((s) => s.me);
  const opened = useLibrary((s) => s.opened[playlist.id]);
  if (!me) return [];
  if (editable(me, playlist.id)) {
    // Only a playlist that has been opened has its songs to look through.
    const gone = takenDown(opened?.tracks ?? []);
    return [
      { label: "重命名", icon: PencilSimpleIcon, run: () => openPlaylistDialog({ kind: "rename", playlist }) },
      ...(gone.length
        ? [{ label: "清理已下架歌曲", hint: gone.length, icon: BroomIcon, run: () => openPlaylistDialog({ kind: "prune", playlist, tracks: gone }) }]
        : []),
      { label: "删除歌单", icon: TrashIcon, run: () => openPlaylistDialog({ kind: "delete", playlist }), destructive: true },
    ];
  }
  const own = me.playlists.find((p) => p.id === playlist.id)?.mine ?? false;
  if (own) return [];
  const collected = me.playlists.some((p) => p.id === playlist.id);
  const toggle = (on: boolean) =>
    library.subscribePlaylist(playlist.id, on).then(
      () => toast.success(on ? "已收藏" : "已取消收藏"),
      (e) => failed(on ? "没能收藏" : "没能取消收藏", e),
    );
  return [
    collected
      ? { label: "取消收藏", icon: FolderSimpleMinusIcon, run: () => toggle(false) }
      : { label: "收藏", icon: FolderSimplePlusIcon, run: () => toggle(true) },
  ];
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
        {actions.map((a, i) => (
          <Fragment key={a.label}>
            {a.destructive && i > 0 && <ContextMenuSeparator />}
            <ContextMenuItem variant={a.destructive ? "destructive" : "default"} onClick={a.run}>
              <a.icon />
              {a.label}
              {a.hint !== undefined && <ContextMenuShortcut className="tracking-normal tabular-nums">{a.hint}</ContextMenuShortcut>}
            </ContextMenuItem>
          </Fragment>
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
        <DotsThreeIcon weight="bold" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {actions.map((a, i) => (
          <Fragment key={a.label}>
            {a.destructive && i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem variant={a.destructive ? "destructive" : "default"} onClick={a.run}>
              <a.icon />
              {a.label}
              {a.hint !== undefined && <DropdownMenuShortcut className="tracking-normal tabular-nums">{a.hint}</DropdownMenuShortcut>}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
