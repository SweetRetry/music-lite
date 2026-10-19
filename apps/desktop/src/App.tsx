import { SidebarProvider } from "@ncm-lite/ui/components/ui/sidebar";
import { Toaster } from "@ncm-lite/ui/components/ui/sonner";
import { Outlet } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";
import { PlayerBar } from "./components/PlayerBar";
import { PlaylistDialogs } from "./components/playlist/dialogs";
import { Sidebar } from "./components/Sidebar";
import { Fatal } from "./components/states";
import { Titlebar } from "./components/Titlebar";
import { useLibrary } from "./library";
import { usePlayerShortcuts } from "./player";
import { useTheme } from "./theme";
import { useUi } from "./ui";
import { LyricsView } from "./views/Lyrics";

export function Shell() {
  const error = useLibrary((s) => s.error);
  const { lyricsOpen, toggleLyrics } = useUi();
  const searchRef = useRef<HTMLInputElement>(null);
  const theme = useTheme((s) => s.theme);

  useEffect(() => {
    useLibrary.getState().load();
  }, []);

  usePlayerShortcuts(useCallback(() => searchRef.current?.focus(), []));

  useEffect(() => {
    if (!lyricsOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && toggleLyrics(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lyricsOpen]);

  if (error) return <Fatal message={error} />;

  return (
    // The provider only supplies sidebar context and --sidebar-width; `contents` keeps it out of the grid.
    <SidebarProvider className="contents">
      <div className="shell">
        <Titlebar />
        <Sidebar searchRef={searchRef} />
        {lyricsOpen ? (
          <LyricsView />
        ) : (
          <main className="main">
            <Outlet />
          </main>
        )}
        <PlayerBar />
      </div>
      {/* Outside the shell grid, which would give it a cell. Offset clears the player bar. */}
      <Toaster theme={theme} position="bottom-center" offset={104} />
      <PlaylistDialogs />
    </SidebarProvider>
  );
}
