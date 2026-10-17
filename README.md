# queryfield

A small filter-query language and search field, extracted from the bookmark-tags
extension. Two packages, split so the language stays framework-free:

| Package | What it is | Runtime deps |
| --- | --- | --- |
| [`@queryfield/core`](packages/core) | Parser, matcher, bounds, glob, suggestion engine, query editors, highlight splitter | **none** |
| [`@queryfield/react`](packages/react) | Headless `useQueryInput` hook + `QueryInput` component | React (peer) |

## Commands

Run from the repository root (bun is the package manager):

```sh
bun install                  # workspaces + example/test deps
bun test packages            # all package tests
bun run compile              # tsc --noEmit for every package
bun test packages/core/tests # one package
bun run release patch        # bump both packages, commit, tag (does not push)
```

To play with the React package:

```sh
cd examples/playground && bun run dev
```

See [`examples/playground`](examples/playground) for what to try.
