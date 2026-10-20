import { useMemo, useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { highlightSegments } from "@queryfield/core";
import type {
  AcceptResult,
  FilterToken,
  Registry,
  SuggestData,
  Suggestion,
  TokenActionProvider,
  TokenActionTone,
} from "@queryfield/core";
import { useQueryInput } from "./useQueryInput.ts";

/**
 * Presentational query field: a native single-line `<input>` (selection, undo,
 * copy/paste all work) with a mirror layer behind it that paints colored token
 * capsules, plus a suggestion listbox.
 *
 * Colours come from the host theme: the defaults below are plain Tailwind
 * utilities over `--token-*` CSS variables. Override `tokenClassName` /
 * `suggestionCapsuleClassName` (or replace the row entirely with
 * `renderSuggestion`) to restyle without forking.
 */

/** Capsule classes for a highlighted token in the mirror. */
export const TOKEN_CLASSES: Record<string, string> = {
  tag: "bg-token-tag-fill/15 text-token-tag",
  url: "bg-token-url-fill/15 text-token-url",
  title: "bg-token-title-fill/15 text-token-title",
  folder: "bg-token-folder-fill/15 text-token-folder",
  folder_strict: "bg-token-folder-strict-fill/15 text-token-folder-strict",
  added: "bg-token-date-fill/15 text-token-date",
  last_used: "bg-token-date-fill/15 text-token-date",
  visits: "bg-token-tracking-fill/15 text-token-tracking",
  frecency: "bg-token-tracking-fill/15 text-token-tracking",
  id: "bg-token-id-fill/15 text-token-id",
};

/** Capsule classes for the category pill in a suggestion row. */
export const CATEGORY_CLASSES: Record<string, string> = {
  tag: "bg-token-tag-pill text-token-tag",
  url: "bg-token-url-pill text-token-url",
  title: "bg-token-title-pill text-token-title",
  folder: "bg-token-folder-pill text-token-folder",
  folder_strict: "bg-token-folder-strict-pill text-token-folder-strict",
  date: "bg-token-date-pill text-token-date",
  added: "bg-token-date-pill text-token-date",
  "last used": "bg-token-date-pill text-token-date",
  visits: "bg-token-tracking-pill text-token-tracking",
  frecency: "bg-token-tracking-pill text-token-tracking",
  id: "bg-token-id-pill text-token-id",
  action: "bg-token-action-pill text-token-action",
};

const NEUTRAL_TOKEN = "bg-token-action-pill/15 text-token-action";
const NEUTRAL_CAPSULE = "bg-token-action-pill text-token-action";

/** px-1 -mx-1 widens the painted capsule without shifting the text after it. */
const TOKEN_CAPSULE = "rounded-[5px] px-0.5 -mx-0.5 -my-1 py-1.5";

export const defaultTokenClassName = (token: FilterToken): string => {
  const base = TOKEN_CLASSES[token.key] ?? NEUTRAL_TOKEN;

  return token.negated
    ? `${base} ${TOKEN_CAPSULE} line-through opacity-80`
    : `${base} ${TOKEN_CAPSULE}`;
};

export const defaultCapsuleClassName = (category?: string): string =>
  CATEGORY_CLASSES[category ?? ""] ?? NEUTRAL_CAPSULE;

const DEFAULT_WRAPPER_CLASS =
  "ring-focus-within relative flex w-full items-center rounded bg-input text-foreground focus-within:outline-none";

const DEFAULT_INPUT_CLASS =
  "relative z-10 w-full min-w-[100px] grow bg-transparent px-2 py-[7px] font-mono text-sm leading-5 text-transparent caret-foreground selection:bg-token-selection selection:text-transparent placeholder:text-muted-foreground/70 focus:outline-none";

const DEFAULT_MIRROR_CLASS =
  "pointer-events-none absolute inset-0 overflow-hidden px-2 py-[7px] font-mono text-sm leading-5 whitespace-pre";

const DEFAULT_LIST_CLASS =
  "absolute top-full left-0 z-50 mt-1 max-h-80 w-full max-w-[560px] min-w-[380px] overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground";

const ROW_BASE = "flex cursor-pointer items-center gap-2 rounded-sm p-1";

const ROW_ACTIVE = "font-medium ring-1 ring-ring";

/*
 * Action rows' colours live in standalone literals, never glued to a `${`
 * interpolation. Tailwind's extractor cannot recover a candidate that runs into
 * an interpolation (`text-token-invert-fg${…}`), which silently drops the
 * utility — the row keeps its background but loses its matching text colour.
 */
const ROW_ACTION_CLASSES: Record<TokenActionTone, string> = {
  action: "bg-token-action-pill text-token-action",
  invert: "bg-token-invert text-token-invert-fg",
  remove: "bg-token-remove text-token-remove-fg",
};

const rowClassName = (suggestion: Suggestion, active: boolean): string => {
  if (suggestion.tone) {
    const base = `${ROW_BASE} ${ROW_ACTION_CLASSES[suggestion.tone]}`;

    return active ? `${base} ${ROW_ACTIVE}` : base;
  }

  return active ? `${ROW_BASE} bg-muted` : `${ROW_BASE} hover:bg-muted`;
};

/*
 * Comment styling per row kind. Tinted rows paint their own foreground
 * (`text-token-invert-fg`, `text-token-remove-fg`, `text-token-action`);
 * forcing the muted colour on top of them made the text vanish into automata's
 * terracotta remove row (about 1.1:1). Inheriting keeps it readable while the
 * smaller size still reads as secondary.
 */
const DEFAULT_COMMENT_CLASS =
  "ml-auto shrink-0 pl-2 text-xs whitespace-nowrap text-muted-foreground";

const ACTION_COMMENT_CLASS = "ml-auto shrink-0 pl-2 text-xs whitespace-nowrap";

const DefaultSuggestionContent = (
  { suggestion, capsule }: { suggestion: Suggestion; capsule: string },
) => (
  <>
    {suggestion.category && (
      <span
        className={`shrink-0 rounded-[4px] px-2 py-0.5 text-xs font-medium ${capsule}`}
      >
        {suggestion.category}
      </span>
    )}
    <span className="truncate font-mono text-sm">{suggestion.label}</span>
    {suggestion.comment && (
      <span
        className={
          suggestion.tone ? ACTION_COMMENT_CLASS : DEFAULT_COMMENT_CLASS
        }
      >
        {suggestion.comment}
      </span>
    )}
  </>
);

export interface SuggestionState {
  active: boolean;
}

export interface QueryInputProps {
  /** Controlled query string. */
  query: string;
  onQueryChange: (query: string) => void;
  /** Sources for value suggestions (tags, folder tree). */
  data: SuggestData;
  /** Filter-key registry; defaults to the bookmark preset. */
  registry?: Registry;
  /** Rows for the token dropdown; defaults to the built-in invert/remove pair. */
  tokenActions?: TokenActionProvider;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  "aria-label"?: string;
  className?: string;
  inputClassName?: string;
  tokenClassName?: (token: FilterToken) => string;
  suggestionCapsuleClassName?: (category?: string) => string;
  /** Replace the inner content of a suggestion row (the row itself is managed). */
  renderSuggestion?: (
    suggestion: Suggestion,
    state: SuggestionState,
  ) => ReactNode;
}

export const QueryInput = ({
  query,
  onQueryChange,
  data,
  registry,
  tokenActions,
  placeholder,
  disabled,
  autoFocus,
  "aria-label": ariaLabel,
  className,
  inputClassName,
  tokenClassName,
  suggestionCapsuleClassName,
  renderSuggestion,
}: QueryInputProps) => {
  const {
    setCaret,
    setFocused,
    setDismissed,
    suggestions,
    activeIndex,
    accept,
    handleKeyDown,
  } = useQueryInput({ query, data, registry, tokenActions, disabled });

  const inputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  const tokenOf = tokenClassName ?? defaultTokenClassName;
  const capsuleOf = suggestionCapsuleClassName ?? defaultCapsuleClassName;

  const segments = useMemo(() => highlightSegments(query), [query]);

  const applyResult = (result: AcceptResult) => {
    // Compute the final caret synchronously and clamp it: the suggestion
    // list must never recompute with a stale or out-of-range caret.
    const pos = Math.min(result.caret, result.query.length);

    onQueryChange(result.query);
    setCaret(pos);
    setDismissed(false);

    requestAnimationFrame(() => {
      const input = inputRef.current;

      if (!input) return;
      // Don't yank caret/focus if the user already typed past our insert.
      if (input.value !== result.query || document.activeElement !== input) {
        return;
      }

      input.setSelectionRange(pos, pos);
    });
  };

  const acceptAndApply = (suggestion: Suggestion) => {
    const result = accept(suggestion);

    if (result) applyResult(result);
  };

  const syncCaret = () => {
    const input = inputRef.current;

    if (input) setCaret(input.selectionStart ?? input.value.length);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const outcome = handleKeyDown(event.nativeEvent);

    if (!outcome) return;

    if (outcome.type === "handled") {
      event.preventDefault();
      return;
    }

    if (outcome.type === "apply") {
      event.preventDefault();
      applyResult({ query: outcome.query, caret: outcome.caret });
      return;
    }

    if (outcome.type === "blur") inputRef.current?.blur();
    // "dismiss" already updated state; nothing else to do.
  };

  return (
    <div
      className={
        className ? `${DEFAULT_WRAPPER_CLASS} ${className}` : DEFAULT_WRAPPER_CLASS
      }
    >
      {/* Highlight mirror behind the input: identical metrics */}
      <div ref={mirrorRef} aria-hidden className={DEFAULT_MIRROR_CLASS}>
        {segments.map((part, i) =>
          part.token && part.token.kind === "filter" ? (
            <span key={i} className={`rounded-[3px] ${tokenOf(part.token)}`}>
              {part.text}
            </span>
          ) : (
            <span key={i}>{part.text}</span>
          ),
        )}
        {/* trailing space so the mirror width tracks the input */}
        {"\u200b"}
      </div>

      <input
        ref={inputRef}
        type="text"
        spellCheck={false}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        disabled={disabled}
        placeholder={placeholder}
        className={inputClassName ?? DEFAULT_INPUT_CLASS}
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setDismissed(false);
        }}
        onKeyUp={syncCaret}
        onClick={syncCaret}
        onSelect={syncCaret}
        onKeyDown={onKeyDown}
        onScroll={(e) => {
          if (mirrorRef.current) {
            mirrorRef.current.scrollLeft = e.currentTarget.scrollLeft;
          }
        }}
        onBlur={() => {
          setFocused(false);
          setTimeout(() => setDismissed(true), 150);
        }}
        onFocus={() => {
          setFocused(true);
          setDismissed(false);
        }}
      />

      {suggestions.length > 0 && (
        <ul className={DEFAULT_LIST_CLASS}>
          {suggestions.map((suggestion, index) => {
            const active = index === activeIndex;

            return (
              <li
                key={`${index}-${suggestion.label}`}
                className={
                  renderSuggestion ? "cursor-pointer rounded-sm" : rowClassName(suggestion, active)
                }
                onMouseDown={(e) => {
                  // Accept on mousedown: immune to blur/dismiss races.
                  e.preventDefault();
                  acceptAndApply(suggestion);
                }}
                ref={(el) => {
                  // Keep the highlighted option visible while arrowing
                  // through a scrolled list.
                  if (active && el) el.scrollIntoView({ block: "nearest" });
                }}
              >
                {renderSuggestion
                  ? renderSuggestion(suggestion, { active })
                  : (
                    <DefaultSuggestionContent
                      suggestion={suggestion}
                      capsule={capsuleOf(suggestion.category)}
                    />
                  )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
