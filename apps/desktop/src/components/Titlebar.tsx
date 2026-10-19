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
import { Tooltip, TooltipContent, TooltipTrigger } from "@ncm-lite/ui/components/ui/tooltip";
import { useCanGoBack, useRouter } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type Theme, useTheme } from "../theme";
import { Account } from "./Account";

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
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={label} disabled={disabled} onClick={onClick} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function Titlebar() {
  const { history } = useRouter();
  const canBack = useCanGoBack();
  const canForward = useCanGoForward();
  const { theme, setTheme } = useTheme();
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <header
      data-tauri-drag-region
      className="relative z-10 col-span-full row-start-1 flex items-center gap-1 pr-4 pl-24 text-muted-foreground"
    >
      <NavButton label="后退" disabled={!canBack} onClick={() => history.back()}>
        <ChevronLeft />
      </NavButton>
      <NavButton label="前进" disabled={!canForward} onClick={() => history.forward()}>
        <ChevronRight />
      </NavButton>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="外观" />}>
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
      <div className="pl-2">
        <Account />
      </div>
    </header>
  );
}
