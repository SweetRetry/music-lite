import { Button } from "@ncm-lite/ui/components/ui/button";
import { useEffect, useRef, useState } from "react";

// A list that grows a page at a time. `initial` is the page the view already has, and `load(begin)` returns the
// page that starts after `begin` items. Without `load`, or once `total` is reached, there is nothing more.
export function usePaged<T>(initial: T[], total: number, load?: (begin: number) => Promise<T[]>) {
  const [extra, setExtra] = useState<T[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "failed" | "done">("idle");
  const items = extra.length ? [...initial, ...extra] : initial;
  const more = !!load && state !== "done" && items.length < total;
  const next = () => {
    if (!load || state === "loading") return;
    setState("loading");
    load(items.length).then(
      (page) => {
        setExtra((e) => [...e, ...page]);
        // An empty page ends the list, so a total that overstates never loops.
        setState(page.length ? "idle" : "done");
      },
      () => setState("failed"),
    );
  };
  return { items, more, loading: state === "loading", failed: state === "failed", next };
}

// Loads the next page when it scrolls near, and offers a retry when a page fails.
export function LoadMore({ more, loading, failed, next }: Pick<ReturnType<typeof usePaged>, "more" | "loading" | "failed" | "next">) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = end.current;
    if (!el || !more || loading || failed) return;
    const watch = new IntersectionObserver(([e]) => e?.isIntersecting && next(), { rootMargin: "400px" });
    watch.observe(el);
    return () => watch.disconnect();
  }, [more, loading, failed, next]);
  if (!more) return null;
  return (
    <div ref={end} className="flex h-16 items-center justify-center text-sm text-muted-foreground">
      {failed ? (
        <Button variant="ghost" size="sm" onClick={next}>
          没加载出来，重试
        </Button>
      ) : (
        "加载中…"
      )}
    </div>
  );
}
