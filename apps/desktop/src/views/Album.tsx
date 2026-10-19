import { Notice } from "../components/states";

export function AlbumView({ id }: { id: number }) {
  return <Notice message={`专辑 ${id} 的页面还没做。`} />;
}
