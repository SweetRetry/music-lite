import { useEffect, useRef, useState } from "react";
import { Hero } from "../components/Hero";
import { PlaylistMoreMenu } from "../components/playlist/actions";
import { failed } from "../components/playlist/dialogs";
import { Loading, Notice } from "../components/states";
import { TrackTable } from "../components/TrackTable";
import { cover } from "../format";
import { Icon } from "../icons";
import { editable, library, useLibrary } from "../library";

// Reads the playlist from the library, so mutations show up in place. When a mutation drops the
// cached copy, it is fetched again while the last copy stays on screen.
function useOpenedPlaylist(id: number) {
  const cached = useLibrary((s) => s.opened[id]);
  const last = useRef(cached);
  if (cached) last.current = cached;
  const [error, setError] = useState("");
  useEffect(() => {
    if (!cached) library.playlist(id).catch((e) => setError(e.message));
  }, [id, cached]);
  return { data: last.current, error };
}

export function PlaylistView({ id }: { id: number }) {
  const { data, error } = useOpenedPlaylist(id);
  const canEdit = useLibrary((s) => editable(s.me, id));
  if (error && !data) return <Notice message={`歌单没加载出来。${error}`} />;
  if (!data) return <Loading />;
  return (
    <>
      <Hero
        art={<img className="hero__cover" src={cover(data.cover, 120)} alt="" />}
        title={data.name}
        meta={`${data.creator} · ${data.tracks.length} 首`}
        tracks={data.tracks}
      >
        <PlaylistMoreMenu playlist={data} />
      </Hero>
      <TrackTable
        tracks={data.tracks}
        playlist={data}
        onReorder={
          canEdit ? (from, to) => library.reorder(id, from, to).catch((e) => failed("没能保存顺序", e)) : undefined
        }
      />
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
  const { data, error } = useOpenedPlaylist(id);
  if (error && !data) return <Notice message={`喜欢的音乐没加载出来。${error}`} />;
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
