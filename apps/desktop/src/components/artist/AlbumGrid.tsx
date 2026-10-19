import { Card } from "@ncm-lite/ui/components/ui/card";
import { Link } from "@tanstack/react-router";
import type { AlbumCard } from "../../api/album";
import { cover } from "../../format";

export function AlbumGrid({ albums }: { albums: AlbumCard[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-4">
      {albums.map((a) => (
        <Link key={a.id} to="/album/$id" params={{ id: a.id }} className="group block min-w-0">
          <Card size="sm" className="gap-2 bg-transparent py-0 ring-0">
            <img
              className="aspect-square w-full rounded-lg bg-muted object-cover transition-opacity group-hover:opacity-80"
              src={cover(a.cover, 160)}
              alt=""
              loading="lazy"
            />
            <div className="min-w-0 px-0.5">
              <p className="truncate">{a.name}</p>
              <p className="text-xs text-muted-foreground">{a.year}</p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
