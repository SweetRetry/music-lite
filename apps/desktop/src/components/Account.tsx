import { Avatar, AvatarFallback, AvatarImage } from "@ncm-lite/ui/components/ui/avatar";
import { Badge } from "@ncm-lite/ui/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@ncm-lite/ui/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ncm-lite/ui/components/ui/tooltip";
import { useNavigate } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import type { Me } from "../api";
import { vip as fetchVip } from "../api/vip";
import { peek } from "../cache";
import { cover } from "../format";
import { library, useLibrary } from "../library";
import { isProviderId, PROVIDER_IDS, scoped, useMode } from "../mode";
import { providers, useProvider } from "../providers";
import { useCached } from "./states";
import { ThemeToggle } from "./ThemeToggle";

// Keyed by uid at the call site, so an account switch remounts it and reads the (cleared) cache afresh.
// A failed lookup just means no badge.
function VipBadge() {
  const { data: vip } = useCached("vip", fetchVip);
  if (!vip) return null;
  return (
    <Tooltip>
      <TooltipTrigger render={<Badge variant="secondary" className="h-4 px-1.5 text-[10px]" />}>{vip.name}</TooltipTrigger>
      <TooltipContent>{new Date(vip.expireMs).toLocaleDateString("zh-CN")} 到期</TooltipContent>
    </Tooltip>
  );
}

// The accounts of every service, one row each. The one on screen is checked. A service with no account yet is
// a way to sign in: NetEase opens its sign-in, and QQ Music, which borrows its client's login, waits for that.
function Accounts() {
  const mode = useMode((s) => s.mode);
  const me = useLibrary((s) => s.me);
  const navigate = useNavigate();
  // Whether QQ Music's client is signed in, looked up each time the menu opens.
  const [qqSignedIn, setQqSignedIn] = useState<boolean | undefined>();
  // The menu mounts when it opens, so this looks again each time.
  useEffect(() => {
    invoke<string | null>("qq_login").then(
      (uin) => setQqSignedIn(!!uin),
      () => setQqSignedIn(false),
    );
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
          const unavailable = id === "qq" && qqSignedIn === false;
          return (
            <DropdownMenuRadioItem key={id} value={id} disabled={unavailable}>
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{account?.nickname ?? providers[id].short}</span>
                <span className="text-xs text-muted-foreground">
                  {unavailable ? "请先登录 QQ 音乐客户端" : account ? providers[id].short : "未登录"}
                </span>
              </span>
            </DropdownMenuRadioItem>
          );
        })}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  );
}

export function Account() {
  const me = useLibrary((s) => s.me);
  const can = useProvider().can;
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
        {can.vip && <VipBadge key={me.uid} />}
      </div>
      <ThemeToggle />
    </div>
  );
}
