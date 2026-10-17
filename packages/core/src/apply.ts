import { invertTokenAt, removeTokenAt } from "./parser.ts";
import type { Suggestion } from "./suggest.ts";

/**
 * Result of accepting a suggestion: the new query and where the caret should
 * land. Pure data so any host (React, Vue, vanilla) can apply it itself.
 */
export interface AcceptResult {
  query: string;
  caret: number;
}

/**
 * Apply a suggestion to a query string.
 *
 * - `insert` suggestions splice `query[replaceFrom..replaceTo]` with `insert`
 *   and put the caret after it.
 * - `action: "invert"` / `"remove"` rewrite the token under the caret and leave
 *   the caret at the end.
 *
 * Returns null when the suggestion has nothing to apply.
 */
export const applySuggestion = (
  query: string,
  suggestion: Suggestion,
): AcceptResult | null => {
  if (suggestion.type === "action") {
    if (suggestion.action === "invert") {
      const next = invertTokenAt(query, suggestion.replaceTo);

      return next === null ? null : { query: next, caret: next.length };
    }

    if (suggestion.action === "remove") {
      const next = removeTokenAt(query, suggestion.replaceTo);

      return { query: next, caret: next.length };
    }

    return null;
  }

  if (suggestion.insert !== undefined) {
    return {
      query:
        query.slice(0, suggestion.replaceFrom) +
        suggestion.insert +
        query.slice(suggestion.replaceTo),
      caret: suggestion.replaceFrom + suggestion.insert.length,
    };
  }

  return null;
};
