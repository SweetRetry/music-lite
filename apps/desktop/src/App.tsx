import { SidebarProvider } from "@ncm-lite/ui/components/ui/sidebar";
import { Toaster } from "@ncm-lite/ui/components/ui/sonner";
import { Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PlayerBar } from "./components/PlayerBar";
import { PlaylistDialogs } from "./components/playlist/dialogs";
import { ShortcutsDialog } from "./components/ShortcutsDialog";
import { Sidebar } from "./components/Sidebar";
import { Fatal } from "./components/states";
import { Titlebar } from "./components/Titlebar";
import { useLibrary } from "./library";
import { usePlayer } from "./player";
import { useShortcuts } from "./shortcuts";
import { useTheme } from "./theme";
import { useUi } from "./ui";
import { LoginView } from "./views/Login";
import { LyricsView } from "./views/Lyrics";

// True while open, and for `ms` after it closes, so an exit transition has an element to run on.
function useLingering(open: boolean, ms: number) {
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => setPresent(false), ms);
    return () => clearTimeout(t);
  }, [open, ms]);
  return present;
}

export function Shell() {
  const error = useLibrary((s) => s.error);
  const signedOut = useLibrary((s) => s.signedOut);
  const lyricsOpen = useUi((s) => s.lyricsOpen);
  const theme = useTheme((s) => s.theme);
  const hasTrack = usePlayer((s) => s.index >= 0);
  const lyrics = lyricsOpen && hasTrack;
  // Matches the lyrics' exit transition in styles.css.
  const lyricsMounted = useLingering(lyrics, 150);

  useEffect(() => {
    useLibrary.getState().load();
  }, []);

  useShortcuts();

  if (error) return <Fatal message={error} />;
  if (signedOut) return <LoginView />;

  return (
    // The provider only supplies sidebar context and --sidebar-width; `contents` keeps it out of the grid.
    <SidebarProvider open className="contents">
      <div className="shell">
        <Titlebar />
        <Sidebar />
        {/* The page stays mounted under the lyrics: they fade over it, and closing them returns to the same scroll. */}
        <div className="stage" inert={lyrics}>
          <main className="main">
            <Outlet />
          </main>
        </div>
        {lyricsMounted && <LyricsView closing={!lyrics} />}
        <PlayerBar />
      </div>
      {/* Outside the shell grid, which would give it a cell. Offset clears the player bar. */}
      <Toaster theme={theme} position="bottom-center" offset={104} />
      <PlaylistDialogs />
      <ShortcutsDialog />
    </SidebarProvider>
  );
}
