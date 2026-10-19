import type { Track } from "../api";
import { Icon } from "../icons";
import { player } from "../player";

// Page header shared by every track list: art on the left, title, meta and play-all on the right.
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
    <header className="hero">
      {art}
      <div className="hero__text">
        <h1>{title}</h1>
        <p className="meta">{meta}</p>
        <div className="hero__actions">
          <button className="btn btn--primary" disabled={!tracks.length} onClick={() => player.playQueue(tracks, 0)}>
            <Icon name="play" />
            播放全部
          </button>
          {children}
        </div>
      </div>
    </header>
  );
}
