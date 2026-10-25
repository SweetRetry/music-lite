// The settings menu at the foot of the sidebar: appearance, and the lyrics that live outside the window.
import { Button } from "@music-lite/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@music-lite/ui/components/ui/dropdown-menu";
import { GearSixIcon } from "@phosphor-icons/react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { useState } from "react";
import { type Theme, useTheme } from "../theme";
import { useUi } from "../ui";
import { Tip } from "./ShortcutKeys";

const THEMES: { theme: Theme; label: string }[] = [
  { theme: "system", label: "跟随系统" },
  { theme: "light", label: "浅色" },
  { theme: "dark", label: "深色" },
];

type Screen = { id: number; name: string };

// The radio value for "the screen with the menu bar".
const MENU_BAR = "menu-bar";

export function SettingsMenu() {
  const { theme, setTheme } = useTheme();
  const ui = useUi();
  // Asked each time the menu opens, so a screen plugged in since shows up.
  const [screens, setScreens] = useState<Screen[]>([]);
  const onOpenChange = (open: boolean) => {
    if (open && isTauri()) invoke<Screen[]>("island_screens").then(setScreens, () => setScreens([]));
  };
  // A remembered screen that is unplugged now: the island is on the menu bar screen, so that is what shows.
  const screenValue = screens.some((s) => s.id === ui.islandScreen) ? String(ui.islandScreen) : MENU_BAR;

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <Tip
        label="设置"
        side="bottom"
        render={
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground" aria-label="设置" />}
          />
        }
      >
        <GearSixIcon />
      </Tip>
      <DropdownMenuContent align="end" side="top">
        <DropdownMenuGroup>
          <DropdownMenuLabel>外观</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={(t) => setTheme(t as Theme)}>
            {THEMES.map((t) => (
              <DropdownMenuRadioItem key={t.theme} value={t.theme}>
                {t.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>歌词</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked={ui.desktopLyricsOpen} onCheckedChange={(on) => ui.toggleDesktopLyrics(on)}>
            桌面歌词
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={ui.islandOpen} onCheckedChange={(on) => ui.toggleIsland(on)}>
            灵动岛
          </DropdownMenuCheckboxItem>
          {screens.length > 1 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>灵动岛显示器</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={screenValue}
                  onValueChange={(v) => ui.setIslandScreen(v === MENU_BAR ? null : Number(v))}
                >
                  <DropdownMenuRadioItem value={MENU_BAR}>跟随菜单栏</DropdownMenuRadioItem>
                  {screens.map((s) => (
                    <DropdownMenuRadioItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
