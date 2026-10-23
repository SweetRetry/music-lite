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
import { RepeatIcon, RepeatOnceIcon, ShuffleIcon } from "@phosphor-icons/react";
import { PLAYBACK_MODES, player, usePlayer } from "../../player";
import { Tip } from "../ShortcutKeys";

const icons = { "repeat-one": RepeatOnceIcon, "repeat-all": RepeatIcon, shuffle: ShuffleIcon };

export function PlaybackModeMenu() {
  const mode = usePlayer((s) => s.playbackMode);
  const label = PLAYBACK_MODES.find((option) => option.mode === mode)!.label;
  const Icon = icons[mode];
  return (
    <DropdownMenu>
      <Tip
        label={label}
        render={<DropdownMenuTrigger render={
          <Button variant="ghost" size="icon-sm" className={mode === "repeat-all" ? "text-muted-foreground" : "text-primary"}
            aria-label={`播放方式：${label}`} />
        } />}
      >
        <Icon size={18} />
      </Tip>
      <DropdownMenuContent side="top" align="end" sideOffset={12} className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>播放方式</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={mode} onValueChange={(value) => {
            const option = PLAYBACK_MODES.find((option) => option.mode === value);
            if (option) player.setPlaybackMode(option.mode);
          }}>
            {PLAYBACK_MODES.map(({ mode: value, label }) => {
              const ModeIcon = icons[value];
              return <DropdownMenuRadioItem key={value} value={value}><ModeIcon size={16} />{label}</DropdownMenuRadioItem>;
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
