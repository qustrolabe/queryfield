import { applySuggestion } from "@queryfield/core";
import type { Suggestion } from "@queryfield/core";

/**
 * Pure keyboard handling for the query field.
 *
 * Nothing here touches React: given the key event plus a snapshot of the input
 * state it returns the *next* state and an outcome for the host to apply. That
 * keeps the interesting logic unit-testable and portable to other frameworks.
 */

/** Minimal event shape needed (a native KeyboardEvent satisfies it). */
export interface KeyEventLike {
  key: string;
  isComposing?: boolean;
}

export type KeyOutcome =
  /** The key was consumed (arrow navigation) — the host should preventDefault. */
  | { type: "handled" }
  /** A suggestion was accepted; apply the query + caret. */
  | { type: "apply"; query: string; caret: number }
  /** Enter with nothing to accept; suggestions were dismissed. */
  | { type: "dismiss" }
  /** Escape; the host should blur the input. */
  | { type: "blur" };

export interface KeyEventContext {
  suggestions: Suggestion[];
  /** Resolved highlight (already clamped to the suggestion list). */
  activeIndex: number;
  /** Raw highlight, may be out of range. */
  highlightedIndex: number;
  query: string;
}

export interface KeyResolution {
  outcome: KeyOutcome | null;
  /** Present when the highlight should change. */
  highlightedIndex?: number;
  /** Present when the dismissed flag should change. */
  dismissed?: boolean;
}

/**
 * Resolve a key event into a state delta + outcome.
 * Returns null when the key is not ours to handle.
 */
export const resolveKeyEvent = (
  event: KeyEventLike,
  ctx: KeyEventContext,
): KeyResolution | null => {
  // Let IME composition (e.g. CJK candidates) handle its own keys.
  if (event.isComposing) return null;

  switch (event.key) {
    case "ArrowDown": {
      const len = ctx.suggestions.length;

      if (len === 0) {
        return { outcome: { type: "handled" }, highlightedIndex: -1, dismissed: false };
      }

      const next = Math.max(ctx.highlightedIndex, -1) + 1;

      return {
        outcome: { type: "handled" },
        highlightedIndex: next >= len ? 0 : next,
        dismissed: false,
      };
    }

    case "ArrowUp": {
      const len = ctx.suggestions.length;
      const next =
        len === 0 || ctx.highlightedIndex <= 0 ? -1 : ctx.highlightedIndex - 1;

      // Deliberately does not clear `dismissed`: arrowing up out of the list
      // must not reopen a dismissed list.
      return { outcome: { type: "handled" }, highlightedIndex: next };
    }

    case "Enter":
    case "Tab": {
      const index =
        event.key === "Enter"
          ? ctx.activeIndex
          : ctx.activeIndex === -1
            ? 0
            : ctx.activeIndex;

      const suggestion = ctx.suggestions[index];

      if (suggestion) {
        const result = applySuggestion(ctx.query, suggestion);

        return {
          outcome: result
            ? { type: "apply", ...result }
            : { type: "handled" },
        };
      }

      // Enter with nothing to accept closes the list; Tab falls through so the
      // browser can move focus.
      if (event.key === "Enter") {
        return { outcome: { type: "dismiss" }, dismissed: true };
      }

      return null;
    }

    case "Escape":
      return { outcome: { type: "blur" }, dismissed: true };

    default:
      return null;
  }
};
