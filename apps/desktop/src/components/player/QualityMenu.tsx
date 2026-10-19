// Sound quality picker. The trigger shows what is really playing, which can be below the chosen level.
import { Badge } from "@ncm-lite/ui/components/ui/badge";
import { Button } from "@ncm-lite/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@ncm-lite/ui/components/ui/dropdown-menu";
import { LockSimpleIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { privilege, type Privilege } from "../../api/privilege";
import { isQuality, QUALITIES, qualityLabel, rank, VIP_LEVELS } from "../../api/quality";
import { player, usePlayer } from "../../player";

// Per song, fetched on first open (not on every track change, most songs never get their menu opened).
function useSongPrivilege(open: boolean) {
  const id = usePlayer((s) => s.queue[s.index]?.id);
  const [got, setGot] = useState<{ id: number; p: Privilege | null }>();
  useEffect(() => {
    if (!open || id === undefined) return;
    let stale = false;
    privilege(id).then((p) => !stale && setGot({ id, p }));
    return () => {
      stale = true;
    };
  }, [open, id]);
  // With an empty queue id is undefined, and got?.id === id would hold before anything loads.
  return got && got.id === id ? got.p : null;
}

export function QualityMenu() {
  const [open, setOpen] = useState(false);
  const song = useSongPrivilege(open);
  const quality = usePlayer((s) => s.quality);
  const source = usePlayer((s) => s.source);
  const lowered = !!source && rank(source.level) >= 0 && rank(source.level) < rank(quality);
  const shown = lowered ? source.level : quality;
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="min-w-12 px-1.5 text-muted-foreground"
            aria-label={`音质：${qualityLabel(shown)}`}
          />
        }
      >
        {qualityLabel(shown)}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" sideOffset={12} className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>音质</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={quality} onValueChange={(v) => isQuality(v) && player.setQuality(v)}>
            {QUALITIES.map((q) => {
              // Without song data fall back to what is true for any song.
              const access = song?.[q.level] ?? "ok";
              const vip = access === "vip" || (!song && VIP_LEVELS.has(q.level));
              return (
                <DropdownMenuRadioItem
                  key={q.level}
                  value={q.level}
                  className={access !== "ok" ? "opacity-60" : undefined}
                  title={access === "none" ? "这首歌没有此音质" : undefined}
                >
                  {q.label}
                  {vip && (
                    <Badge variant="outline" className="h-4 gap-0.5 px-1 text-[10px] text-primary">
                      {access === "vip" && <LockSimpleIcon weight="bold" />}VIP
                    </Badge>
                  )}
                  {access === "none" && <span className="text-xs text-muted-foreground">无</span>}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
          {source && (
            <DropdownMenuLabel className="border-t border-border pt-2">
              {lowered ? "这首歌实际播放" : "正在播放"} {qualityLabel(source.level)}
              {source.br > 0 && ` · ${Math.round(source.br / 1000)}kbps`}
            </DropdownMenuLabel>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
