// Persistent stale-while-revalidate cache. Entries live in IndexedDB and are hydrated into memory
// before the first render, so a cached page paints on its first frame and the network only refreshes it.
// Values must be structured-cloneable (plain objects, arrays, Sets).

type Entry = { at: number; data: unknown };

const DB = "ncm-cache";
const STORE = "entries";
// Oldest entries beyond this are dropped at startup. Big playlists dominate the size, so keep it modest.
const LIMIT = 80;

const mem = new Map<string, Entry>();
let db: IDBDatabase | null = null;

const done = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

// Never throws: without IndexedDB the cache is memory-only for this session.
export async function hydrate(): Promise<void> {
  try {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    db = await done(open);
    const tx = db.transaction(STORE, "readonly").objectStore(STORE);
    const [keys, values] = await Promise.all([done(tx.getAllKeys()), done(tx.getAll() as IDBRequest<Entry[]>)]);
    keys.forEach((k, i) => mem.set(String(k), values[i]));
    const stale = [...mem].sort(([, a], [, b]) => b.at - a.at).slice(LIMIT);
    for (const [key] of stale) drop(key);
  } catch {
    db = null;
  }
}

function write(run: (store: IDBObjectStore) => void) {
  if (!db) return;
  try {
    run(db.transaction(STORE, "readwrite").objectStore(STORE));
  } catch {}
}

export const peek = <T>(key: string): T | undefined => mem.get(key)?.data as T | undefined;

// Milliseconds since the entry was written, or Infinity when there is none.
export const age = (key: string) => {
  const e = mem.get(key);
  return e ? Date.now() - e.at : Infinity;
};

export function put(key: string, data: unknown) {
  const entry = { at: Date.now(), data };
  mem.set(key, entry);
  write((s) => s.put(entry, key));
}

export function drop(key: string) {
  mem.delete(key);
  write((s) => s.delete(key));
}

// For an account switch: nothing cached for the last account may show. A match limits it to those keys.
export function clear(match?: (key: string) => boolean) {
  if (!match) {
    mem.clear();
    return write((s) => s.clear());
  }
  for (const key of [...mem.keys()]) if (match(key)) drop(key);
}
