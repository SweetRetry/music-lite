import {
  HeartIcon,
  MicrophoneStageIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SpeakerHighIcon,
  SpeakerLowIcon,
  SpeakerXIcon,
} from "@phosphor-icons/react";
import { useRef } from "react";
import { duration, cover } from "../format";
import { library, useLibrary } from "../library";
import { player, usePlayer } from "../player";
import { useUi } from "../ui";
import { Artists } from "./Artists";
import { QualityMenu } from "./player/QualityMenu";
import { QueuePanel } from "./player/QueuePanel";
import { Range } from "./Range";
import { Tip } from "./ShortcutKeys";

export function PlayerBar() {
  const s = usePlayer();
  const liked = useLibrary((l) => l.liked);
  const { lyricsOpen, toggleLyrics } = useUi();
  const onToggleLyrics = () => toggleLyrics();
  const track = s.queue[s.index];
  const disabled = !track;
  // Unmuting restores the level from before the mute.
  const lastVolume = useRef(s.volume || 0.8);
  const muted = s.volume === 0;
  const Speaker = muted ? SpeakerXIcon : s.volume < 0.5 ? SpeakerLowIcon : SpeakerHighIcon;
  const toggleMute = () => {
    if (muted) return player.setVolume(lastVolume.current);
    lastVolume.current = s.volume;
    player.setVolume(0);
  };
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
            <Tip
              label={liked.has(track.id) ? "取消喜欢" : "喜欢"}
              id="like"
              render={
                <button
                  className="icon-btn"
                  aria-label={liked.has(track.id) ? "取消喜欢" : "喜欢"}
                  aria-pressed={liked.has(track.id)}
                  onClick={() => library.toggleLike(track.id)}
                />
              }
            >
              <HeartIcon size={18} weight={liked.has(track.id) ? "fill" : "regular"} />
            </Tip>
          </>
        ) : (
          <span className="muted">{s.notice || "双击一首歌开始播放"}</span>
        )}
      </div>
      <div className="player__center">
        <div className="player__controls">
          <Tip
            label="上一首"
            id="prev"
            render={<button className="icon-btn" aria-label="上一首" disabled={disabled} onClick={player.prev} />}
          >
            <SkipBackIcon size={18} weight="fill" />
          </Tip>
          <Tip
            label={s.playing ? "暂停" : "播放"}
            id="playPause"
            render={
              <button
                className="play-btn"
                aria-label={s.playing ? "暂停" : "播放"}
                disabled={disabled}
                onClick={player.toggle}
              />
            }
          >
            {s.playing ? <PauseIcon size={18} weight="fill" /> : <PlayIcon size={18} weight="fill" className="translate-x-px" />}
          </Tip>
          <Tip
            label="下一首"
            id="next"
            render={<button className="icon-btn" aria-label="下一首" disabled={disabled} onClick={player.next} />}
          >
            <SkipForwardIcon size={18} weight="fill" />
          </Tip>
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
        <Tip
          label="歌词"
          id="lyrics"
          render={
            <button
              className="icon-btn"
              aria-label="歌词"
              aria-pressed={lyricsOpen}
              disabled={disabled}
              onClick={onToggleLyrics}
            />
          }
        >
          <MicrophoneStageIcon size={18} />
        </Tip>
        <QueuePanel />
        <Tip
          label={muted ? "取消静音" : "静音"}
          render={<button className="icon-btn" aria-label={muted ? "取消静音" : "静音"} onClick={toggleMute} />}
        >
          <Speaker size={18} />
        </Tip>
        <Range value={s.volume} max={1} step={0.01} label="音量" onChange={player.setVolume} />
      </div>
    </footer>
  );
}
