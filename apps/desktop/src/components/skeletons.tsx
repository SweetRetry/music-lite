// Loading placeholders that copy the real layout (Hero, TrackTable, AlbumGrid), so nothing moves when data lands.
import { Skeleton } from "@music-lite/ui/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@music-lite/ui/components/ui/table";

// Fixed widths, varied per row, so the list looks like text without a random value changing between renders.
const NAMES = ["w-40", "w-56", "w-32", "w-48", "w-36", "w-52", "w-44", "w-28", "w-60", "w-38"];
const ARTISTS = ["w-24", "w-20", "w-28", "w-16", "w-24", "w-32", "w-20", "w-24", "w-16", "w-28"];

// Same table and cell classes as TrackTable, so columns and row height line up exactly.
export function TrackListSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <Table className="table-fixed" aria-hidden>
      <TableHeader className="[&_tr]:border-0">
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-xs font-normal text-muted-foreground">歌名 / 歌手</TableHead>
          <TableHead className="w-20" />
          <TableHead className="w-1/3 text-xs font-normal text-muted-foreground">专辑</TableHead>
          <TableHead className="w-16 text-right text-xs font-normal text-muted-foreground">时长</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }, (_, i) => (
          <TableRow key={i} className="border-0 hover:bg-transparent">
            <TableCell className="py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <Skeleton className="size-12 shrink-0" />
                <div className="flex min-w-0 flex-col gap-2">
                  <Skeleton className={`h-4 ${NAMES[i % NAMES.length]}`} />
                  <Skeleton className={`h-3.5 ${ARTISTS[i % ARTISTS.length]}`} />
                </div>
              </div>
            </TableCell>
            <TableCell />
            <TableCell>
              <Skeleton className="h-4 w-32 max-w-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="ml-auto h-4 w-9" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// Album, playlist and daily use a 184px rounded square; artists a round 120px avatar.
export function HeroSkeleton({ art }: { art: "square" | "round" }) {
  return (
    <header className="flex items-end gap-8 pb-10" aria-hidden>
      {art === "round" ? (
        <Skeleton className="size-30 shrink-0 rounded-full" />
      ) : (
        <Skeleton className="size-[184px] shrink-0 rounded-xl" />
      )}
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex h-10 items-center">
            <Skeleton className="h-9 w-64" />
          </div>
          <div className="flex h-6 items-center">
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
    </header>
  );
}

// The tab strip of the artist page.
const TabStrip = () => <Skeleton className="mb-4 h-8 w-40 rounded-lg" />;

// tabs adds the tab strip above the track list of the artist page.
export function PageSkeleton({ art, tabs }: { art: "square" | "round"; tabs?: boolean }) {
  return (
    <>
      <HeroSkeleton art={art} />
      {tabs && <TabStrip />}
      <TrackListSkeleton />
    </>
  );
}

// Matches the search header: a 4xl title line over one meta line.
export function SearchSkeleton() {
  return (
    <>
      <header className="flex flex-col gap-2 pb-10" aria-hidden>
        <div className="flex h-10 items-center">
          <Skeleton className="h-9 w-48" />
        </div>
        <div className="flex h-6 items-center">
          <Skeleton className="h-4 w-16" />
        </div>
      </header>
      <TrackListSkeleton />
    </>
  );
}
