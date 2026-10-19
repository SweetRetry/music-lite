import { SidebarProvider } from "@ncm-lite/ui/components/ui/sidebar";
import { Toaster } from "@ncm-lite/ui/components/ui/sonner";
import { Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
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

export function Shell() {
  const error = useLibrary((s) => s.error);
  const signedOut = useLibrary((s) => s.signedOut);
  const lyricsOpen = useUi((s) => s.lyricsOpen);
  const theme = useTheme((s) => s.theme);
  const hasTrack = usePlayer((s) => s.index >= 0);

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
        {lyricsOpen && hasTrack ? (
          <LyricsView />
        ) : (
          <div className="stage">
            <main className="main">
              <Outlet />
            </main>
          </div>
        )}
        <PlayerBar />
      </div>
      {/* Outside the shell grid, which would give it a cell. Offset clears the player bar. */}
      <Toaster theme={theme} position="bottom-center" offset={104} />
      <PlaylistDialogs />
      <ShortcutsDialog />
    </SidebarProvider>
  );
}
