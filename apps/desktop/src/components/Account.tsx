import { Avatar, AvatarFallback, AvatarImage } from "@ncm-lite/ui/components/ui/avatar";
import { Badge } from "@ncm-lite/ui/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ncm-lite/ui/components/ui/tooltip";
import { vip as fetchVip } from "../api/vip";
import { cover } from "../format";
import { useLibrary } from "../library";
import { useCached } from "./states";
import { ThemeToggle } from "./ThemeToggle";

// Keyed by uid at the call site, so an account switch remounts it and reads the (cleared) cache afresh.
// A failed lookup just means no badge.
function VipBadge() {
  const { data: vip } = useCached("vip", fetchVip);
  if (!vip) return null;
  return (
    <Tooltip>
      <TooltipTrigger render={<Badge variant="secondary" className="shrink-0" />}>{vip.name}</TooltipTrigger>
      <TooltipContent>{new Date(vip.expireMs).toLocaleDateString("zh-CN")} 到期</TooltipContent>
    </Tooltip>
  );
}

export function Account() {
  const me = useLibrary((s) => s.me);
  if (!me) return null;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="size-7">
        <AvatarImage src={cover(me.avatar, 24)} alt="" />
        <AvatarFallback>{me.nickname.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <span className="truncate text-sm font-medium text-foreground">{me.nickname}</span>
      <VipBadge key={me.uid} />
      <span className="ml-auto" />
      <ThemeToggle />
    </div>
  );
}
