import { Heart } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { Playlist } from "../api";
import { peek } from "../cache";
import { Hero } from "../components/Hero";
import { PlaylistMoreMenu } from "../components/playlist/actions";
import { PageSkeleton } from "../components/skeletons";
import { Notice } from "../components/states";
import { TrackTable } from "../components/TrackTable";
import { cover } from "../format";
import { library, useLibrary } from "../library";
import { playlistOrigin } from "../player";

// Reads the playlist from the library, so mutations show up in place. The copy on screen (opened, or
// the persisted one on a cold start) paints at once and is revalidated on every mount; a refetch
// replaces it without ever clearing it.
function useOpenedPlaylist(id: number) {
  const opened = useLibrary((s) => s.opened[id]);
  const data = opened ?? peek<Playlist>(`playlist:${id}`);
  const [error, setError] = useState("");
  useEffect(() => {
    setError("");
    library.reload(id).catch((e) => setError(e.message));
  }, [id]);
  return { data, error };
}

export function PlaylistView({ id }: { id: number }) {
  const { data, error } = useOpenedPlaylist(id);
  if (error && !data) return <Notice message={`歌单没加载出来。${error}`} />;
  if (!data) return <PageSkeleton art="square" />;
  return (
    <>
      <Hero
        art={<img className="hero__cover" src={cover(data.cover, 120)} alt="" />}
        title={data.name}
        meta={`${data.creator} · ${data.tracks.length} 首`}
        tracks={data.tracks}
        origin={playlistOrigin(data.id)}
      >
        <PlaylistMoreMenu playlist={data} />
      </Hero>
      <TrackTable tracks={data.tracks} playlist={data} />
    </>
  );
}

// The liked playlist is loaded like any playlist but presented as the library.
export function LikedView() {
  const me = useLibrary((s) => s.me);
  const likedId = me?.playlists.find((p) => p.liked)?.id;
  if (!me) return <PageSkeleton art="square" />;
  if (!likedId) return <Notice message="没找到「我喜欢的音乐」。" />;
  return <LikedList key={likedId} id={likedId} />;
}

function LikedList({ id }: { id: number }) {
  const { data, error } = useOpenedPlaylist(id);
  if (error && !data) return <Notice message={`喜欢的音乐没加载出来。${error}`} />;
  if (!data) return <PageSkeleton art="square" />;
  return (
    <>
      <Hero
        art={
          <div className="hero__cover day-cover day-cover--liked">
            <Heart weight="fill" />
          </div>
        }
        title="我喜欢的音乐"
        meta={`${data.tracks.length} 首`}
        tracks={data.tracks}
        origin={playlistOrigin(id)}
      />
      <TrackTable tracks={data.tracks} playlist={data} />
    </>
  );
}
