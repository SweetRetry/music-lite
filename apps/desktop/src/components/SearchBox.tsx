import { Autocomplete } from "@base-ui/react/autocomplete";
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
import { MagnifyingGlassIcon, VinylRecordIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { type Suggestion, type SuggestionGroup, suggestionLabel } from "../api/suggest";
import { useProvider } from "../providers";

// There is one search box, so shortcuts can focus it without threading refs through the tree.
let input: HTMLInputElement | null = null;
export const focusSearch = () => input?.focus();

// Typing only fetches suggestions. Enter with nothing highlighted searches the typed text;
// Enter or a click on a suggestion acts on that suggestion. The input text is the value, so this
// is an Autocomplete. The shadcn Combobox parts render under it unchanged.
export function SearchBox() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<SuggestionGroup[]>([]);
  const suggest = useProvider().suggest;
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
    if (keyword) navigate({ to: "/search", search: { q: keyword } });
  };

  const pick = (s: Suggestion) => {
    setOpen(false);
    if (s.kind === "keyword") {
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
        items={groups}
        filter={null}
        value={q}
        onValueChange={(v, d) => (d.reason === "input-change" || d.reason === "input-clear") && setQ(v)}
        itemToStringValue={suggestionLabel}
        open={open && groups.length > 0}
        onOpenChange={setOpen}
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
            {(group: SuggestionGroup) => (
              <ComboboxGroup key={group.value} items={group.items}>
                <ComboboxLabel>{group.value}</ComboboxLabel>
                <ComboboxCollection>
                  {(s: Suggestion) => (
                    <ComboboxItem
                      key={`${s.kind}:${suggestionLabel(s)}:${"id" in s ? s.id : ""}`}
                      value={s}
                      onClick={() => pick(s)}
                    >
                      <SuggestionRow s={s} />
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
