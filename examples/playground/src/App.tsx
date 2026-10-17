import { useEffect, useMemo, useState } from "react";
import { createQueryEngine, parseQuery } from "@queryfield/core";
import type { QueryToken } from "@queryfield/core";
import { QueryInput } from "@queryfield/react";
import {
  MATCH_CONTEXT,
  RECIPES,
  STATS,
  SUGGEST_DATA,
  collectionPath,
} from "./data.ts";

const engine = createQueryEngine();

const EXAMPLES: { label: string; query: string }[] = [
  { label: "everything", query: "" },
  { label: "tag:baking", query: 'tag:"baking"' },
  { label: "not quick", query: '-tag:"quick"' },
  { label: "folder", query: 'folder:"Baking"' },
  { label: "nested folder", query: 'folder:"Weeknight/Quick"' },
  { label: "this week", query: "last_used:<1w" },
  { label: "popular", query: "visits:>15" },
  { label: "bare term", query: "soup" },
  {
    label: "combined",
    query: 'tag:"quick" -folder:"Quick" visits:>10',
  },
];

const describeToken = (token: QueryToken): string => {
  if (token.kind === "term") {
    return `${token.negated ? "-" : ""}term ${JSON.stringify(token.text)}`;
  }

  return `${token.negated ? "-" : ""}${token.key} = ${JSON.stringify(token.value)}${
    token.incomplete ? " (incomplete)" : ""
  }`;
};

const day = 86_400_000;

const relative = (timestamp?: number): string => {
  if (!timestamp) return "never";

  const days = Math.round((Date.now() - timestamp) / day);

  if (days <= 0) return "today";
  if (days === 1) return "yesterday";

  return `${days} days ago`;
};

export function App() {
  const [query, setQuery] = useState('tag:"quick"');
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const results = useMemo(
    () => engine.filter(query, RECIPES, MATCH_CONTEXT).slice(),
    [query],
  );

  const tokens = useMemo(() => parseQuery(query).tokens, [query]);

  const sorted = useMemo(
    () =>
      results.slice().sort((a, b) => {
        const sa = STATS[a.id]?.score ?? 0;
        const sb = STATS[b.id]?.score ?? 0;

        return sb - sa || a.title.localeCompare(b.title);
      }),
    [results],
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">queryfield playground</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {RECIPES.length} recipes in a mock recipe box — not bookmarks. Type
            a query, or arrow through the suggestions and press Enter.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDark((d) => !d)}
          className="shrink-0 rounded-md border border-border bg-input px-3 py-1.5 text-xs font-medium"
        >
          {dark ? "light" : "dark"} mode
        </button>
      </header>

      <section className="flex flex-col gap-2">
        <QueryInput
          query={query}
          onQueryChange={setQuery}
          data={SUGGEST_DATA}
          aria-label="recipe query"
          placeholder='tag:"quick" folder:"Weeknight" last_used:<1w'
        />

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => setQuery(example.query)}
              className="rounded-full border border-border px-2.5 py-0.5 text-muted-foreground hover:bg-muted"
            >
              {example.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 rounded-md bg-popover p-3 text-xs ring-1 ring-border">
        <div>
          <div className="font-medium">
            {sorted.length} of {RECIPES.length} recipes match
          </div>
          <div className="mt-1 font-mono break-all text-muted-foreground">
            {query || "(empty query)"}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {tokens.length === 0 ? (
            <span className="text-muted-foreground">no tokens parsed</span>
          ) : (
            tokens.map((token, index) => (
              <span
                key={index}
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground"
              >
                {describeToken(token)}
              </span>
            ))
          )}
        </div>
      </section>

      <ul className="flex flex-col gap-2">
        {sorted.map((recipe) => (
          <li
            key={recipe.id}
            className="flex items-baseline justify-between gap-4 rounded-md border border-border px-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{recipe.title}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {collectionPath(recipe.parentId)} ·{" "}
                <span className="font-mono">{recipe.url}</span>
              </div>
            </div>
            <div className="shrink-0 text-right text-xs text-muted-foreground">
              <div>{STATS[recipe.id]?.visits ?? 0} visits</div>
              <div>{relative(recipe.dateLastUsed)}</div>
            </div>
          </li>
        ))}
        {sorted.length === 0 && (
          <li className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            Nothing matches. Try &quot;everything&quot;.
          </li>
        )}
      </ul>

      <footer className="mt-auto text-xs text-muted-foreground">
        Suggestions come from the recipe titles&apos; #hashtags and the
        collection tree. Try typing <span className="font-mono">tag:</span> or{" "}
        <span className="font-mono">folder:</span> and watch the list change.
      </footer>
    </div>
  );
}
