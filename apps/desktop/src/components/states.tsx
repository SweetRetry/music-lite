import { useEffect, useState } from "react";
import { peek, put } from "../cache";
import { Button } from "@ncm-lite/ui/components/ui/button";
import { library } from "../library";
import { PROVIDER_IDS } from "../mode";
import { providers, useProvider } from "../providers";
import { requestQqAccess, useQqAccess } from "../qqapi";
import { toast } from "sonner";

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

export function Fatal({ message }: { message: string }) {
  const { id, name } = useProvider();
  const needsAccess = useQqAccess((s) => s.denied) && id === "qq";
  const other = providers[PROVIDER_IDS.find((p) => p !== id) ?? id];
  return (
    <div className="fatal">
      <h1>{needsAccess ? "需要访问权限" : `没能连上${name}`}</h1>
      <p className="notice">{message}</p>
      {!needsAccess && <p className="muted">检查网络后重启 Music Lite，或者先看看另一个账号。</p>}
      {needsAccess && (
        <Button size="sm" onClick={async () => {
          try { if (await requestQqAccess()) await library.load(); }
          catch (e) { toast.error((e as Error).message); }
        }}>
          授权访问
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => library.enter(other.id)}>
        切换到{other.short}
      </Button>
    </div>
  );
}
