// The tray menu, the global shortcuts and the desktop lyrics' buttons arrive as "control" events naming an
// action. What is playing, and whether the desktop lyrics are open, go back to label the tray menu.
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { artistNames } from "./format";
import { library } from "./library";
import { player, usePlayer } from "./player";
import { useUi } from "./ui";

const actions: Record<string, () => void> = {
  toggle: player.toggle,
  prev: player.prev,
  next: player.next,
  volumeUp: () => player.adjustVolume(0.1),
  volumeDown: () => player.adjustVolume(-0.1),
  like: () => {
    const { queue, index } = usePlayer.getState();
    if (queue[index]) library.toggleLike(queue[index]);
  },
  desktopLyrics: () => useUi.getState().toggleDesktopLyrics(),
  lyricsBar: () => useUi.getState().setDesktopLyricsMode("bar"),
  lyricsIsland: () => useUi.getState().setDesktopLyricsMode("island"),
};

if (isTauri()) {
  listen<string>("control", (e) => actions[e.payload]?.());

  let shown = "";
  const report = () => {
    const { queue, index, playing } = usePlayer.getState();
    const track = queue[index];
    const title = track ? `${track.name} - ${artistNames(track)}` : null;
    const lyrics = useUi.getState().desktopLyricsOpen;
    const key = `${title}|${playing}|${lyrics}`;
    if (key === shown) return;
    shown = key;
    invoke("now_playing", { title, playing, lyrics }).catch(() => {});
  };
  report();
  usePlayer.subscribe(report);
  useUi.subscribe(report);
}
