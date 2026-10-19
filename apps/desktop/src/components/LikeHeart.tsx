import { HeartIcon } from "@phosphor-icons/react";
import { useState } from "react";

// The heart pops when a song becomes liked, and only then. Mounting an already-liked heart, or unliking, stays
// still. Key it by song, so a new song does not read as a change.
export function LikeHeart({ liked, size }: { liked: boolean; size?: number }) {
  const [was, setWas] = useState(liked);
  const [pop, setPop] = useState(false);
  if (liked !== was) {
    setWas(liked);
    setPop(liked);
  }
  return <HeartIcon size={size} weight={liked ? "fill" : "regular"} data-pop={pop || undefined} />;
}
