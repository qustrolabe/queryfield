export * from "./types.ts";

export * from "./parser.ts";

export * from "./engine.ts";

export * from "./registry.ts";

export * from "./bounds.ts";

export * from "./glob.ts";

export * from "./folders.ts";

export * from "./tags.ts";

export * from "./suggest.ts";

export * from "./editing.ts";

export * from "./apply.ts";

export * from "./highlight.ts";

import type { BookmarkLike, MatchContext, ParsedQuery } from "./types.ts";
import { parseQuery } from "./parser.ts";
import { filterBookmarks, matchBookmark } from "./engine.ts";
import { defaultRegistry, type Registry } from "./registry.ts";
import { extractTags } from "./tags.ts";
import type { SuggestData, SuggestOptions, Suggestion } from "./suggest.ts";
import { suggest } from "./suggest.ts";

/** Build a MatchContext from a full item tree snapshot. */
export const createMatchContext = (
  allBookmarks: BookmarkLike[],
  stats: MatchContext["stats"],
  now: number = Date.now(),
): MatchContext => {
  const folderNameById = new Map(
    allBookmarks
      .filter((b) => b.url === undefined)
      .map((b) => [b.id, b.title]),
  );

  const ancestorsByNodeId = new Map<string, string[]>();
  const byId = new Map(allBookmarks.map((node) => [node.id, node]));

  // Top-level folders = direct children of the browser root node ("0").
  const rootFolderIds = new Set(
    allBookmarks
      .filter((b) => b.url === undefined && b.parentId === "0")
      .map((b) => b.id),
  );

  return {
    now,
    rootFolderIds,
    tagsOf: (b) => extractTags(b.title),
    ancestorIdsOf: (b) => {
      const cached = ancestorsByNodeId.get(b.id);

      if (cached) return cached;
      // Walk parents via the hoisted lookup (built once per snapshot).
      const ids: string[] = [];
      let current = b.parentId ? byId.get(b.parentId) : undefined;

      while (current) {
        ids.push(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }

      ids.reverse(); // root -> parent
      ancestorsByNodeId.set(b.id, ids);

      return ids;
    },
    folderNameById,
    stats,
  };
};

/** Convenience: filter items with a raw query string. */
export const applyQuery = <T extends BookmarkLike>(
  query: string,
  bookmarks: T[],
  ctx: MatchContext,
  registry: Registry = defaultRegistry,
): T[] => filterBookmarks(parseQuery(query), bookmarks, ctx, registry);

/** Convenience: suggestions for a query + caret. */
export const suggestFor = (
  query: string,
  caret: number,
  data: SuggestData,
  registry: Registry = defaultRegistry,
  options: SuggestOptions = {},
): Suggestion[] => suggest(query, caret, data, registry, options);

/**
 * A bound engine — the recommended entry point for host apps. It closes over
 * one registry so callers never have to thread the preset by hand.
 */
export interface QueryEngine {
  parse(query: string): ParsedQuery;
  match(parsed: ParsedQuery, item: BookmarkLike, ctx: MatchContext): boolean;
  filter<T extends BookmarkLike>(
    query: string,
    items: T[],
    ctx: MatchContext,
  ): T[];
  suggest(query: string, caret: number, data: SuggestData): Suggestion[];
}

export const createQueryEngine = (
  registry: Registry = defaultRegistry,
  options: SuggestOptions = {},
): QueryEngine => ({
  parse: parseQuery,
  match: (parsed, item, ctx) => matchBookmark(parsed, item, ctx, registry),
  filter: (query, items, ctx) =>
    filterBookmarks(parseQuery(query), items, ctx, registry),
  suggest: (query, caret, data) =>
    suggest(query, caret, data, registry, options),
});
