import { Link } from "@tanstack/react-router";
import { type Ref, pageId } from "../api";
import type { ProviderId } from "../mode";
import { useCanBrowse } from "../providers";

// Artist names as links, joined like the official client. Only a song of the service on screen links to its
// artist pages, and only when that service has them.
export function Artists({ artists, src }: { artists: Ref[]; src?: ProviderId }) {
  const browse = useCanBrowse(src);
  return artists.map((a, i) => (
    <span key={`${a.id}-${i}`}>
      {i > 0 && " / "}
      {a.id && browse ? (
        <Link className="link" to="/artist/$id" params={{ id: pageId(a) }}>
          {a.name}
        </Link>
      ) : (
        a.name
      )}
    </span>
  ));
}
