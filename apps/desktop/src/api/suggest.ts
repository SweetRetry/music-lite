// Search-box suggestions. /api/search/suggest/keyword completes the query; /api/search/suggest/web
// returns direct hits, of which the box shows artists and albums since both have their own pages.
import { https } from "../api";
import { eapi } from "../eapi";

export type Suggestion =
  | { kind: "keyword"; keyword: string }
  | { kind: "artist"; id: number | string; name: string; avatar: string }
  | { kind: "album"; id: number | string; name: string; artist: string };

export type SuggestionGroup = { value: string; items: Suggestion[] };

export const suggestionLabel = (s: Suggestion) => (s.kind === "keyword" ? s.keyword : s.name);

export async function suggest(keyword: string): Promise<SuggestionGroup[]> {
  const [words, hits] = await Promise.all([
    eapi("/api/search/suggest/keyword", { s: keyword }),
    eapi("/api/search/suggest/web", { s: keyword }),
  ]);
  const groups: SuggestionGroup[] = [
    {
      value: "搜索建议",
      items: (words.result?.allMatch ?? []).slice(0, 6).map((m: any) => ({ kind: "keyword", keyword: m.keyword })),
    },
    {
      value: "歌手",
      items: (hits.result?.artists ?? []).slice(0, 2).map((a: any) => ({
        kind: "artist",
        id: a.id,
        name: a.name,
        avatar: https(a.picUrl || a.img1v1Url),
      })),
    },
    {
      value: "专辑",
      items: (hits.result?.albums ?? []).slice(0, 3).map((a: any) => ({
        kind: "album",
        id: a.id,
        name: a.name,
        artist: a.artist?.name ?? "",
      })),
    },
  ];
  return groups.filter((g) => g.items.length);
}
