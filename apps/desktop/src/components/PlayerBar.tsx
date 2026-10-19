import { duration, cover } from "../format";
import { Icon } from "../icons";
import { library, useLibrary } from "../library";
import { player, usePlayer } from "../player";
import { useUi } from "../ui";
import { Artists } from "./Artists";
import { QualityMenu } from "./player/QualityMenu";
import { QueuePanel } from "./player/QueuePanel";
import { Range } from "./Range";

export function PlayerBar() {
  const s = usePlayer();
  const liked = useLibrary((l) => l.liked);
  const { lyricsOpen, toggleLyrics } = useUi();
  const onToggleLyrics = () => toggleLyrics();
  const track = s.queue[s.index];
  const disabled = !track;
  return (
    <footer className="player">
      <div className="player__track">
        {track ? (
          <>
            <button className="player__cover" aria-label={lyricsOpen ? "收起歌词" : "展开歌词"} onClick={onToggleLyrics}>
              <img src={cover(track.cover, 44)} alt="" />
            </button>
            <div className="player__names">
              <span>{track.name}</span>
              <span className="muted">{s.notice || <Artists artists={track.artists} />}</span>
            </div>
            <button
              className="icon-btn like"
              aria-label={liked.has(track.id) ? "取消喜欢" : "喜欢"}
              aria-pressed={liked.has(track.id)}
              onClick={() => library.toggleLike(track.id)}
            >
              <Icon name="heart" filled={liked.has(track.id)} />
            </button>
          </>
        ) : (
          <span className="muted">{s.notice || "双击一首歌开始播放"}</span>
        )}
      </div>
      <div className="player__center">
        <div className="player__controls">
          <button className="icon-btn" aria-label="上一首" disabled={disabled} onClick={player.prev}>
            <Icon name="prev" />
          </button>
          <button className="play-btn" aria-label={s.playing ? "暂停" : "播放"} disabled={disabled} onClick={player.toggle}>
            <Icon name={s.playing ? "pause" : "play"} />
          </button>
          <button className="icon-btn" aria-label="下一首" disabled={disabled} onClick={player.next}>
            <Icon name="next" />
          </button>
        </div>
        <div className="player__progress">
          <span className="num muted">{duration(s.position * 1000)}</span>
          <Range
            value={s.position}
            max={s.duration || 1}
            disabled={disabled || s.loading}
            label="播放进度"
            onChange={player.seek}
          />
          <span className="num muted">{duration(s.duration * 1000)}</span>
        </div>
      </div>
      <div className="player__volume">
        <QualityMenu />
        <button
          className="icon-btn"
          aria-label="歌词"
          aria-pressed={lyricsOpen}
          disabled={disabled}
          onClick={onToggleLyrics}
        >
          <Icon name="lyrics" />
        </button>
        <QueuePanel />
        <Icon name="volume" />
        <Range value={s.volume} max={1} step={0.01} label="音量" onChange={player.setVolume} />
      </div>
    </footer>
  );
}
