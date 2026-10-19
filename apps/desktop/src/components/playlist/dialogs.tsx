// Create, rename and delete dialogs. They open from menus that close (and unmount) on click, so
// one host renders them and any menu opens them with openPlaylistDialog.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@ncm-lite/ui/components/ui/alert-dialog";
import { Button } from "@ncm-lite/ui/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ncm-lite/ui/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@ncm-lite/ui/components/ui/field";
import { Input } from "@ncm-lite/ui/components/ui/input";
import { Switch } from "@ncm-lite/ui/components/ui/switch";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { create } from "zustand";
import type { PlaylistSummary } from "../../api";
import { reason } from "../../api/playlists";
import { library } from "../../library";

type Request =
  // onCreated replaces the default of opening the new playlist.
  | { kind: "create"; onCreated?: (id: number, name: string) => void }
  | { kind: "rename"; playlist: PlaylistSummary }
  | { kind: "delete"; playlist: PlaylistSummary };

const useRequest = create<{ request: Request | null }>(() => ({ request: null }));

export const openPlaylistDialog = (request: Request) => useRequest.setState({ request });
const close = () => useRequest.setState({ request: null });

export const failed = (what: string, e: unknown) => {
  const why = reason(e);
  toast.error(why && why !== "unknown" ? `${what}。${why}` : what);
};

export function PlaylistDialogs() {
  const request = useRequest((s) => s.request);
  return (
    <>
      <NameDialog request={request} />
      <DeleteDialog request={request?.kind === "delete" ? request : null} />
    </>
  );
}

function NameDialog({ request }: { request: Request | null }) {
  const open = request?.kind === "create" || request?.kind === "rename";
  const renaming = request?.kind === "rename" ? request.playlist : null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-sm">
        {/* Mounted only while open, so every opening starts with fresh form state. */}
        {open && <NameForm key={renaming?.id ?? "new"} request={request} />}
      </DialogContent>
    </Dialog>
  );
}

function NameForm({ request }: { request: Request }) {
  const renaming = request.kind === "rename" ? request.playlist : null;
  const navigate = useNavigate();
  const [name, setName] = useState(renaming?.name ?? "");
  const [isPrivate, setPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const trimmed = name.trim();
  const unchanged = renaming ? trimmed === renaming.name : false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed || unchanged || busy) return;
    setBusy(true);
    setError("");
    try {
      if (renaming) {
        await library.renamePlaylist(renaming.id, trimmed);
      } else {
        const id = await library.createPlaylist(trimmed, isPrivate);
        if (request.kind === "create" && request.onCreated) request.onCreated(id, trimmed);
        else navigate({ to: "/playlist/$id", params: { id } });
      }
      close();
    } catch (err) {
      const why = reason(err);
      setError(why && why !== "unknown" ? why : renaming ? "没能改名，稍后再试。" : "没能新建，稍后再试。");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{renaming ? "重命名" : "新建歌单"}</DialogTitle>
      </DialogHeader>
      <FieldGroup>
        <Field data-invalid={!!error || undefined}>
          <FieldLabel htmlFor="playlist-name">歌单名</FieldLabel>
          <Input
            id="playlist-name"
            autoFocus
            maxLength={40}
            value={name}
            placeholder="输入歌单名"
            aria-invalid={!!error || undefined}
            onChange={(e) => setName(e.target.value)}
          />
          {error && <FieldError>{error}</FieldError>}
        </Field>
        {!renaming && (
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="playlist-private">隐私歌单</FieldLabel>
              <FieldDescription>只有你能看到</FieldDescription>
            </FieldContent>
            <Switch id="playlist-private" checked={isPrivate} onCheckedChange={setPrivate} />
          </Field>
        )}
      </FieldGroup>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" type="button" />}>取消</DialogClose>
        <Button type="submit" disabled={!trimmed || unchanged || busy}>
          {renaming ? "保存" : "新建"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeleteDialog({ request }: { request: Extract<Request, { kind: "delete" }> | null }) {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (l) => l.pathname });
  const [busy, setBusy] = useState(false);
  const playlist = request?.playlist;

  async function confirm() {
    if (!playlist || busy) return;
    setBusy(true);
    try {
      await library.deletePlaylist(playlist.id);
      if (pathname === `/playlist/${playlist.id}`) navigate({ to: "/" });
      toast.success("已删除歌单");
      close();
    } catch (e) {
      failed("没能删除歌单", e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={!!request} onOpenChange={(o) => !o && close()}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>删除歌单</AlertDialogTitle>
          <AlertDialogDescription>确定删除「{playlist?.name}」吗？删除后无法恢复。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={busy} onClick={confirm}>
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
