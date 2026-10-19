import { Button } from "@ncm-lite/ui/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@ncm-lite/ui/components/ui/collapsible";
import { useLayoutEffect, useRef, useState } from "react";

// Long text collapsed to two lines. The 展开 toggle only appears when the text actually overflows.
export function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text, open]);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-8 max-w-2xl">
      <p ref={ref} className={`whitespace-pre-line text-muted-foreground ${open ? "" : "line-clamp-2"}`}>
        {text}
      </p>
      {(overflows || open) && (
        <CollapsibleTrigger render={<Button variant="ghost" size="xs" className="mt-1 -ml-2 text-muted-foreground" />}>
          {open ? "收起" : "展开"}
        </CollapsibleTrigger>
      )}
    </Collapsible>
  );
}
