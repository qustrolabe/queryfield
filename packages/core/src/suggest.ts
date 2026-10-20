import { parseQuery } from "./parser.ts";
import { defaultRegistry, type Registry } from "./registry.ts";
import { splitSegments } from "./glob.ts";
import {
  allNodes,
  childNames,
  descendantNames,
  resolveChain,
  type FolderSuggestNode,
} from "./folders.ts";
import type { FilterToken, ParsedQuery } from "./types.ts";

/**
 * Caret-aware suggestion engine.
 *
 * Modes (by input caret position):
 * - Over an existing token -> token actions first (the built-in invert/remove
 *   pair plus any rows the host adds), then value completions for that token's
 *   partial value (e.g. tag:"new" -> new_notes).
 * - Typing a key prefix (`tag`, `-ur`) -> matching key suggestions.
 * - Typing a value after `key:` -> real-data + premade template suggestions,
 *   each carrying a category capsule and grey explanatory comment.
 *
 * Tag values are matched in tiers (see `tagMatchRank`), so a query that only
 * lands on one path segment — `image` for `ai/imagegen` — still finds the tag.
 */

export interface SuggestData {
  /** tag -> bookmark count (keys are display casings) */
  tags: Record<string, number>;
  /** Folder tree for folder:/folder_strict: suggestions. */
  folderTree: FolderSuggestNode[];
}

/** Row tints a token action can use; `action` is the neutral action colour. */
export type TokenActionTone = "action" | "invert" | "remove";

export interface Suggestion {
  type: "action" | "key" | "value";
  /**
   * For actions: what to do with the token under the caret. `invert` and
   * `remove` are built in; any other id belongs to the host and must carry
   * `insert`.
   */
  action?: string;
  /**
   * Row tint. The built-ins set theirs; host rows inherit it from
   * `TokenAction.tone` and stay plain when it is absent.
   */
  tone?: TokenActionTone;
  /** Main display text. */
  label: string;
  /** Capsule text in front, e.g. "tag", "date". */
  category?: string;
  /** Grey explanatory comment shown on the side. */
  comment?: string;
  /**
   * Replace query[replaceFrom..replaceTo] with `insert` on accept.
   * Built-in actions ignore this (they rewrite the query themselves).
   */
  replaceFrom: number;
  replaceTo: number;
  insert?: string;
}

/** What a host's token-action provider gets to look at. */
export interface TokenActionContext {
  /** Filter token the caret is inside. */
  token: FilterToken;
  /** Full query string. */
  query: string;
  /** Registry of this surface, for label/description lookups. */
  registry: Registry;
}

/**
 * One row of the token dropdown.
 *
 * `insert` replaces the covering token as a whole — quoting, negation and value
 * are the host's business (`serializeToken` handles them). Rows that omit it
 * must use a built-in `id` (`invert` / `remove`), which the package rewrites
 * itself.
 */
export interface TokenAction {
  /** `invert` / `remove` for the built-ins; any stable id for host rows. */
  id: string;
  label: string;
  /** Capsule text; defaults to the token's key, like the built-ins. */
  category?: string;
  comment?: string;
  /**
   * Row tint. Built-ins pick theirs; `"action"` gives a host row the neutral
   * action colour, and leaving it out keeps the plain row.
   */
  tone?: TokenActionTone;
  insert?: string;
}

/**
 * Returns the rows the dropdown should offer for the token under the caret.
 *
 * `defaults` is the built-in invert/remove pair, already labelled for the
 * token's current polarity. Return it as-is, filter or reorder it, or append
 * rows of your own — the returned list is exactly what the dropdown shows.
 */
export type TokenActionProvider = (
  context: TokenActionContext,
  defaults: TokenAction[],
) => TokenAction[];

/** Optional behaviour for `suggest`; nothing here is required. */
export interface SuggestOptions {
  /** Rows for the token dropdown; replaces the built-in list when supplied. */
  tokenActions?: TokenActionProvider;
}

const DATE_TEMPLATES: { value: string; comment: string }[] = [
  { value: "<1d", comment: "within 24 hours" },
  { value: "<3d", comment: "last 3 days" },
  { value: "<1w", comment: "this week" },
  { value: "<1mo", comment: "this month" },
  { value: "<1y", comment: "this year" },
  { value: ">1mo", comment: "older than a month" },
  { value: ">1y", comment: "older than a year" },
  { value: ">2mo<1y", comment: "between 2 months and a year old" },
];

