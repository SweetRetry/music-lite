import { Link } from "@tanstack/react-router";
import { album } from "../api/album";
import { Description } from "../components/album/Description";
import { Hero } from "../components/Hero";
import { Loading, Notice, useLoad } from "../components/states";
import { TrackTable } from "../components/TrackTable";
import { cover } from "../format";

const date = (ms: number) => (ms > 0 ? new Date(ms).toLocaleDateString("zh-CN").replaceAll("/", "-") : "");

export function AlbumView({ id }: { id: number }) {
  const { data, error } = useLoad(() => album(id));
  if (error) return <Notice message={`专辑没加载出来。${error}`} />;
  if (!data) return <Loading />;
  const artists = data.artists.map((a, i) => (
    <span key={`${a.id}-${i}`}>
      {i > 0 && " / "}
      {a.id ? (
        <Link className="link" to="/artist/$id" params={{ id: a.id }}>
          {a.name}
        </Link>
      ) : (
        a.name
      )}
    </span>
  ));
  const rest = [date(data.publishTime), `${data.trackCount} 首`].filter(Boolean).join(" · ");
  return (
    <>
      <Hero
        art={<img className="hero__cover" src={cover(data.cover, 120)} alt="" />}
        title={data.name}
        meta={
          <>
            {artists}
            {artists.length > 0 && " · "}
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
