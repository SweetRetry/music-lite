// Every page is a route. Hash history, because the packaged app loads from a file-like origin.
import { createHashHistory, createRootRoute, createRoute, createRouter, Navigate } from "@tanstack/react-router";
import { Shell } from "./App";
import { AlbumView } from "./views/Album";
import { ArtistView } from "./views/Artist";
import { DailyView } from "./views/Daily";
import { LikedView, PlaylistView } from "./views/Playlist";
import { SearchView } from "./views/Search";
import { useMode } from "./mode";
import { useProvider } from "./providers";
import { useUi } from "./ui";

const id = {
  parse: (p: { id: string }) => ({ id: Number(p.id) }),
  stringify: (p: { id: number }) => ({ id: String(p.id) }),
};

const root = createRootRoute({ component: Shell });

// Services without daily recommendations open on the library.
function Home() {
  return useProvider().can.daily ? <DailyView /> : <Navigate to="/liked" replace />;
}

const routes = [
  createRoute({ getParentRoute: () => root, path: "/", component: Home }),
  createRoute({ getParentRoute: () => root, path: "/liked", component: LikedView }),
  createRoute({
    getParentRoute: () => root,
    path: "/playlist/$id",
    params: id,
    component: function Playlist() {
      const { id } = playlistRoute.useParams();
      return <PlaylistView key={id} id={id} />;
    },
  }),
  createRoute({
    getParentRoute: () => root,
    path: "/search",
    validateSearch: (s: Record<string, unknown>) => ({ q: String(s.q ?? "") }),
    component: function Search() {
      const { q } = searchRoute.useSearch();
      return <SearchView key={q} q={q} />;
    },
  }),
  createRoute({
    getParentRoute: () => root,
    path: "/artist/$id",
    component: function Artist() {
      const { id } = artistRoute.useParams();
      return <ArtistView key={id} id={id} />;
    },
  }),
  createRoute({
    getParentRoute: () => root,
    path: "/album/$id",
    component: function Album() {
      const { id } = albumRoute.useParams();
      return <AlbumView key={id} id={id} />;
    },
  }),
] as const;

const [, , playlistRoute, searchRoute, artistRoute, albumRoute] = routes;

// A launch opens the page the last one closed on. The window always starts at index.html with no hash.
const pageKey = () => `page:${useMode.getState().mode}`;
try {
  const page = localStorage.getItem(pageKey()) ?? (useMode.getState().mode === "ncm" ? localStorage.getItem("page") : null);
  if (page && !location.hash) location.hash = page;
} catch {}

export const router = createRouter({
  routeTree: root.addChildren(routes),
  history: createHashHistory(),
});

// Leaving a page closes the lyrics that cover it. The first load has no page to leave, so restored lyrics stay.
router.subscribe("onBeforeNavigate", (e) => e.fromLocation && useUi.getState().toggleLyrics(false));
router.subscribe("onResolved", (e) => {
  try {
    localStorage.setItem(pageKey(), e.toLocation.href);
  } catch {}
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
