// Sound quality picker. The trigger shows what is really playing, which can be below the chosen level.
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
import { isQuality, QUALITIES, qualityLabel, rank } from "../../api/quality";
import { player, usePlayer } from "../../player";

export function QualityMenu() {
  const quality = usePlayer((s) => s.quality);
  const source = usePlayer((s) => s.source);
  const lowered = !!source && rank(source.level) >= 0 && rank(source.level) < rank(quality);
  const shown = lowered ? source.level : quality;
  return (
    <DropdownMenu>
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
            {QUALITIES.map((q) => (
              <DropdownMenuRadioItem key={q.level} value={q.level}>
                {q.label}
              </DropdownMenuRadioItem>
            ))}
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
