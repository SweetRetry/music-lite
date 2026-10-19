import { daily } from "../api";
import { Hero } from "../components/Hero";
import { Loading, Notice, useLoad } from "../components/states";
import { TrackTable } from "../components/TrackTable";

export function DailyView() {
  const { data, error } = useLoad(daily);
  if (error) return <Notice message={`每日推荐没加载出来。${error}`} />;
  if (!data) return <Loading />;
  const today = new Date();
  return (
    <>
      <Hero
        art={
          <div className="hero__cover day-cover">
            <span className="day-cover__month">{today.getMonth() + 1} 月</span>
            <span className="day-cover__date">{today.getDate()}</span>
          </div>
        }
        title="每日推荐"
        meta={`根据你的口味生成，每天 6:00 更新 · ${data.length} 首`}
        tracks={data}
      />
      <TrackTable tracks={data} />
    </>
  );
}
