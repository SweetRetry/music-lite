import { Badge } from "@ncm-lite/ui/components/ui/badge";
import { Button } from "@ncm-lite/ui/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ncm-lite/ui/components/ui/table";
import { Link } from "@tanstack/react-router";
import { Ellipsis, GripVertical, Heart, Play } from "lucide-react";
import type { PlaylistSummary, Track } from "../api";
import { cover, duration } from "../format";
import { library, useLibrary } from "../library";
import { player, usePlayer } from "../player";
import { Artists } from "./Artists";
import { type Move, useReorder } from "./playlist/reorder";
import { TrackContextMenu, TrackMoreMenu } from "./TrackMenu";

// Row actions stay out of the way until the row is hovered or focused, so the list reads as names.
const reveal = "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100";

export function TrackTable({
  tracks,
  playlist,
  onReorder,
}: {
  tracks: Track[];
  playlist?: PlaylistSummary;
  // Given when the rows can be reordered: a playlist the user owns.
  onReorder?: Move;
}) {
  const { dragging, handleProps, dropAt } = useReorder(onReorder);
  const current = usePlayer((s) => s.queue[s.index]?.id);
  const playing = usePlayer((s) => s.playing);
  const liked = useLibrary((s) => s.liked);
  return (
    <Table className="table-fixed">
      <TableHeader className="[&_tr]:border-0">
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-xs font-normal text-muted-foreground">歌名 / 歌手</TableHead>
          <TableHead className={onReorder ? "w-28" : "w-20"}>
            <span className="sr-only">操作</span>
          </TableHead>
          <TableHead className="w-1/3 text-xs font-normal text-muted-foreground">专辑</TableHead>
          <TableHead className="w-16 text-right text-xs font-normal text-muted-foreground">时长</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tracks.map((t, i) => {
          const isCurrent = t.id === current;
          const isLiked = liked.has(t.id);
          return (
            // A playlist holds a song once, so its rows keep their identity (and focus) when they move.
            <TrackContextMenu key={onReorder ? t.id : `${t.id}-${i}`} tracks={tracks} index={i} playlist={playlist}>
              <TableRow
                tabIndex={0}
                aria-current={isCurrent}
                data-drop={dropAt(i, tracks.length)}
                data-dragging={dragging === i || undefined}
                className="group border-0 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:-outline-offset-2 aria-[current=true]:bg-muted data-dragging:opacity-50 data-[drop=after]:[&>td]:shadow-[inset_0_-2px_0_var(--primary)] data-[drop=before]:[&>td]:shadow-[inset_0_2px_0_var(--primary)] [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg"
                onDoubleClick={() => player.playQueue(tracks, i)}
                onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && player.playQueue(tracks, i)}
              >
                <TableCell className="py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative size-12 shrink-0">
                      <img className="size-12 rounded-md" src={cover(t.cover, 48)} alt="" loading="lazy" />
                      {isCurrent ? (
                        <span className="absolute inset-0 grid place-items-center rounded-md bg-background/60">
                          <span className="eq" data-playing={playing} />
                        </span>
                      ) : (
                        <button
                          aria-label={`播放 ${t.name}`}
                          className={`absolute inset-0 grid place-items-center rounded-md bg-background/60 text-foreground ${reveal}`}
                          onClick={() => player.playQueue(tracks, i)}
                          onDoubleClick={(e) => e.stopPropagation()}
                        >
                          <Play className="size-4 translate-x-px fill-current" />
                        </button>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-base text-foreground">{t.name}</span>
                        {t.vip && (
                          <Badge variant="outline" className="shrink-0 border-primary/60 text-primary">
                            VIP
                          </Badge>
                        )}
                      </div>
                      <div className="truncate text-sm text-muted-foreground">
                        <Artists artists={t.artists} />
                        {t.reason && ` · ${t.reason}`}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1" onDoubleClick={(e) => e.stopPropagation()}>
                    {onReorder && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`拖动排序 ${t.name}，或按上下方向键移动`}
                        className={`cursor-grab touch-none text-muted-foreground active:cursor-grabbing ${reveal}`}
                        {...handleProps(i)}
                      >
                        <GripVertical />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={isLiked ? "取消喜欢" : "喜欢"}
                      aria-pressed={isLiked}
                      className={
                        isLiked ? "text-destructive hover:text-destructive" : `text-muted-foreground ${reveal}`
                      }
                      onClick={() => library.toggleLike(t.id)}
                    >
                      <Heart className={isLiked ? "fill-current" : undefined} />
                    </Button>
                    <TrackMoreMenu
                      tracks={tracks}
                      index={i}
                      playlist={playlist}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="更多"
                          className={`text-muted-foreground aria-expanded:opacity-100 ${reveal}`}
                        />
                      }
                    >
                      <Ellipsis />
                    </TrackMoreMenu>
                  </div>
                </TableCell>
                <TableCell className="truncate text-sm text-muted-foreground">
                  {t.album.id ? (
                    <Link className="link" to="/album/$id" params={{ id: t.album.id }}>
                      {t.album.name}
                    </Link>
                  ) : (
                    t.album.name
                  )}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                  {duration(t.durationMs)}
                </TableCell>
              </TableRow>
            </TrackContextMenu>
          );
        })}
      </TableBody>
    </Table>
  );
}
