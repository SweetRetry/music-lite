import { Avatar, AvatarFallback, AvatarImage } from "@music-lite/ui/components/ui/avatar";
import { Badge } from "@music-lite/ui/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@music-lite/ui/components/ui/dropdown-menu";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Me } from "../api";
import type { Vip } from "../api/vip";
import { peek } from "../cache";
import { cover } from "../format";
import { library, useLibrary } from "../library";
import { isProviderId, PROVIDER_IDS, type ProviderId, scoped, useMode } from "../mode";
import { providers, useProvider } from "../providers";
import { requestQqAccess, useQqAccess } from "../qqapi";
import { toast } from "sonner";
import { useCached } from "./states";
import { ThemeToggle } from "./ThemeToggle";

// Both the service and account own the membership cache.
function Membership({ id, uid, load }: { id: ProviderId; uid: number; load: () => Promise<Vip | null> }) {
  const { data: vip } = useCached(scoped(`vip:${uid}`, id), load);
  if (!vip || vip.expireMs <= Date.now()) return null;
  return (
    <>
      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{vip.name}</Badge>
      <time dateTime={new Date(vip.expireMs).toISOString()} title={`${new Date(vip.expireMs).toLocaleString("zh-CN")} 到期`} className="text-[10px] whitespace-nowrap text-muted-foreground tabular-nums">
        {new Date(vip.expireMs).toLocaleDateString("zh-CN")} 到期
      </time>
    </>
  );
}

// The accounts of every service, one row each. The one on screen is checked. A service with no account yet is
// a way to sign in: NetEase opens its sign-in, and a service that borrows its client's login waits for that.
function Accounts() {
  const mode = useMode((s) => s.mode);
  const me = useLibrary((s) => s.me);
  const navigate = useNavigate();
  const needsAccess = useQqAccess((s) => s.denied);
  // Services whose client is signed out, so there is no login to borrow. The menu mounts when it opens, so
  // this looks again each time.
  const [away, setAway] = useState<Partial<Record<ProviderId, string>>>({});
  useEffect(() => {
    for (const id of PROVIDER_IDS) {
      const login = providers[id].borrowedLogin;
      login?.signedIn().then(
        (ok) => !ok && setAway((a) => ({ ...a, [id]: login.hint })),
        (e) => setAway((a) => ({ ...a, [id]: e instanceof Error ? e.message : String(e) })),
      );
    }
  }, []);
  const accountOf = (id: (typeof PROVIDER_IDS)[number]) => (id === mode ? me : peek<Me>(scoped("me", id)));
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>账号</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={mode}
        onValueChange={(next) => {
          if (!isProviderId(next) || next === mode) return;
          navigate({ to: "/" });
          library.enter(next);
        }}
      >
        {PROVIDER_IDS.map((id) => {
          const account = accountOf(id);
          const unavailable = away[id];
          return (
            <DropdownMenuRadioItem key={id} value={id} disabled={!!unavailable} title={unavailable}>
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{account?.nickname ?? providers[id].short}</span>
                <span className="max-w-64 text-xs whitespace-normal text-muted-foreground">
                  {unavailable || (account ? providers[id].short : "未登录")}
                </span>
              </span>
            </DropdownMenuRadioItem>
          );
        })}
      </DropdownMenuRadioGroup>
      {needsAccess && (
        <DropdownMenuItem onClick={async () => {
          try {
            if (await requestQqAccess()) {
              navigate({ to: "/" });
              await library.enter("qq");
            }
          } catch (e) { toast.error((e as Error).message); }
        }}>
          授权 QQ 音乐
        </DropdownMenuItem>
      )}
    </DropdownMenuGroup>
  );
}

export function Account() {
  const me = useLibrary((s) => s.me);
  const { id, vip } = useProvider();
  if (!me) return null;
  const avatar = (
    <Avatar className="size-9">
      <AvatarImage src={cover(me.avatar, 36)} alt="" />
      <AvatarFallback>{me.nickname.slice(0, 1)}</AvatarFallback>
    </Avatar>
  );
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {/* The avatar opens the account menu. */}
      <DropdownMenu>
        <DropdownMenuTrigger className="shrink-0 rounded-full" aria-label="账号">
          {avatar}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top">
          <Accounts />
        </DropdownMenuContent>
      </DropdownMenu>
      {/* The membership sits under the name, so a long nickname keeps the whole row. */}
      <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <span className="w-full truncate text-sm font-medium text-foreground">{me.nickname}</span>
        {vip && <Membership id={id} uid={me.uid} load={vip} />}
      </div>
      <ThemeToggle />
    </div>
  );
}
