import { Badge } from "@music-lite/ui/components/ui/badge";
import { Button } from "@music-lite/ui/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@music-lite/ui/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@music-lite/ui/components/ui/tooltip";
import { Link } from "@tanstack/react-router";
import { CrosshairIcon, DotsThreeIcon, PlayIcon } from "@phosphor-icons/react";
import { type PlaylistSummary, type Track, pageId } from "../api";
import { cover, duration } from "../format";
import { library, useLibrary } from "../library";
import { player, playlistOrigin, usePlayer } from "../player";
import { Artists } from "./Artists";
import { LikeHeart } from "./LikeHeart";
import { TrackContextMenu, TrackMoreMenu } from "./TrackMenu";

// Row actions stay out of the way until the row is hovered or focused, so the list reads as names.
const reveal = "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100";

export function TrackTable({
  tracks,
  playlist,
  origin = playlist && playlistOrigin(playlist.id),
}: {
  tracks: Track[];
  playlist?: PlaylistSummary;
  origin?: string;
}) {
  const current = usePlayer((s) => s.queue[s.index]?.id);
  const playing = usePlayer((s) => s.playing);
  const liked = useLibrary((s) => s.liked);
  const hasCurrent = tracks.some((t) => t.id === current);
  const locate = () =>
    document.querySelector("tr[aria-current=true]")?.scrollIntoView({ block: "center", behavior: "smooth" });
  return (
    <>
    <Table className="table-fixed">
      <TableHeader className="[&_tr]:border-0">
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-xs font-normal text-muted-foreground">歌名 / 歌手</TableHead>
          <TableHead className="w-20">
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
            <TrackContextMenu key={`${t.id}-${i}`} tracks={tracks} index={i} playlist={playlist} origin={origin}>
              <TableRow
                tabIndex={0}
                aria-current={isCurrent}
                // Hover fills, press fills more, focus rings, and the playing row is marked by red text
                // and the eq bars instead of a fill, so the four never read alike.
                // A taken-down song is greyed out like in the official client, and offers no play button.
                data-unavailable={t.unavailable || undefined}
                className="group border-0 data-unavailable:opacity-45 hover:bg-accent/60 focus-visible:-outline-offset-2 active:bg-accent [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg"
                onDoubleClick={() => player.playQueue(tracks, i, origin)}
                onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && player.playQueue(tracks, i, origin)}
              >
                <TableCell className="py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative size-12 shrink-0">
                      <img className="size-12 rounded-md" src={cover(t.cover, 48)} alt="" loading="lazy" />
                      {isCurrent ? (
                        <span className="absolute inset-0 grid place-items-center rounded-md bg-background/60">
                          <span className="eq" data-playing={playing} />
                        </span>
                      ) : t.unavailable ? null : (
                        <button
                          aria-label={`播放 ${t.name}`}
                          className={`absolute inset-0 grid place-items-center rounded-md bg-background/60 text-foreground ${reveal}`}
                          onClick={() => player.playQueue(tracks, i, origin)}
                          onDoubleClick={(e) => e.stopPropagation()}
                        >
                          <PlayIcon weight="fill" className="size-4 translate-x-px" />
                        </button>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`truncate text-base ${isCurrent ? "text-primary" : "text-foreground"}`}>{t.name}</span>
                        {t.unavailable && (
                          <Badge variant="outline" className="shrink-0 text-muted-foreground">
                            已下架
                          </Badge>
                        )}
                        {t.vip && !t.unavailable && (
                          <Badge variant="outline" className="shrink-0 border-primary/60 text-primary">
                            VIP
                          </Badge>
                        )}
                      </div>
                      <div className="truncate text-sm text-muted-foreground">
                        <Artists artists={t.artists} src={t.src} />
                        {t.reason && ` · ${t.reason}`}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1" onDoubleClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={isLiked ? "取消喜欢" : "喜欢"}
                      aria-pressed={isLiked}
                      className={
                        isLiked ? "text-primary hover:text-primary" : `text-muted-foreground ${reveal}`
                      }
                      onClick={() => library.toggleLike(t)}
                    >
                      <LikeHeart liked={isLiked} />
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
                      <DotsThreeIcon weight="bold" />
                    </TrackMoreMenu>
                  </div>
                </TableCell>
                <TableCell className="truncate text-sm text-muted-foreground">
                  {t.album.id ? (
                    <Link className="link" to="/album/$id" params={{ id: pageId(t.album) }}>
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
    {/* Pinned to the corner of the window, above the player bar, so it stays put while the list scrolls. */}
    {hasCurrent && (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="secondary"
              size="icon-lg"
              aria-label="定位到正在播放"
              className="fixed right-8 bottom-28 z-10 rounded-full shadow-md ring-1 ring-border"
              onClick={locate}
            />
          }
        >
          <CrosshairIcon />
        </TooltipTrigger>
        <TooltipContent side="left">定位到正在播放</TooltipContent>
      </Tooltip>
    )}
    </>
  );
}
