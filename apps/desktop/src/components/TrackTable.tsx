import { Link } from "@tanstack/react-router";
import type { PlaylistSummary, Track } from "../api";
import { cover, duration } from "../format";
import { Icon } from "../icons";
import { library, useLibrary } from "../library";
import { player, usePlayer } from "../player";
import { Artists } from "./Artists";
import { TrackMenu } from "./TrackMenu";

export function TrackTable({ tracks, playlist }: { tracks: Track[]; playlist?: PlaylistSummary }) {
  const { queue, index, playing } = usePlayer();
  const liked = useLibrary((s) => s.liked);
  const current = queue[index]?.id;
  return (
    <table className="tracks">
      <thead>
        <tr>
          <th className="num">#</th>
          <th>标题</th>
          <th>歌手</th>
          <th>专辑</th>
          <th aria-label="喜欢" />
          <th className="num">时长</th>
        </tr>
      </thead>
      <tbody>
        {tracks.map((t, i) => (
          <TrackMenu key={`${t.id}-${i}`} tracks={tracks} index={i} playlist={playlist}>
            <tr
              tabIndex={0}
              aria-current={t.id === current}
              onDoubleClick={() => player.playQueue(tracks, i)}
              onKeyDown={(e) => e.key === "Enter" && player.playQueue(tracks, i)}
            >
              <td className="num">{t.id === current ? <span className="eq" data-playing={playing} /> : i + 1}</td>
              <td>
                <div className="title">
                  <img src={cover(t.cover, 32)} alt="" loading="lazy" />
                  <span>{t.name}</span>
                  {t.vip && <span className="tag">VIP</span>}
                  {t.reason && <span className="reason">{t.reason}</span>}
                </div>
              </td>
              <td className="muted">
                <Artists track={t} />
              </td>
              <td className="muted">
                {t.album.id ? (
                  <Link className="link" to="/album/$id" params={{ id: t.album.id }}>
                    {t.album.name}
                  </Link>
                ) : (
                  t.album.name
                )}
              </td>
              <td>
                <button
                  className="icon-btn like"
                  aria-label={liked.has(t.id) ? "取消喜欢" : "喜欢"}
                  aria-pressed={liked.has(t.id)}
                  onClick={() => library.toggleLike(t.id)}
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  <Icon name="heart" filled={liked.has(t.id)} />
                </button>
              </td>
              <td className="num muted">{duration(t.durationMs)}</td>
            </tr>
          </TrackMenu>
        ))}
      </tbody>
    </table>
  );
}
