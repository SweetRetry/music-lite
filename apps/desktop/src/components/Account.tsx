import { cover } from "../format";
import { useLibrary } from "../library";

export function Account() {
  const me = useLibrary((s) => s.me);
  if (!me) return null;
  return (
    <div className="sidebar__me">
      <img src={cover(me.avatar, 24)} alt="" />
      <span>{me.nickname}</span>
    </div>
  );
}
