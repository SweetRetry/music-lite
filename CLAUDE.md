# NCM Lite

A lightweight NetEase Cloud Music desktop client. Tauri 2 + React 19, pnpm + turborepo.

## Layout

- `apps/desktop/src-tauri` is the Rust native layer. It exposes one command, `eapi(path, body)`, which signs and sends any NetEase `/api/...` call with the official client's login. New features never need Rust changes.
- `apps/desktop/src/api.ts` normalizes raw NetEase payloads into `Track`, `Playlist`, `Me`. Add feature endpoints in `src/api/<feature>.ts`, reusing `toTrack`, `toSummary`, `songDetails`, `https`.
- `apps/desktop/src/router.tsx` holds every route (TanStack Router, code-based, hash history). Navigate with `<Link to="/artist/$id" params={{ id }}>` or `useNavigate`.
- State lives in zustand stores: `library.ts` (account, playlists, liked), `player.ts` (queue, audio), `ui.ts` (non-route view state).
- `packages/ui` holds shadcn (Base UI, base-nova) components and the theme tokens in `src/styles/globals.css`.

## Conventions

- Use a shadcn component wherever one fits (Button, Dialog, DropdownMenu, Sheet, Popover, Tooltip, Badge, Avatar, ScrollArea, Skeleton, ...). Do not build your own. Hand-roll only when shadcn has nothing for it.
- Add UI components only with the shadcn CLI, run inside `packages/ui`: `pnpm dlx shadcn@latest add <name>`. Never hand-write them. Import as `@ncm-lite/ui/components/ui/<name>`.
- Existing screens use the plain CSS in `apps/desktop/src/styles.css` with the Retry tokens. New UI uses Tailwind utilities and shadcn components with the same tokens (`bg-background`, `text-muted-foreground`, `border-border`).
- Official endpoints declared with `nginxCache` (`/api/album/v3/detail`, `/api/artist/v3/detail`, `/api/playlist/v4/detail`) need a `cache_key` signed by the official native layer and return 400 without it. Use the v1 equivalents (`/api/v1/album/{id}`, `/api/v1/artist/{id}`, `/api/v6/playlist/detail`).
- NetEase hands out `http://` media URLs. Pass every image or audio URL through `https()` from `api.ts`.
- UI copy is Simplified Chinese, short and plain.
- Verify with `pnpm typecheck`. Do not run `tauri dev` or `tauri build` unless asked; the Rust build is heavy.
