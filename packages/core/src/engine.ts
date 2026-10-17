import { defaultRegistry, matchFilterToken, type Registry } from "./registry.ts";
import type {
  BookmarkLike,
  MatchContext,
  ParsedQuery,
} from "./types.ts";

/** True when an item matches one token (negation applied). */
const matchToken = (
  token: ParsedQuery["tokens"][number],
  bookmark: BookmarkLike,
  ctx: MatchContext,
  registry: Registry,
): boolean => {
  // Incomplete tokens (unterminated quote) never filter anything.
  if (token.kind === "filter" && token.incomplete) return true;

  const positive =
    token.kind === "term"
      ? (bookmark.title.toLowerCase().includes(token.text.toLowerCase()) ||
        (bookmark.url?.toLowerCase().includes(token.text.toLowerCase()) ??
          false))
      : matchFilterToken(token, bookmark, ctx, registry);

  return positive !== token.negated;
};

/**
 * An item matches the whole query when it matches every token
 * (AND semantics; multiple values for the same key are ANDed,
 * negated tokens exclude).
 */
export const matchBookmark = (
  parsed: ParsedQuery,
  bookmark: BookmarkLike,
  ctx: MatchContext,
  registry: Registry = defaultRegistry,
): boolean =>
  parsed.tokens.every((token) => matchToken(token, bookmark, ctx, registry));

export const filterBookmarks = <T extends BookmarkLike>(
  parsed: ParsedQuery,
  bookmarks: T[],
  ctx: MatchContext,
  registry: Registry = defaultRegistry,
): T[] =>
  bookmarks.filter((bookmark) => matchBookmark(parsed, bookmark, ctx, registry));
