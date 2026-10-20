import { useCallback, useMemo, useState } from "react";
import { applySuggestion, suggest } from "@queryfield/core";
import type {
  AcceptResult,
  Registry,
  SuggestData,
  Suggestion,
  TokenActionProvider,
} from "@queryfield/core";
import { resolveKeyEvent } from "./keyboard.ts";
import type { KeyEventLike, KeyOutcome } from "./keyboard.ts";

/**
 * Headless state for a query input: caret, suggestion list, keyboard intents.
 *
 * It owns no DOM. Every user action that mutates the query is returned as a
 * plain `AcceptResult`/`KeyOutcome` so the host framework applies it — that is
 * what keeps the logic portable beyond React.
 */

export interface UseQueryInputOptions {
  /** Controlled query string. */
  query: string;
  /** Sources for value suggestions (tags, folder tree). */
  data: SuggestData;
  /** Filter-key registry; defaults to the bookmark preset. */
  registry?: Registry;
  /** Rows for the token dropdown; defaults to the built-in invert/remove pair. */
  tokenActions?: TokenActionProvider;
  disabled?: boolean;
}

export interface UseQueryInputResult {
  caret: number;
  setCaret: (caret: number) => void;
  focused: boolean;
  setFocused: (focused: boolean) => void;
  setDismissed: (dismissed: boolean) => void;
  suggestions: Suggestion[];
  activeIndex: number;
  /** Pure: compute the query + caret for accepting a suggestion. */
  accept: (suggestion: Suggestion) => AcceptResult | null;
  /** Run keyboard navigation; returns the outcome for the host to apply. */
  handleKeyDown: (event: KeyEventLike) => KeyOutcome | null;
}

export const useQueryInput = ({
  query,
  data,
  registry,
  tokenActions,
  disabled,
}: UseQueryInputOptions): UseQueryInputResult => {
  const [caret, setCaret] = useState(0);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dismissed, setDismissed] = useState(false);
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo(
    () =>
      focused && !dismissed && !disabled
        ? suggest(query, caret, data, registry, { tokenActions })
        : [],
    [
      query,
      caret,
      data,
      registry,
      tokenActions,
      dismissed,
      focused,
      disabled,
    ],
  );

  // Derived: keep the highlight within bounds instead of resetting via effect.
  const activeIndex =
    highlightedIndex >= 0 && highlightedIndex < suggestions.length
      ? highlightedIndex
      : -1;

  const accept = useCallback(
    (suggestion: Suggestion) => applySuggestion(query, suggestion),
    [query],
  );

  const handleKeyDown = useCallback(
    (event: KeyEventLike): KeyOutcome | null => {
      const resolution = resolveKeyEvent(event, {
        suggestions,
        activeIndex,
        highlightedIndex,
        query,
      });

      if (!resolution) return null;

      if (resolution.highlightedIndex !== undefined) {
        setHighlightedIndex(resolution.highlightedIndex);
      }

      if (resolution.dismissed !== undefined) {
        setDismissed(resolution.dismissed);
      }

      return resolution.outcome;
    },
    [suggestions, activeIndex, highlightedIndex, query],
  );

  return {
    caret,
    setCaret,
    focused,
    setFocused,
    setDismissed,
    suggestions,
    activeIndex,
    accept,
    handleKeyDown,
  };
};
