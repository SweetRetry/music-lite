import { search } from "../api";
import { Loading, Notice, useLoad } from "../components/states";
import { TrackTable } from "../components/TrackTable";

export function SearchView({ q }: { q: string }) {
  const { data, error } = useLoad(() => search(q));
  if (error) return <Notice message={`搜索失败。${error}`} />;
  if (!data) return <Loading />;
  return (
    <>
      <header className="hero hero--compact">
        <div className="hero__text">
          <h1>「{q}」</h1>
          <p className="meta">{data.length ? `${data.length} 首歌曲，双击播放` : "没有找到相关歌曲，换个关键词试试"}</p>
        </div>
      </header>
      {data.length > 0 && <TrackTable tracks={data} />}
    </>
  );
}
