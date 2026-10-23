import { Artists } from "../components/Artists";
import { Description } from "../components/album/Description";
import { Hero } from "../components/Hero";
import { PageSkeleton } from "../components/skeletons";
import { Notice, useCached } from "../components/states";
import { TrackTable } from "../components/TrackTable";
import { cover } from "../format";
import { scoped } from "../mode";
import { provider, useProvider } from "../providers";

const date = (ms: number) => (ms > 0 ? new Date(ms).toLocaleDateString("zh-CN").replaceAll("/", "-") : "");

export function AlbumView({ id }: { id: string }) {
  const { id: src } = useProvider();
  const { data, error } = useCached(scoped(`album:${id}`), () => provider().album(id));
  if (error) return <Notice message={`专辑没加载出来。${error}`} />;
  if (!data) return <PageSkeleton art="square" />;
  const rest = [date(data.publishTime), `${data.trackCount} 首`].filter(Boolean).join(" · ");
  return (
    <>
      <Hero
        art={<img className="hero__cover" src={cover(data.cover, 120)} alt="" />}
        title={data.name}
        meta={
          <>
            <Artists artists={data.artists} src={src} />
            {data.artists.length > 0 && " · "}
            {rest}
          </>
        }
        tracks={data.tracks}
      />
      {data.description && <Description text={data.description} />}
      <TrackTable tracks={data.tracks} />
    </>
  );
}
