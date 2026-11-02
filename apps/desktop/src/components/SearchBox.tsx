import { Autocomplete } from "@base-ui/react/autocomplete";
import { Button } from "@music-lite/ui/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@music-lite/ui/components/ui/avatar";
import {
  ComboboxCollection,
  ComboboxContent,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@music-lite/ui/components/ui/combobox";
import { InputGroupAddon } from "@music-lite/ui/components/ui/input-group";
import { Kbd } from "@music-lite/ui/components/ui/kbd";
import { useNavigate } from "@tanstack/react-router";
import { ClockCounterClockwiseIcon, MagnifyingGlassIcon, VinylRecordIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { type Suggestion, type SuggestionGroup, suggestionLabel } from "../api/suggest";
import { useHistory } from "../history";
import { useProvider } from "../providers";

// A past search sits in the same list as live suggestions and acts like a keyword suggestion.
type Item = Suggestion | { kind: "history"; keyword: string };
type Group = { value: string; items: Item[] };
const HISTORY = "搜索历史";
const label = (s: Item) => (s.kind === "history" ? s.keyword : suggestionLabel(s));

// A button inside a list item must not select the item or take focus from the input.
const inert = {
  onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
};

// There is one search box, so shortcuts can focus it without threading refs through the tree.
let input: HTMLInputElement | null = null;
export const focusSearch = () => input?.focus();

// Typing only fetches suggestions. Enter with nothing highlighted searches the typed text;
// Enter or a click on a suggestion acts on that suggestion. The input text is the value, so this
// is an Autocomplete. With nothing typed, focusing or clicking the box lists recent searches. The shadcn Combobox parts render under it unchanged.
export function SearchBox() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<SuggestionGroup[]>([]);
  const suggest = useProvider().suggest;
  const history = useHistory();
  const shown: Group[] = q.trim()
    ? groups
    : history.keywords.length
      ? [{ value: HISTORY, items: history.keywords.map((keyword) => ({ kind: "history", keyword })) }]
      : [];
  const ref = useRef<HTMLInputElement>(null);
  const anchor = useRef<HTMLFormElement>(null);

  useEffect(() => {
    input = ref.current;
    return () => void (input = null);
  }, []);

  useEffect(() => {
    const keyword = q.trim();
    if (!keyword || !suggest) return setGroups([]);
    let live = true;
    const t = setTimeout(() => suggest(keyword).then((g) => live && setGroups(g), () => {}), 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, suggest]);

  const searchFor = (keyword: string) => {
    setOpen(false);
    if (!keyword) return;
    history.remember(keyword);
    navigate({ to: "/search", search: { q: keyword } });
  };

  const pick = (s: Item) => {
    setOpen(false);
    if (s.kind === "keyword" || s.kind === "history") {
      setQ(s.keyword);
      searchFor(s.keyword);
    } else if (s.kind === "artist") navigate({ to: "/artist/$id", params: { id: String(s.id) } });
    else navigate({ to: "/album/$id", params: { id: String(s.id) } });
  };

  return (
    // Base UI lets Enter submit the form only when no suggestion is highlighted. It also renders a
    // hidden input, and two text fields without a submit button disable implicit submission.
    <form
      ref={anchor}
      className="w-full max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        searchFor(q.trim());
      }}
    >
      <button type="submit" hidden />
      <Autocomplete.Root
        items={shown}
        filter={null}
        value={q}
        onValueChange={(v, d) => (d.reason === "input-change" || d.reason === "input-clear") && setQ(v)}
        itemToStringValue={label}
        open={open && shown.length > 0}
        onOpenChange={setOpen}
        openOnInputClick
      >
        <ComboboxInput
          ref={ref}
          placeholder="搜索歌曲"
          aria-label="搜索歌曲"
          showTrigger={false}
          className="h-9 w-full bg-background"
        >
          <InputGroupAddon align="inline-start">
            <MagnifyingGlassIcon />
          </InputGroupAddon>
          <InputGroupAddon align="inline-end">
            <Kbd>/</Kbd>
          </InputGroupAddon>
        </ComboboxInput>
        <ComboboxContent anchor={anchor}>
          <ComboboxList>
            {(group: Group) => (
              <ComboboxGroup key={group.value} items={group.items}>
                <ComboboxLabel className={group.value === HISTORY ? "flex items-center justify-between py-0.5" : undefined}>
                  {group.value}
                  {group.value === HISTORY && (
                    <Button variant="ghost" size="xs" className="text-muted-foreground" {...inert} onClick={history.clear}>
                      清除
                    </Button>
                  )}
                </ComboboxLabel>
                <ComboboxCollection>
                  {(s: Item) => (
                    <ComboboxItem
                      key={`${s.kind}:${label(s)}:${"id" in s ? s.id : ""}`}
                      value={s}
                      onClick={() => pick(s)}
                    >
                      {s.kind === "history" ? (
                        <>
                          <ClockCounterClockwiseIcon className="text-muted-foreground" />
                          <span className="truncate">{s.keyword}</span>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="删除"
                            className="absolute right-1 text-muted-foreground"
                            {...inert}
                            onClick={(e) => {
                              e.stopPropagation();
                              history.forget(s.keyword);
                            }}
                          >
                            <XIcon />
                          </Button>
                        </>
                      ) : (
                        <SuggestionRow s={s} />
                      )}
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
              </ComboboxGroup>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Autocomplete.Root>
    </form>
  );
}

function SuggestionRow({ s }: { s: Suggestion }) {
  if (s.kind === "keyword")
    return (
      <>
        <MagnifyingGlassIcon className="text-muted-foreground" />
        <span className="truncate">{s.keyword}</span>
      </>
    );
  if (s.kind === "artist")
    return (
      <>
        <Avatar className="size-6">
          <AvatarImage src={s.avatar} alt="" />
          <AvatarFallback>{s.name[0]}</AvatarFallback>
        </Avatar>
        <span className="truncate">{s.name}</span>
      </>
    );
  return (
    <>
      <VinylRecordIcon className="text-muted-foreground" />
      <span className="truncate">{s.name}</span>
      <span className="truncate text-muted-foreground">{s.artist}</span>
    </>
  );
}
