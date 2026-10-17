# @queryfield/react

React binding for [`@queryfield/core`](../core): a headless `useQueryInput` hook
plus a `QueryInput` field with token highlighting and a suggestion listbox.

## Install

```sh
bun add @queryfield/core @queryfield/react
```

`react >= 18` is a peer dependency.

## Usage

```tsx
import { useState } from "react";
import { QueryInput } from "@queryfield/react";

export function Search({ data }) {
  const [query, setQuery] = useState("");

  return (
    <QueryInput
      query={query}
      onQueryChange={setQuery}
      data={data} // { tags: Record<string, number>, folderTree: FolderSuggestNode[] }
      placeholder='tag:"tech" url:"google"'
    />
  );
}
```

The field keeps the input's text transparent and paints a mirror layer behind it,
so native selection/undo/copy-paste still work while tokens are highlighted.
Both layers use identical monospace metrics and sync their horizontal scroll.

### Headless

If you want your own markup, use the hook — it owns state but no DOM, and returns
plain results for the host to apply:

```tsx
const {
  suggestions, activeIndex,
  setCaret, setFocused, setDismissed,
  accept, handleKeyDown,
} = useQueryInput({ query, data });

// handleKeyDown returns one of:
//   { type: "handled" }                                 -> preventDefault
//   { type: "apply", query, caret }                     -> set state, move caret
//   { type: "dismiss" }                                 -> suggestions closed
//   { type: "blur" }                                    -> blur the input
```

### Styling

Defaults are Tailwind utilities over `--token-*` CSS variables (defined by the
host theme).

**Tailwind only scans your own project root**, so it will not see these classes —
point `@source` at this package's `src` directory from your stylesheet:

```css
/* Tailwind v4 — path is relative to the CSS file */
@source "../node_modules/@queryfield/react/src";
```

Without it, every utility the field uses is tree-shaken away and the field
degrades rather than erroring: the suggestion list stops being absolutely
positioned (it flows inline and reflows the layout), the highlight mirror renders
as a second copy of the text beside the input, and the token capsules lose their
colours. Skipping Tailwind entirely is fine — see the styling props below.

Override per call:

| Prop | Purpose |
| --- | --- |
| `className` | wrapper |
| `inputClassName` | the `<input>` |
| `tokenClassName(token)` | highlighted token capsule |
| `suggestionCapsuleClassName(category)` | category pill |
| `renderSuggestion(s, { active })` | replace a row's inner content |

`TOKEN_CLASSES` / `CATEGORY_CLASSES` and the default class functions are exported
if you want to extend rather than replace.

## Props

`query`, `onQueryChange`, `data`, `registry?`, `placeholder?`, `disabled?`,
`autoFocus?`, `aria-label?`, plus the styling props above.