const NUMBER_TEMPLATES = (unit: string): { value: string; comment: string }[] => [
  { value: ">10", comment: `more than 10 ${unit}` },
  { value: ">100", comment: `more than 100 ${unit}` },
  { value: "<5", comment: `fewer than 5 ${unit}` },
  { value: "=0", comment: `zero ${unit}` },
];

const MAX_SUGGESTIONS = 12;

/** Shortest query worth a fuzzy (subsequence) match; single letters are noise. */
const MIN_FUZZY_LENGTH = 2;

/** True when every character of `needle` occurs in `haystack`, in order. */
const isSubsequence = (needle: string, haystack: string): boolean => {
  let at = 0;

  for (let i = 0; i < haystack.length && at < needle.length; i += 1) {
    if (haystack[i] === needle[at]) at += 1;
  }

  return at === needle.length;
};

/**
 * How well a tag matches the typed query. Lower is better; `null` = no match.
 *
 * Tiers, so closer hits always outrank fuzzier ones:
 *   0 exact
 *   1 whole-tag prefix — `ai/` lists every `ai/*` tag
 *   2 path-segment prefix — `image` finds `ai/imagegen`
 *   3 substring — the query appears anywhere in the tag
 *   4 subsequence — the query's characters appear in order, gaps allowed
 *
 * `/` stays an ordinary character (flat tag model), so the segment tier is a
 * refinement of substring matching rather than real hierarchy.
 */
export const tagMatchRank = (tag: string, query: string): number | null => {
  const lower = tag.toLowerCase();
  const q = query.toLowerCase();

  if (lower === q) return 0;
  if (lower.startsWith(q)) return 1;
  if (lower.split("/").some((segment) => segment.startsWith(q))) return 2;
  if (lower.includes(q)) return 3;
  if (q.length >= MIN_FUZZY_LENGTH && isSubsequence(q, lower)) return 4;

  return null;
};

/**
 * Tags matching `query`, best first: match tier, then most-used, then name.
 * Empty queries match everything, which keeps the "show all tags" behaviour.
 */
export const rankTagMatches = (
  tags: Iterable<{ tag: string; count: number }>,
  query: string,
): Array<{ tag: string; count: number }> => {
  const ranked: Array<{ tag: string; count: number; rank: number }> = [];

  for (const entry of tags) {
    const rank = tagMatchRank(entry.tag, query);

    if (rank !== null) ranked.push({ ...entry, rank });
  }

  return ranked
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        b.count - a.count ||
        a.tag.localeCompare(b.tag),
    )
    .map(({ tag, count }) => ({ tag, count }));
};

/** Tag index entries as the matcher's input shape. */
const tagEntries = (tags: SuggestData["tags"]) =>
  Object.entries(tags).map(([tag, count]) => ({ tag, count }));

/** Locate the raw fragment being typed right before the caret. */
const activeFragment = (
  query: string,
  caret: number,
): { start: number; text: string } => {
  const upto = query.slice(0, caret);

  const ws = Math.max(
    upto.lastIndexOf(" "),
    upto.lastIndexOf("\t"),
    upto.lastIndexOf("\n"),
  );

  return { start: ws + 1, text: upto.slice(ws + 1) };
};

interface Fragment {
  negated: boolean;
  key: string | null;
  valuePrefix: string;
  quoted: boolean;
}

const parseFragment = (text: string): Fragment => {
  let rest = text;
  let negated = false;

  if (rest.startsWith("-")) {
    negated = true;
    rest = rest.slice(1);
  }

  const colon = rest.indexOf(":");

  if (colon === -1) {
    return { negated, key: null, valuePrefix: rest, quoted: false };
  }

  const key = rest.slice(0, colon).toLowerCase();
  let valuePrefix = rest.slice(colon + 1);
  let quoted = false;

  if (valuePrefix.startsWith('"')) {
    quoted = true;
    valuePrefix = valuePrefix.slice(1);
  }

  return { negated, key, valuePrefix, quoted };
};

const buildFilterText = (
  specKind: string,
  frag: Fragment,
  key: string,
  value: string,
): string => {
  // Text values default to quoted form; date/number templates stay bare.
  const needsQuotes =
    specKind === "text" || frag.quoted || /[\s]/.test(value) || value === "";

  const serialized = needsQuotes ? `"${value}"` : value;

  return `${frag.negated ? "-" : ""}${key}:${serialized}`;
};

