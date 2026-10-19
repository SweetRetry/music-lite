import { useEffect, useState } from "react";
import { peek, put } from "../cache";

// Stale-while-revalidate. Starts from the cached copy (so a revisit paints at once), always refetches
// on mount or key change, and swaps the fresh result in. A failed refetch keeps the cached copy and
// stays silent; the error only surfaces when there is nothing to show. data is undefined until the
// first result, cached or fresh.
export function useCached<T>(key: string, load: () => Promise<T>) {
  // Results are tagged with their key, so a key change falls back to that key's cache without a reset.
  const [fresh, setFresh] = useState<{ key: string; data: T } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);
  useEffect(() => {
    let live = true;
    load().then(
      (data) => {
        put(key, data);
        if (live) setFresh({ key, data });
      },
      (e) => live && setFailed({ key, message: e.message }),
    );
    return () => {
      live = false;
    };
  }, [key]);
  const data = fresh?.key === key ? fresh.data : peek<T>(key);
  const error = data === undefined && failed?.key === key ? failed.message : "";
  return { data, error };
}

export const Notice = ({ message }: { message: string }) => <p className="state notice">{message}</p>;

export const Fatal = ({ message }: { message: string }) => (
  <div className="fatal">
    <h1>没能连上网易云</h1>
    <p className="notice">{message}</p>
    <p className="muted">检查网络后重启 NCM Lite。</p>
  </div>
);
