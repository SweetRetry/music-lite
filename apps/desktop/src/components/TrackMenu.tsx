// What you can do with one track. Defined once as data, rendered as the row's context menu and as
// its "more" dropdown, so both always offer the same actions. Playlist actions plug in here.
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@ncm-lite/ui/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@ncm-lite/ui/components/ui/dropdown-menu";
import {
  HeartBreakIcon,
  HeartIcon,
  type Icon,
  ListPlusIcon,
  PlayIcon,
  PlusIcon,
  QueueIcon,
  TrashIcon,
  UserIcon,
  VinylRecordIcon,
} from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import type { PlaylistSummary, Track } from "../api";
import { toast } from "sonner";
import { editable, library, useLibrary } from "../library";
import { player } from "../player";
import { failed, openPlaylistDialog } from "./playlist/dialogs";

export type TrackAction =
  | { kind: "item"; label: string; icon?: Icon; onSelect: () => void }
  | { kind: "sub"; label: string; icon: Icon; items: TrackAction[] }
  | { kind: "separator" };

export type TrackContext = {
  tracks: Track[];
  index: number;
  // The playlist the rows belong to, when the table shows one.
  playlist?: PlaylistSummary;
};

export function useTrackActions({ tracks, index, playlist }: TrackContext): TrackAction[] {
  const track = tracks[index];
  const liked = useLibrary((s) => s.liked.has(track.id));
  const me = useLibrary((s) => s.me);
  const navigate = useNavigate();
  // The liked playlist is left to 喜欢, and the playlist on screen already has the song.
  const targets = me?.playlists.filter((p) => p.mine && !p.liked && p.id !== playlist?.id) ?? [];
  const addTo = (pid: number, name: string) =>
    library.addTracks(pid, [track]).then(
      () => toast.success(`已添加到「${name}」`),
      (e) => failed("没能添加到歌单", e),
    );
  return [
    { kind: "item", label: "播放", icon: PlayIcon, onSelect: () => player.playQueue(tracks, index) },
    { kind: "item", label: "下一首播放", icon: QueueIcon, onSelect: () => player.playNext(track) },
    {
      kind: "item",
      label: liked ? "取消喜欢" : "喜欢",
      icon: liked ? HeartBreakIcon : HeartIcon,
      onSelect: () => library.toggleLike(track.id),
    },
    {
      kind: "sub",
      label: "添加到歌单",
      icon: ListPlusIcon,
      items: [
        {
          kind: "item",
          label: "新建歌单",
          icon: PlusIcon,
          onSelect: () => openPlaylistDialog({ kind: "create", onCreated: addTo }),
        },
        ...(targets.length ? [{ kind: "separator" } satisfies TrackAction] : []),
        ...targets.map((p): TrackAction => ({ kind: "item", label: p.name, onSelect: () => addTo(p.id, p.name) })),
      ],
    },
    ...(playlist && editable(me, playlist.id)
      ? [
          {
            kind: "item",
            label: "从歌单中删除",
            icon: TrashIcon,
            onSelect: () =>
              library.removeTracks(playlist.id, [track.id]).catch((e) => failed("没能从歌单中删除，已放回", e)),
          } satisfies TrackAction,
        ]
      : []),
    { kind: "separator" },
    ...track.artists
      .filter((a) => a.id)
      .map((a): TrackAction => ({
        kind: "item",
        label: `歌手：${a.name}`,
        icon: UserIcon,
        onSelect: () => navigate({ to: "/artist/$id", params: { id: a.id } }),
      })),
    ...(track.album.id
      ? [
          {
            kind: "item",
            label: `专辑：${track.album.name}`,
            icon: VinylRecordIcon,
            onSelect: () => navigate({ to: "/album/$id", params: { id: track.album.id } }),
          } satisfies TrackAction,
        ]
      : []),
  ];
}

function ContextItems({ actions }: { actions: TrackAction[] }) {
  return actions.map((a, i) =>
    a.kind === "separator" ? (
      <ContextMenuSeparator key={i} />
    ) : a.kind === "sub" ? (
      <ContextMenuSub key={i}>
        <ContextMenuSubTrigger>
          <a.icon />
          {a.label}
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextItems actions={a.items} />
        </ContextMenuSubContent>
      </ContextMenuSub>
    ) : (
      <ContextMenuItem key={i} onClick={a.onSelect}>
        {a.icon && <a.icon />}
        {a.label}
      </ContextMenuItem>
    ),
  );
}

function DropdownItems({ actions }: { actions: TrackAction[] }) {
  return actions.map((a, i) =>
    a.kind === "separator" ? (
      <DropdownMenuSeparator key={i} />
    ) : a.kind === "sub" ? (
      <DropdownMenuSub key={i}>
        <DropdownMenuSubTrigger>
          <a.icon />
          {a.label}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownItems actions={a.items} />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    ) : (
      <DropdownMenuItem key={i} onClick={a.onSelect}>
        {a.icon && <a.icon />}
        {a.label}
      </DropdownMenuItem>
    ),
  );
}

// Right-click anywhere on the row.
export function TrackContextMenu({ children, ...context }: TrackContext & { children: React.ReactElement }) {
  const actions = useTrackActions(context);
  return (
    <ContextMenu>
      <ContextMenuTrigger render={children} />
      <ContextMenuContent>
        <ContextItems actions={actions} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

// The row's visible entry to the same actions.
export function TrackMoreMenu({
  trigger,
  children,
  ...context
}: TrackContext & { trigger: React.ReactElement; children: React.ReactNode }) {
  const actions = useTrackActions(context);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownItems actions={actions} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
