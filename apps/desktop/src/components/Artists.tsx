import { Link } from "@tanstack/react-router";
import type { Track } from "../api";

// Artist names as links, joined like the official client.
export function Artists({ track }: { track: Track }) {
  return track.artists.map((a, i) => (
    <span key={`${a.id}-${i}`}>
      {i > 0 && " / "}
      {a.id ? (
        <Link className="link" to="/artist/$id" params={{ id: a.id }}>
          {a.name}
        </Link>
      ) : (
        a.name
      )}
    </span>
  ));
}
