import { Notice } from "../components/states";

export function ArtistView({ id }: { id: number }) {
  return <Notice message={`歌手 ${id} 的页面还没做。`} />;
}
