// Drag-to-reorder for table rows, by pointer on a handle or by arrow keys on the focused handle.
// Pointer events rather than HTML5 drag and drop, which Tauri's native file-drop handling
// swallows on Windows unless dragDropEnabled is turned off.
import { useState } from "react";

// `to` is an insertion point: the row lands before the row now at `to`, or last when to === length.
export type Move = (from: number, to: number) => void;

const EDGE = 48;

export function useReorder(onMove: Move | undefined) {
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);

  const handleProps = (index: number) => ({
    "data-reorder-handle": "",
    onPointerDown(e: React.PointerEvent<HTMLElement>) {
      if (!onMove || e.button !== 0) return;
      e.preventDefault();
      const handle = e.currentTarget;
      const body = handle.closest("tbody");
      const scroller = handle.closest("main");
      if (!body) return;
      handle.setPointerCapture(e.pointerId);
      let to = index;
      setDrag({ from: index, to });

      const move = (ev: PointerEvent) => {
        if (scroller) {
          const box = scroller.getBoundingClientRect();
          if (ev.clientY < box.top + EDGE) scroller.scrollBy(0, -16);
          else if (ev.clientY > box.bottom - EDGE) scroller.scrollBy(0, 16);
        }
        const rows = [...body.rows];
        const at = rows.findIndex((r) => {
          const b = r.getBoundingClientRect();
          return ev.clientY < b.top + b.height / 2;
        });
        to = at < 0 ? rows.length : at;
        setDrag({ from: index, to });
      };
      const end = (commit: boolean) => () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", cancel);
        setDrag(null);
        if (commit && to !== index && to !== index + 1) onMove(index, to);
      };
      const up = end(true);
      const cancel = end(false);
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", cancel);
    },
    onKeyDown(e: React.KeyboardEvent<HTMLElement>) {
      if (!onMove || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      e.preventDefault();
      e.stopPropagation();
      const body = e.currentTarget.closest("tbody");
      const up = e.key === "ArrowUp";
      if (!body || (up && index === 0) || (!up && index === body.rows.length - 1)) return;
      onMove(index, up ? index - 1 : index + 2);
      // Keep the keyboard on the row that moved.
      const landed = up ? index - 1 : index + 1;
      requestAnimationFrame(() => body.rows[landed]?.querySelector<HTMLElement>("[data-reorder-handle]")?.focus());
    },
  });

  // Where to draw the drop line for each row, if anywhere.
  const dropAt = (index: number, count: number): "before" | "after" | undefined => {
    if (!drag || drag.to === drag.from || drag.to === drag.from + 1) return;
    if (drag.to === index) return "before";
    if (drag.to === count && index === count - 1) return "after";
  };

  return { dragging: drag?.from, handleProps, dropAt };
}
