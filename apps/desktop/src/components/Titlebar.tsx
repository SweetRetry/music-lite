// Our own title bar. macOS keeps the native traffic lights (titleBarStyle "Overlay"), which sit over
// the sidebar column, so the left padding clears them. The bar itself is the drag region.
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
import { useCanGoBack, useRouter } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type Theme, useTheme } from "../theme";
import type { ShortcutId } from "../shortcuts";
import { SearchBox } from "./SearchBox";
import { Tip } from "./ShortcutKeys";

const themes: { value: Theme; label: string }[] = [
  { value: "system", label: "跟随系统" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
];

const index = (h: { location: { state: { __TSR_index?: number } } }) => h.location.state.__TSR_index ?? 0;

// The router only tracks whether it can go back. Forward is possible while we are below the furthest
// entry reached, and a push drops everything ahead.
function useCanGoForward() {
  const { history } = useRouter();
  const furthest = useRef(index(history));
  const [can, setCan] = useState(false);
  useEffect(
    () =>
      history.subscribe(({ action }) => {
        const now = index(history);
        furthest.current = action.type === "PUSH" ? now : Math.max(furthest.current, now);
        setCan(now < furthest.current);
      }),
    [history],
  );
  return can;
}

function NavButton({
  label,
  id,
  disabled,
  onClick,
  children,
}: {
  label: string;
  id: ShortcutId;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tip
      label={label}
      id={id}
      side="bottom"
      render={<Button variant="ghost" size="icon-sm" aria-label={label} disabled={disabled} onClick={onClick} />}
    >
      {children}
    </Tip>
  );
}

export function Titlebar() {
  const { history } = useRouter();
  const canBack = useCanGoBack();
  const canForward = useCanGoForward();
  const { theme, setTheme } = useTheme();
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  // Subgrid over the shell's two columns: history sits over the sidebar, search centres over the content.
  // Drag regions do not inherit, so every empty container carries the attribute.
  return (
    <header
      data-tauri-drag-region
      className="relative z-10 col-span-full row-start-1 grid grid-cols-subgrid items-center text-muted-foreground"
    >
      <div data-tauri-drag-region className="flex h-full items-center gap-1 pl-24">
        <NavButton label="后退" id="back" disabled={!canBack} onClick={() => history.back()}>
          <ChevronLeft />
        </NavButton>
        <NavButton label="前进" id="forward" disabled={!canForward} onClick={() => history.forward()}>
          <ChevronRight />
        </NavButton>
      </div>
      <div data-tauri-drag-region className="grid h-full grid-cols-[1fr_minmax(0,28rem)_1fr] items-center gap-4 px-12">
        <div data-tauri-drag-region className="h-full" />
        <SearchBox />
        <div data-tauri-drag-region className="flex h-full items-center justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="外观" />}>
              <Icon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuGroup>
                <DropdownMenuLabel>外观</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
                  {themes.map((t) => (
                    <DropdownMenuRadioItem key={t.value} value={t.value}>
                      {t.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
