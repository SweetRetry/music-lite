import { Input } from "@ncm-lite/ui/components/ui/input";
import { Kbd } from "@ncm-lite/ui/components/ui/kbd";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// There is one search box, so shortcuts can focus it without threading refs through the tree.
let input: HTMLInputElement | null = null;
export const focusSearch = () => input?.focus();

export function SearchBox() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input = ref.current;
    return () => void (input = null);
  }, []);

  useEffect(() => {
    const keyword = q.trim();
    if (!keyword) return;
    const t = setTimeout(() => navigate({ to: "/search", search: { q: keyword }, replace: true }), 350);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={ref}
        value={q}
        placeholder="搜索歌曲"
        aria-label="搜索歌曲"
        className="h-9 bg-background pr-9 pl-9"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && q.trim()) navigate({ to: "/search", search: { q: q.trim() } });
        }}
      />
      <Kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">/</Kbd>
    </div>
  );
}
