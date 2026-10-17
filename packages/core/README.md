# @queryfield/core

Framework-free filter-query language: parse a query string into tokens, match
items against it, and generate caret-aware suggestions. Zero runtime
dependencies — no React, no browser API.

## Install

```sh
bun add @queryfield/core
```

## Concepts

A query is a plain string:

```
url:"google" tag:"tech" -tag:"web" last_used:<1w visits:>10 folder:"dev/tools"
```

- whitespace separates tokens; `"quoted values"` may contain spaces
- `-` negates a token
- `key:value` filters; unknown keys never exclude anything
- an unterminated quote is an *incomplete* token — it never filters, so results
  stay visible while typing

## Usage

```ts
import {
  createQueryEngine,
  createMatchContext,
  highlightSegments,
} from "@queryfield/core";

const ctx = createMatchContext(items, stats); // items: QueryItem[]
const engine = createQueryEngine(); // default (bookmark) registry

const hits = engine.filter('tag:"tech" -folder:"Archive"', items, ctx);

const suggestions = engine.suggest('tag:"ne', 7, {
  tags: { tech: 10, testing: 4 },
  folderTree: [],
});

const parts = highlightSegments('tag:"tech" foo');
// -> [{ text: 'tag:"tech"', token }, { text: " " }, { text: "foo", token }]
```

The lower-level functions are exported too: `parseQuery`, `serializeQuery`,
`matchBookmark`, `filterBookmarks`, `suggest`, `cycleToken`, `tokenState`,
`appendToken`, `setTokenState`, `extractTags`, `buildTagIndex`,
`buildFolderTree`, and the `bounds`/`glob` helpers.

## Custom filter keys

The default registry is the bookmark preset (`tag`, `url`, `title`, `added`,
`last_used`, `visits`, `frecency`, `id`, `folder`, `folder_strict`). Ship your own
without touching the engine:

```ts
import { createQueryEngine, createRegistry, type KeySpec } from "@queryfield/core";

const starred: KeySpec = {
  key: "starred",
  label: "starred",
  description: "starred items",
  kind: "text",
  match: (item) => Boolean((item as { starred?: boolean }).starred),
};

const engine = createQueryEngine(createRegistry([starred]));
```

`KeySpec` is the only extension point: `key`, `label`, `description`, `kind`
(`text | date | number | id`), a positive-sense `match`, and an optional
`validate`.

## The item shape

`QueryItem` / `BookmarkLike` is structural: `{ id, title, url?, parentId?,
dateAdded?, dateLastUsed? }`. `MatchContext` supplies the host-specific bits —
`tagsOf`, `ancestorIdsOf`, `folderNameById`, `stats`, `rootFolderIds`.

For the bookmark preset, tags are `#name` tokens inside titles and folders are
`url === undefined` nodes; other hosts can provide different `tagsOf` /
`ancestorIdsOf` implementations.

## Known gaps

- Tag and folder suggestion *sources* are preset-specific (keyed on `tag:` and
  `folder:`), not yet pluggable.
- Source imports carry explicit `.ts` extensions; a bundler (e.g. tsup) or a
  specifier rewrite is needed before publishing a `dist`.
