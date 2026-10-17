# queryfield

A small filter-query language and search field, extracted from the bookmark-tags
extension. Two packages, split so the language stays framework-free:

| Package | What it is | Runtime deps |
| --- | --- | --- |
| [`@queryfield/core`](packages/core) | Parser, matcher, bounds, glob, suggestion engine, query editors, highlight splitter | **none** |
| [`@queryfield/react`](packages/react) | Headless `useQueryInput` hook + `QueryInput` component | React (peer) |

> Currently consumed by the host extension straight from source (path aliases,
> no build step), so there is no bundling yet — see [Status](#status).

## Layout

```
queryfield/
  package.json            bun workspaces root
  tsconfig.base.json
  packages/
    core/
      src/                the language (pure TS)
      tests/              bun tests
    react/
      src/                hook + component
      tests/              bun tests (happy-dom)
  examples/
    playground/           runnable Vite demo over mock (non-bookmark) data
```

## Commands

Run from this folder (bun is the package manager):

```sh
bun install                  # workspaces + example/test deps
bun test packages            # all package tests
bun run compile              # tsc --noEmit for every package
bun test packages/core/tests # one package
```

To play with the React package:

```sh
cd examples/playground && bun run dev
```

See [`examples/playground`](examples/playground) for what to try.

## Status

Early. The core is a faithful port of the in-extension implementation plus a
pluggable `Registry` and a `highlightSegments` helper. Packaging (bundling,
`exports` for `dist`, changesets, CI) is not done yet.

## Design notes

- **The query string is the single source of truth.** Parsing, editing, and
  matching all operate on the raw string; the UI never keeps a parallel filter
  state.
- **Incomplete tokens never filter.** A half-typed `tag:"` keeps results visible
  while typing.
- **Keys are data, not code.** Add a `KeySpec` to a registry to add a filter key;
  the engine needs no changes.
