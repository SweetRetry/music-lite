// The play queue as a popover above the player bar: jump, remove, clear.
import { Button } from "@ncm-lite/ui/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@ncm-lite/ui/components/ui/popover";
import { ScrollArea } from "@ncm-lite/ui/components/ui/scroll-area";
import { artistNames, cover, duration } from "../../format";
import { player, usePlayer } from "../../player";

const ROW = 52;
const MAX_HEIGHT = 420;

const svg = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5 };

function QueueIcon() {
  return (
    <svg {...svg} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 4h8M2.5 8h8M2.5 12h4M11.5 10v4l3-2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg {...svg} strokeLinecap="round" aria-hidden>
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
    </svg>
  );
}

export function QueuePanel() {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="播放队列" />}
      >
        <QueueIcon />
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={12} className="w-96 gap-0 p-0">
        <div className="flex h-11 items-center justify-between px-4">
          <span className="font-medium">播放队列 {queue.length > 0 && <span className="text-muted-foreground">{queue.length}</span>}</span>
          <Button variant="ghost" size="xs" disabled={!queue.length} onClick={player.clear}>
            清空
          </Button>
        </div>
        {queue.length ? (
          <ScrollArea style={{ height: Math.min(queue.length * ROW + 8, MAX_HEIGHT) }}>
            <ul className="p-1">
              {queue.map((t, i) => {
                const current = i === index;
                return (
                  <li
                    key={`${t.id}-${i}`}
                    ref={current ? (el) => el?.scrollIntoView({ block: "center" }) : undefined}
                    className={`flex items-center gap-1 rounded-md pr-1 hover:bg-muted ${current ? "bg-muted" : ""}`}
                  >
                    <button
                      className="flex h-[50px] min-w-0 flex-1 items-center gap-2.5 px-2 text-left"
                      onClick={() => player.jumpTo(i)}
                    >
                      <img src={cover(t.cover, 36)} alt="" className="size-9 flex-none rounded bg-muted" />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm ${current ? "font-medium text-primary" : ""}`}>{t.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{artistNames(t)}</span>
                      </span>
                      <span className="num flex-none text-xs text-muted-foreground">{duration(t.durationMs)}</span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground"
                      aria-label={`从队列移除 ${t.name}`}
                      onClick={() => player.remove(i)}
                    >
                      <CloseIcon />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        ) : (
          <p className="px-4 pb-6 pt-4 text-center text-sm text-muted-foreground">队列是空的</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
