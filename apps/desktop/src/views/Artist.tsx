import { Avatar, AvatarFallback, AvatarImage } from "@ncm-lite/ui/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ncm-lite/ui/components/ui/tabs";
import { Description } from "../components/album/Description";
import { AlbumGrid } from "../components/artist/AlbumGrid";
import { Hero } from "../components/Hero";
import { LoadMore, usePaged } from "../components/LoadMore";
import { PageSkeleton } from "../components/skeletons";
import { Notice, useCached } from "../components/states";
import { TrackTable } from "../components/TrackTable";
import { cover } from "../format";
import { scoped } from "../mode";
import { provider, useProvider } from "../providers";

export function ArtistView({ id }: { id: string }) {
  const { data, error } = useCached(scoped(`artist:${id}`), () => provider().artist(id));
  const { artistSongs, artistAlbums } = useProvider();
  const songs = usePaged(data?.hotSongs ?? [], data?.songCount ?? 0, artistSongs && ((begin) => artistSongs(id, begin)));
  const albums = usePaged(data?.albums ?? [], data?.albumCount ?? 0, artistAlbums && ((begin) => artistAlbums(id, begin)));
  if (error) return <Notice message={`歌手没加载出来。${error}`} />;
  if (!data) return <PageSkeleton art="round" tabs />;
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
        tracks={songs.items}
      />
      {data.intro && <Description text={data.intro} />}
      {/* Songs and albums can each run to hundreds, so each gets a tab and its own pages. */}
      <Tabs defaultValue="songs">
        <TabsList className="mb-4">
          <TabsTrigger value="songs">热门歌曲</TabsTrigger>
          {albums.items.length > 0 && <TabsTrigger value="albums">专辑</TabsTrigger>}
        </TabsList>
        <TabsContent value="songs">
          <TrackTable tracks={songs.items} />
          <LoadMore {...songs} />
        </TabsContent>
        <TabsContent value="albums">
          <AlbumGrid albums={albums.items} />
          <LoadMore {...albums} />
        </TabsContent>
      </Tabs>
    </>
  );
}