/** Value suggestions for one key spec. */
const valueSuggestions = (
  key: string,
  frag: Fragment,
  data: SuggestData,
  /** Existing "key:value" pairs in the query (lowercased) to skip. */
  existing: Set<string>,
  /** Folder nodes that other folder tokens constrain suggestions to. */
  folderConstraintNodes: FolderSuggestNode[] | null,
  registry: Registry,
): Suggestion[] => {
  const spec = registry.get(key);

  if (!spec) return [];
  const prefix = frag.valuePrefix.toLowerCase();
  const out: Suggestion[] = [];

  const push = (
    value: string,
    comment?: string,
    category: string = spec.label,
  ) => {
    // Don't offer a value already present in the query for this key.
    if (existing.has(`${key}:${value.toLowerCase()}`)) return;
    out.push({
      type: "value",
      label: buildFilterText(spec.kind, frag, key, value),
      category,
      comment,
      replaceFrom: -1, // filled by caller
      replaceTo: -1,
      insert: buildFilterText(spec.kind, frag, key, value),
    });
  };

  if (spec.kind === "text") {
    const isFolderKey = key === "folder" || key === "folder_strict";

    if (key === "tag") {
      rankTagMatches(tagEntries(data.tags), prefix).forEach(({ tag, count }) =>
        push(tag, `${count} bookmarks`),
      );
    } else if (isFolderKey) {
      // Leading "/" anchors at the tree top; otherwise chains anchor
      // anywhere (or under another folder token's subtree).
      const raw = frag.valuePrefix;
      const anchored = raw.startsWith("/");
      const inner = anchored ? raw.slice(1) : raw;
      const endsWithSlash = inner.endsWith("/");
      const segments = splitSegments(inner);

      const partial = endsWithSlash
        ? ""
        : (segments[segments.length - 1] ?? "").toLowerCase();

      const completed = endsWithSlash ? segments : segments.slice(0, -1);

      const chainPrefix =
        (anchored ? "/" : "") +
        (completed.length > 0 ? completed.join("/") + "/" : "");

      // Scope candidates:
      // - anchored -> children of the resolved chain from the tree top,
      // - inside a chain -> children of the resolved chain,
      // - constrained by another folder token -> children of those nodes,
      // - otherwise -> every folder name in the tree.
      let candidateNames: string[];

      if (anchored) {
        const bases =
          completed.length > 0
            ? resolveChain(data.folderTree, completed)
            : data.folderTree;

        candidateNames = childNames(bases);
      } else if (completed.length > 0 || folderConstraintNodes) {
        const bases =
          completed.length > 0
            ? resolveChain(
                folderConstraintNodes ?? allNodes(data.folderTree),
                completed,
              )
            : folderConstraintNodes ?? [];

        candidateNames = childNames(bases);
      } else {
        candidateNames = descendantNames(data.folderTree);
      }

      candidateNames
        .filter((name) => name.toLowerCase().startsWith(partial))
        .sort()
        .forEach((name) =>
          push(chainPrefix + name, spec.description),
        );

      // Empty value = the root level ("/" lists it too).
      if (
        !anchored &&
        completed.length === 0 &&
        !folderConstraintNodes &&
        partial === ""
      ) {
        push("", "top-level folders");
      }
    } else {
      // url/title: no meaningful static sources; offer wildcard hint.
      if (prefix === "") {
        push(`*${prefix}`, "use * as wildcard");
      }
    }
  } else if (spec.kind === "date") {
    DATE_TEMPLATES.forEach(({ value, comment }) => {
      if (!prefix || value.toLowerCase().startsWith(prefix)) {
        push(value, comment, "date");
      }
    });
  } else {
    const unit = key === "visits" ? "visits" : key === "id" ? "" : "score";
    NUMBER_TEMPLATES(unit).forEach(({ value, comment }) => {
      if (!prefix || value.startsWith(prefix)) {
        push(value, comment, spec.label);
      }
    });
  }

  return out.slice(0, MAX_SUGGESTIONS);
};

/**
 * Mixed suggestions for a BARE fragment (no key typed yet): matching keys,
 * tags, folders and — for number-like fragments — date/number templates
 * across keys, all merged into one relevance-ordered list.
 */
