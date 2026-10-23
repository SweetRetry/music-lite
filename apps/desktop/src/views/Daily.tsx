import { useState } from "react";
import { Hero } from "../components/Hero";
import { PageSkeleton } from "../components/skeletons";
import { Notice, useCached } from "../components/states";
import { DAILY_ORIGIN } from "../player";
import { TrackTable } from "../components/TrackTable";
import { useLibrary } from "../library";
import { scoped } from "../mode";
import { useProvider } from "../providers";

export function DailyView() {
  const service = useProvider();
  const uid = useLibrary((s) => s.me?.uid);
  const [openedAt] = useState(Date.now);
  // Only NetEase's 06:00 refresh is known. QQ uses today's date without promising a refresh hour.
  const day = new Date(openedAt - (service.id === "ncm" ? 6 * 3600_000 : 0));
  const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  const key = scoped(`daily:${uid ?? 0}:${date}`, service.id);
  const { data, error } = useCached(key, service.daily);
  const origin = scoped(DAILY_ORIGIN, service.id);
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
        meta={`${service.id === "ncm" ? "根据你的口味生成，每天 6:00 更新" : "根据你的口味推荐"} · ${data.length} 首`}
        tracks={data}
        origin={origin}
      />
      <TrackTable tracks={data} origin={origin} />
    </>
  );
}
