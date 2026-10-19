import { Button } from "@ncm-lite/ui/components/ui/button";
import { Play } from "lucide-react";
import type { Track } from "../api";
import { player } from "../player";

// Page header shared by every track list: art, title, one line of meta, and play-all as the one primary action.
export function Hero({
  art,
  title,
  meta,
  tracks,
  children,
}: {
  art: React.ReactNode;
  title: string;
  meta: React.ReactNode;
  tracks: Track[];
  children?: React.ReactNode;
}) {
  return (
    <header className="flex items-end gap-8 pb-10">
      {art}
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="truncate text-4xl font-semibold tracking-tight">{title}</h1>
          <p className="truncate text-base text-muted-foreground">{meta}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="lg" disabled={!tracks.length} onClick={() => player.playQueue(tracks, 0)}>
            <Play className="fill-current" />
            播放全部
          </Button>
          {children}
        </div>
      </div>
    </header>
  );
}
