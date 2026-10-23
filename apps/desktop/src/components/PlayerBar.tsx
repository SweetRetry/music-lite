import {
  CaretDownIcon,
  CaretUpIcon,
  MusicNotesIcon,
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
import { useIsHere, useProvider } from "../providers";
import { Artists } from "./Artists";
import { LikeHeart } from "./LikeHeart";
import { QualityMenu } from "./player/QualityMenu";
import { QueuePanel } from "./player/QueuePanel";
import { PlaybackModeMenu } from "./player/PlaybackModeMenu";
import { Range } from "./Range";
import { Tip } from "./ShortcutKeys";

export function PlayerBar() {
  const s = usePlayer();
  const liked = useLibrary((l) => l.liked);
  const { lyricsOpen, toggleLyrics } = useUi();
  // Lyrics take the whole window, and the bar floats over them. Without a song there are no lyrics to show.
  const immersive = lyricsOpen && !!s.queue[s.index];
  const onToggleLyrics = () => toggleLyrics();
  const track = s.queue[s.index];
  const disabled = !track;
  // A song playing on from the other service has no heart or sound quality in this library.
  const here = useIsHere(track);
  const service = useProvider();
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
    <footer className="player" data-immersive={immersive || undefined}>
      <div className="player__track">
        {track ? (
          <>
            {/* Hover dims the cover and shows which way it opens, press shrinks it, focus rings it. */}
            <button
              className="player__cover group relative cursor-pointer transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label={lyricsOpen ? "收起歌词" : "展开歌词"}
              onClick={onToggleLyrics}
            >
              <img src={cover(track.cover, 44)} alt="" />
              <span className="absolute inset-0 grid place-items-center rounded-[inherit] bg-background/60 text-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                {lyricsOpen ? <CaretDownIcon weight="bold" /> : <CaretUpIcon weight="bold" />}
              </span>
            </button>
            <div className="player__names">
              <span>{track.name}</span>
              <span className="muted">{s.notice || <Artists artists={track.artists} src={track.src} />}</span>
            </div>
            {here && (
            <Tip
              label={liked.has(track.id) ? "取消喜欢" : "喜欢"}
              id="like"
              render={
                <button
                  className="icon-btn"
                  aria-label={liked.has(track.id) ? "取消喜欢" : "喜欢"}
                  aria-pressed={liked.has(track.id)}
                  onClick={() => library.toggleLike(track)}
                />
              }
            >
              <LikeHeart key={track.id} size={18} liked={liked.has(track.id)} />
            </Tip>
            )}
          </>
        ) : (
          // An empty slot the size of the cover, so the bar keeps its shape. A notice still speaks.
          s.notice ? (
            <span className="muted">{s.notice}</span>
          ) : (
            <div className="flex items-center gap-3" aria-hidden>
              <div className="grid size-12 place-items-center rounded-md bg-foreground/5 text-muted-foreground/60">
                <MusicNotesIcon size={22} />
              </div>
            </div>
          )
        )}
      </div>
      <div className="player__center">
        <div className="player__controls relative">
          <div className="absolute right-full mr-3"><PlaybackModeMenu /></div>
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
        {here && service.qualities.length > 0 && <QualityMenu />}
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
