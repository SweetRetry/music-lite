import { Avatar, AvatarFallback, AvatarImage } from "@ncm-lite/ui/components/ui/avatar";
import { artist } from "../api/artist";
import { Description } from "../components/album/Description";
import { AlbumGrid } from "../components/artist/AlbumGrid";
import { Hero } from "../components/Hero";
import { Loading, Notice, useLoad } from "../components/states";
import { TrackTable } from "../components/TrackTable";
import { cover } from "../format";

const Heading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mb-3 text-base font-semibold">{children}</h2>
);

export function ArtistView({ id }: { id: number }) {
  const { data, error } = useLoad(() => artist(id));
  if (error) return <Notice message={`歌手没加载出来。${error}`} />;
  if (!data) return <Loading />;
  const meta = [data.alias, `${data.songCount} 首歌`, `${data.albumCount} 张专辑`].filter(Boolean).join(" · ");
  return (
    <>
      <Hero
        art={
          <Avatar className="size-30">
            <AvatarImage src={cover(data.avatar, 120)} alt="" />
            <AvatarFallback className="text-3xl">{data.name.slice(0, 1)}</AvatarFallback>
          </Avatar>
        }
        title={data.name}
        meta={meta}
        tracks={data.hotSongs}
      />
      {data.intro && <Description text={data.intro} />}
      <Heading>热门歌曲</Heading>
      <TrackTable tracks={data.hotSongs} />
      {data.albums.length > 0 && (
        <section className="mt-10">
          <Heading>专辑</Heading>
          <AlbumGrid albums={data.albums} />
        </section>
      )}
    </>
  );
}