const bareSuggestions = (
  frag: Fragment,
  data: SuggestData,
  existing: Set<string>,
  registry: Registry,
): Suggestion[] => {
  const prefix = frag.valuePrefix.toLowerCase();
  const neg = frag.negated ? "-" : "";
  const out: Suggestion[] = [];

  const pushToken = (
    tokenText: string,
    category: string,
    comment?: string,
  ) => {
    out.push({
      type: "value",
      label: tokenText,
      category,
      comment,
      replaceFrom: -1,
      replaceTo: -1,
      insert: tokenText,
    });
  };

  // Matching keys first.
  out.push(...keySuggestions(frag, registry));

  // Tags by match quality, then count.
  rankTagMatches(tagEntries(data.tags), prefix).forEach(({ tag, count }) => {
    const text = `${neg}tag:"${tag}"`;

    if (!existing.has(`tag:${tag.toLowerCase()}`)) {
      pushToken(text, "tag", `${count} bookmarks`);
    }
  });

  // Folders (anywhere in the tree).
  descendantNames(data.folderTree)
    .filter((name) => name.toLowerCase().startsWith(prefix))
    .sort()
    .forEach((name) => {
      const text = `${neg}folder:"${name}"`;

      if (!existing.has(`folder:${name.toLowerCase()}`)) {
        pushToken(text, "folder", "in this folder or any subfolder");
      }
    });

  // Number-ish fragments also surface date/number templates across keys.
  if (/^[<>=]?\d/.test(prefix)) {
    DATE_TEMPLATES.forEach(({ value, comment }) => {
      if (value.startsWith(prefix)) {
        pushToken(`${neg}added:${value}`, "date", `added ${comment}`);
        pushToken(`${neg}last_used:${value}`, "date", `last used ${comment}`);
      }
    });
    NUMBER_TEMPLATES("visits").forEach(({ value, comment }) => {
      if (value.startsWith(prefix)) {
        pushToken(`${neg}visits:${value}`, "visits", comment);
        pushToken(`${neg}frecency:${value}`, "frecency", comment.replace("visits", "score"));
      }
    });
  }

  return out.slice(0, MAX_SUGGESTIONS);
};

/** Key suggestions for a typed prefix like `tag` / `-ur`. */
const keySuggestions = (frag: Fragment, registry: Registry): Suggestion[] => {
  const prefix = (frag.valuePrefix ?? "").toLowerCase();

  return registry
    .find(prefix)
    .slice(0, MAX_SUGGESTIONS)
    .map((spec) => ({
      type: "key" as const,
      label: `${frag.negated ? "-" : ""}${spec.key}:`,
      category: spec.label,
      comment: spec.description,
      replaceFrom: -1,
      replaceTo: -1,
      insert: `${frag.negated ? "-" : ""}${spec.key}:"`,
    }));
};

/** Built-in dropdown rows for the token under the caret. */
export const defaultTokenActions = ({
  token,
}: TokenActionContext): TokenAction[] => [
  {
    id: "invert",
    label: token.negated ? "Make positive" : "Make negative",
    comment: token.negated
      ? "include matching items"
      : "exclude matching items",
  },
  {
    id: "remove",
    label: "Remove",
    comment: "delete this filter from the query",
  },
];

/** The built-in rows paint themselves; host rows opt in through `tone`. */
const builtInTone = (id: string): TokenActionTone | undefined => {
  if (id === "invert") return "invert";

  if (id === "remove") return "remove";

  return undefined;
};

/** Turn a token action into the row shape the list and `applySuggestion` use. */
const actionSuggestion = (
  action: TokenAction,
  token: FilterToken,
): Suggestion => ({
  type: "action",
  action: action.id,
  tone: action.tone ?? builtInTone(action.id),
  label: action.label,
  category: action.category ?? token.key,
  comment: action.comment,
  replaceFrom: token.start,
  replaceTo: token.end,
  insert: action.insert,
});

/**
 * Compute suggestions for the given query and caret offset.
 */
