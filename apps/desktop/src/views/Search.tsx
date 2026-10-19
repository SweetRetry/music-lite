import { search } from "../api";
import { Loading, Notice, useLoad } from "../components/states";
import { TrackTable } from "../components/TrackTable";

export function SearchView({ q }: { q: string }) {
  const { data, error } = useLoad(() => search(q));
  if (error) return <Notice message={`搜索失败。${error}`} />;
  if (!data) return <Loading />;
  return (
    <>
      <header className="flex flex-col gap-2 pb-10">
        <h1 className="truncate text-4xl font-semibold tracking-tight">「{q}」</h1>
        <p className="text-base text-muted-foreground">
          {data.length ? `${data.length} 首` : "没有找到相关歌曲，换个关键词试试"}
        </p>
      </header>
      {data.length > 0 && <TrackTable tracks={data} />}
    </>
  );
}
