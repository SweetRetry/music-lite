import { Badge } from "@ncm-lite/ui/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ncm-lite/ui/components/ui/tooltip";
import { useEffect, useState } from "react";
import { vip as fetchVip, type Vip } from "../api/vip";
import { cover } from "../format";
import { useLibrary } from "../library";

export function Account() {
  const me = useLibrary((s) => s.me);
  const uid = me?.uid;
  const [vip, setVip] = useState<Vip | null>(null);
  // A failed lookup just means no badge.
  useEffect(() => {
    if (uid === undefined) return;
    let stale = false;
    fetchVip()
      .then((v) => !stale && setVip(v))
      .catch(() => !stale && setVip(null));
    return () => {
      stale = true;
    };
  }, [uid]);
  if (!me) return null;
  return (
    <div className="sidebar__me">
      <img src={cover(me.avatar, 24)} alt="" />
      <span>{me.nickname}</span>
      {vip && (
        <Tooltip>
          <TooltipTrigger render={<Badge variant="secondary" className="shrink-0" />}>{vip.name}</TooltipTrigger>
          <TooltipContent>{new Date(vip.expireMs).toLocaleDateString("zh-CN")} 到期</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
