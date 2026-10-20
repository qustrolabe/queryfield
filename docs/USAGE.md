# Token actions

How the token dropdown is built, and how a host adds, drops or reorders its
rows. The language, matcher and the rest of the field are documented in the
package READMEs ([core](../packages/core), [react](../packages/react)).

## What the dropdown shows

While the caret is inside a filter token, the suggestion list starts with the
built-in **Make negative / Make positive** and **Remove** rows, followed by
value completions for the token's partial value.

## Adding rows

`suggest` takes a fifth `options` argument. `tokenActions` receives the token
under the caret and returns the final row list:

```ts
import { serializeToken, suggest } from "@queryfield/core";

const suggestions = suggest(query, caret, data, registry, {
  tokenActions: ({ token }, defaults) => [
    ...defaults,
    {
      id: "convert:folder_strict",
      label: "Convert to folder_strict",
      category: "folder_strict",
      comment: "in this folder directly",
      tone: "action",
      insert: serializeToken({ ...token, key: "folder_strict" }),
    },
  ],
});
```

- `defaults` is the built-in pair, already labelled for the token's polarity.
  Return it, filter or reorder it, or drop it entirely (`return []`) — the
  return value is exactly what the dropdown shows.
- `insert` replaces the covering token; the package fills in the row's
  `replaceFrom`/`replaceTo`. Build it with `serializeToken` so quoting and
  negation survive.
- A row without `insert` must use a built-in `id` (`invert` / `remove`), which
  the package rewrites itself.
- `category` is the capsule text; it defaults to the token's key.
- `tone` picks the row tint; without it the row stays plain.

The provider is also the context: `{ token, query, registry }`, so a row can
look up the registry for labels, descriptions or a sibling key.

## Row tones

| `tone` | classes | default for |
| --- | --- | --- |
| `invert` | `bg-token-invert text-token-invert-fg` | Make negative / Make positive |
| `remove` | `bg-token-remove text-token-remove-fg` | Remove |
| `action` | `bg-token-action-pill text-token-action` | host rows that opt in |

The classes are `--token-*` theme variables, so a tone follows the host palette.
For anything outside that set, restyle through `suggestionCapsuleClassName` and
`renderSuggestion` instead of forking the field.

## Wiring

- `suggest(query, caret, data, registry?, options?)`
- `suggestFor(query, caret, data, registry?, options?)` — same arguments.
- `createQueryEngine(registry?, options?)` — binds the provider to the engine.
- `useQueryInput({ ..., tokenActions })`
- `<QueryInput tokenActions={...} />`
