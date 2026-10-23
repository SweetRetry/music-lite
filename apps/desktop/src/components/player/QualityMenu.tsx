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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ncm-lite/ui/components/ui/dropdown-menu";
import { LockSimpleIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { Privilege } from "../../api/privilege";
import { isQuality, qualityFor, qualityLabel, rank, RATE, VIP_LEVELS } from "../../api/quality";
import { player, usePlayer } from "../../player";
import { providerOf, useProvider } from "../../providers";
import type { Track } from "../../api";

// Per song, fetched on first open (not on every track change, most songs never get their menu opened).
function useSongPrivilege(open: boolean) {
  const track = usePlayer((s) => s.queue[s.index]);
  const [got, setGot] = useState<{ track: Track; p: Privilege | null }>();
  useEffect(() => {
    if (!open || !track) return;
    let stale = false;
    providerOf(track).privilege?.(track).catch(() => null).then((p) => !stale && setGot({ track, p }));
    return () => {
      stale = true;
    };
  }, [open, track]);
  return got?.track === track ? got?.p ?? null : null;
}

export function QualityMenu() {
  const [open, setOpen] = useState(false);
  const song = useSongPrivilege(open);
  const { qualities } = useProvider();
  const preferred = usePlayer((s) => s.quality);
  const quality = qualityFor(preferred, qualities);
  const source = usePlayer((s) => s.source);
  const lowered = !!source && rank(source.level) >= 0 && rank(source.level) < rank(quality);
  const shown = source?.level ?? quality;
  const label = (level: string) => qualities.find((q) => q.level === level)?.label ?? qualityLabel(level);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="min-w-12 px-1.5 text-muted-foreground"
            aria-label={`音质：${label(shown)}`}
          />
        }
      >
        {label(shown)}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" sideOffset={12} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>音质</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={quality} onValueChange={(v) => isQuality(v) && player.setQuality(v)}>
            {qualities.map((q) => {
              // Without song data fall back to what is true for any song.
              const access = song?.[q.level] ?? "ok";
              const vip = access === "vip" || (!song && VIP_LEVELS.has(q.level));
              return (
                <DropdownMenuRadioItem
                  key={q.level}
                  value={q.level}
                  disabled={access === "none"}
                  className={access !== "ok" ? "opacity-60" : undefined}
                  title={access === "none" ? "这首歌没有此音质" : undefined}
                >
                  <span className="whitespace-nowrap">{q.label}</span>
                  {vip && (
                    <Badge variant="outline" className="h-4 gap-0.5 px-1 text-[10px] text-primary">
                      {access === "vip" && <LockSimpleIcon weight="bold" />}VIP
                    </Badge>
                  )}
                  {/* Said as a rate where the server names one, and as "没有" where this song has no such file. */}
                  <span className="ml-auto text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                    {access === "none" ? "没有" : RATE[q.level] < 999000 ? `${RATE[q.level] / 1000} kbps` : ""}
                  </span>
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
          {source && (
            <>
              <DropdownMenuSeparator />
              <div className="px-1.5 py-1 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                {lowered ? "已降级为" : "正在播放"} {label(source.level)}
                {source.br > 0 && ` · ${Math.round(source.br / 1000)} kbps`}
              </div>
            </>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
