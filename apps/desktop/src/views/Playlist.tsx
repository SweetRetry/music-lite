import { Hero } from "../components/Hero";
import { Loading, Notice, useLoad } from "../components/states";
import { TrackTable } from "../components/TrackTable";
import { cover } from "../format";
import { Icon } from "../icons";
import { library, useLibrary } from "../library";

export function PlaylistView({ id }: { id: number }) {
  const { data, error } = useLoad(() => library.playlist(id));
  if (error) return <Notice message={`歌单没加载出来。${error}`} />;
  if (!data) return <Loading />;
  return (
    <>
      <Hero
        art={<img className="hero__cover" src={cover(data.cover, 120)} alt="" />}
        title={data.name}
        meta={`${data.creator} · ${data.tracks.length} 首`}
        tracks={data.tracks}
      />
      <TrackTable tracks={data.tracks} playlist={data} />
    </>
  );
}

// The liked playlist is loaded like any playlist but presented as the library.
export function LikedView() {
  const me = useLibrary((s) => s.me);
  const likedId = me?.playlists.find((p) => p.liked)?.id;
  if (!me) return <Loading />;
  if (!likedId) return <Notice message="没找到「我喜欢的音乐」。" />;
  return <LikedList key={likedId} id={likedId} />;
}

function LikedList({ id }: { id: number }) {
  const { data, error } = useLoad(() => library.playlist(id));
  if (error) return <Notice message={`喜欢的音乐没加载出来。${error}`} />;
  if (!data) return <Loading />;
  return (
    <>
      <Hero
        art={
          <div className="hero__cover day-cover day-cover--liked">
            <Icon name="heart" filled />
          </div>
        }
        title="我喜欢的音乐"
        meta={`${data.tracks.length} 首`}
        tracks={data.tracks}
      />
      <TrackTable tracks={data.tracks} playlist={data} />
    </>
  );
}
