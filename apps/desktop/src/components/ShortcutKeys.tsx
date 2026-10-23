// Draws a chord from the keymap as key caps, and a tooltip that appends a shortcut's first chord.
import { Kbd, KbdGroup } from "@music-lite/ui/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@music-lite/ui/components/ui/tooltip";
import { caps, primaryChord, type ShortcutId } from "../shortcuts";

export function Keys({ chord }: { chord: string }) {
  return (
    <KbdGroup>
      {caps(chord).map((cap) => (
        <Kbd key={cap}>{cap}</Kbd>
      ))}
    </KbdGroup>
  );
}

// `render` is the trigger element and `children` its content, like TooltipTrigger.
export function Tip({
  label,
  id,
  side = "top",
  render,
  children,
}: {
  label: string;
  id?: ShortcutId;
  side?: "top" | "bottom";
  render: React.ReactElement;
  children?: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={render}>{children}</TooltipTrigger>
      <TooltipContent side={side}>
        {label}
        {id && <Keys chord={primaryChord(id)} />}
      </TooltipContent>
    </Tooltip>
  );
}
