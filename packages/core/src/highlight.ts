import { parseQuery } from "./parser.ts";
import type { QueryToken } from "./types.ts";

/**
 * Split a query into renderable segments: plain text runs plus filter tokens a
 * UI can paint as capsules. Unterminated quotes are returned as plain text, so
 * a half-typed `tag:"` never renders as a token.
 */
export interface HighlightSegment {
  text: string;
  token?: QueryToken;
}

export const highlightSegments = (query: string): HighlightSegment[] => {
  const parts: HighlightSegment[] = [];
  let pos = 0;

  for (const token of parseQuery(query).tokens) {
    if (token.start > pos) {
      parts.push({ text: query.slice(pos, token.start) });
    }

    const text = query.slice(token.start, token.end);
    const incomplete = token.kind === "filter" && token.incomplete;

    parts.push(incomplete ? { text } : { text, token });
    pos = token.end;
  }

  if (pos < query.length) parts.push({ text: query.slice(pos) });

  return parts;
};
