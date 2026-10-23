// The cheatsheet. It renders the keymap, so it can never list a shortcut that does not exist.
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@music-lite/ui/components/ui/dialog";
import { Fragment } from "react";
import { grouped } from "../shortcuts";
import { useUi } from "../ui";
import { Keys } from "./ShortcutKeys";

export function ShortcutsDialog() {
  const open = useUi((s) => s.shortcutsOpen);
  const toggle = useUi((s) => s.toggleShortcuts);
  return (
    <Dialog open={open} onOpenChange={toggle}>
      <DialogContent className="max-h-[calc(100vh-4rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>快捷键</DialogTitle>
        </DialogHeader>
        <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
          {grouped.map(({ group, items }) => (
            <section key={group} className="flex flex-col gap-2">
              <h3 className="text-xs text-muted-foreground">{group}</h3>
              {items.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-4">
                  <span>{s.label}</span>
                  <span className="flex flex-none items-center gap-1.5">
                    {s.keys.map((chord, i) => (
                      <Fragment key={chord}>
                        {i > 0 && <span className="text-xs text-muted-foreground">或</span>}
                        <Keys chord={chord} />
                      </Fragment>
                    ))}
                  </span>
                </div>
              ))}
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