export const suggest = (
  query: string,
  caret: number,
  data: SuggestData,
  registry: Registry = defaultRegistry,
  options: SuggestOptions = {},
): Suggestion[] => {
  const parsed: ParsedQuery = parseQuery(query);

  /** A token is complete when it isn't an unterminated quoted value. */
  const isCompleteToken = (token: ParsedQuery["tokens"][number]) =>
    !(token.kind === "filter" && token.incomplete);

  // 1. Token under caret: caret anywhere from token start up to (but not
  // including) its end counts as inside -> actions + completions.
  // Incomplete tokens (e.g. typing inside `tag:"new`) are NOT "inside":
  // the user is mid-typing, so fragment/value completion mode applies.
  const covering = parsed.tokens.find(
    (token) =>
      caret >= token.start &&
      caret < token.end &&
      isCompleteToken(token),
  );

  if (covering && covering.kind === "filter") {
    const context: TokenActionContext = { token: covering, query, registry };
    const defaults = defaultTokenActions(context);
    const actions = (options.tokenActions?.(context, defaults) ?? defaults).map(
      (action) => actionSuggestion(action, covering),
    );

    // Existing key:value pairs — INCLUDING the token under the caret,
    // whose value is already offered explicitly as the "current value"
    // suggestion below; without this it would appear twice.
    const existing = new Set(
      parsed.tokens
        .filter((t): t is FilterToken => t.kind === "filter")
        .map((t) => `${t.key}:${t.value.toLowerCase()}`),
    );

    // Other folder tokens in the query scope folder suggestions to their
    // subtree (e.g. with folder:"Projects" present, suggest only subfolders
    // of Projects).
    const constraintSegments = parsed.tokens.flatMap((t) =>
      t.kind === "filter" &&
      t !== covering &&
      (t.key === "folder" || t.key === "folder_strict")
        ? splitSegments(t.value)
        : [],
    );

    const folderConstraintNodes =
      constraintSegments.length > 0
        ? resolveChain(allNodes(data.folderTree), constraintSegments)
        : null;

    // Value completions for the partial value inside this token.
    const innerCaret = caret - covering.start;
    const tokenText = query.slice(covering.start, covering.end);
    const frag = parseFragment(tokenText);

    const virtualFrag: Fragment = {
      ...frag,
      valuePrefix: frag.valuePrefix.slice(
        0,
        Math.max(0, innerCaret -
          (tokenText.indexOf(":") + 1 + (frag.quoted ? 1 : 0))),
      ),
    };

    const completions = valueSuggestions(
      covering.key,
      virtualFrag,
      data,
      existing,
      folderConstraintNodes,
      registry,
    ).map((s) => ({
      ...s,
      replaceFrom: covering.start,
      replaceTo: covering.end,
    }));

    // Always offer the token's current value as-is ("keep this one").
    const coveringText = query.slice(covering.start, covering.end);

    const selfSuggestion: Suggestion | null = covering.value
      ? {
          type: "value",
          label: coveringText,
          category: registry.get(covering.key)?.label ?? covering.key,
          comment: "current value",
          replaceFrom: covering.start,
          replaceTo: covering.end,
          insert: coveringText,
        }
      : null;

    return [...actions, ...(selfSuggestion ? [selfSuggestion] : []), ...completions];
  }

  // 2. Fragment currently being typed (empty -> suggest all keys).
  const fragment = activeFragment(query, caret);

  // Caret right after a fully quoted value means the token is complete:
  // assume the user is starting a NEW token (insert with a space).
  // Unterminated quoted tokens are mid-typing -> completion mode instead.
  const afterQuotedToken = parsed.tokens.some(
    (token) =>
      token.kind === "filter" &&
      token.quoted &&
      !token.incomplete &&
      caret === token.end,
  );

  if (fragment.text === "" || afterQuotedToken) {
    return keySuggestions(
      {
        negated: false,
        key: null,
        valuePrefix: "",
        quoted: false,
      },
      registry,
    ).map((s) => ({
      ...s,
      replaceFrom: caret,
      replaceTo: caret,
      insert: (afterQuotedToken && fragment.text !== "" ? " " : "") + s.insert,
    }));
  }

  const frag = parseFragment(fragment.text);

  // Tokens overlapping the fragment being typed are mid-edit — they must
  // not act as constraints or dedupe sources.
  const notBeingEdited = (t: FilterToken) =>
    t.start >= caret || t.end <= fragment.start;

  // Exclude values already present anywhere else in the query.
  const existing = new Set(
    parsed.tokens
      .filter((t): t is FilterToken => t.kind === "filter" && notBeingEdited(t))
      .map((t) => `${t.key}:${t.value.toLowerCase()}`),
  );

  // Folder tokens in the query scope folder suggestions to their subtree.
  const constraintSegments = parsed.tokens.flatMap((t) =>
    t.kind === "filter" &&
    notBeingEdited(t) &&
    (t.key === "folder" || t.key === "folder_strict")
      ? splitSegments(t.value)
      : [],
  );

  const folderConstraintNodes =
    constraintSegments.length > 0
      ? resolveChain(allNodes(data.folderTree), constraintSegments)
      : null;

  if (frag.key === null) {
    return bareSuggestions(frag, data, existing, registry).map((s) => ({
      ...s,
      replaceFrom: fragment.start,
      replaceTo: caret,
    }));
  }

  return valueSuggestions(frag.key, frag, data, existing, folderConstraintNodes, registry).map((s) => ({
    ...s,
    replaceFrom: fragment.start,
    replaceTo: caret,
  }));
};
