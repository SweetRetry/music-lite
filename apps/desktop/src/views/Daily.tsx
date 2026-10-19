import { useState } from "react";
import { daily } from "../api";
import { Hero } from "../components/Hero";
import { PageSkeleton } from "../components/skeletons";
import { Notice, useCached } from "../components/states";
import { DAILY_ORIGIN } from "../player";
import { TrackTable } from "../components/TrackTable";

// NetEase refreshes the recommendations at 06:00 local, so an earlier hour still belongs to yesterday's list.
const recommendationDay = () => new Date(Date.now() - 6 * 3600_000);

export function DailyView() {
  const [day] = useState(recommendationDay);
  const key = `daily:${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  const { data, error } = useCached(key, daily);
  if (error) return <Notice message={`每日推荐没加载出来。${error}`} />;
  if (!data) return <PageSkeleton art="square" />;
  return (
    <>
      <Hero
        art={
          <div className="hero__cover day-cover">
            <span className="day-cover__month">{day.getMonth() + 1} 月</span>
            <span className="day-cover__date">{day.getDate()}</span>
          </div>
        }
        title="每日推荐"
        meta={`根据你的口味生成，每天 6:00 更新 · ${data.length} 首`}
        tracks={data}
        origin={DAILY_ORIGIN}
      />
      <TrackTable tracks={data} origin={DAILY_ORIGIN} />
    </>
  );
}
