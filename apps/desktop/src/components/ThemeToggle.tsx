// One click steps through the three modes. The icon shows the mode in effect, the tooltip names it.
import { Button } from "@music-lite/ui/components/ui/button";
import { DesktopIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import { type Theme, useTheme } from "../theme";
import { Tip } from "./ShortcutKeys";

const modes: Record<Theme, { next: Theme; label: string; Icon: typeof SunIcon }> = {
  system: { next: "light", label: "跟随系统", Icon: DesktopIcon },
  light: { next: "dark", label: "浅色", Icon: SunIcon },
  dark: { next: "system", label: "深色", Icon: MoonIcon },
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { next, label, Icon } = modes[theme];
  return (
    <Tip
      label={`外观：${label}`}
      side="bottom"
      render={
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground"
          aria-label={`外观：${label}，点击切换为${modes[next].label}`}
          onClick={() => setTheme(next)}
        />
      }
    >
      <Icon />
    </Tip>
  );
}
