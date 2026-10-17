# queryfield playground

A tiny Vite + React app that runs `@queryfield/react`'s `QueryInput` against
**mock data that is not bookmarks** — a recipe box. It exists so you can see the
field, the suggestion list, and the query language working without loading the
extension.

```sh
bun install          # from the queryfield/ root
bun run dev          # from this folder
```

## What to try

- Type `tag:` — suggestion keys appear, completions come from the tags found in
  the recipe titles.
- Type `folder:"` — collections come from the mock collection tree, and nested
  chains like `folder:"Weeknight/Quick"` work.
- Arrow through the list and press Enter (or Tab) to accept. Escape blurs.
  Ctrl/Cmd+Z still works — the field is a real `<input>`.
- Put the caret inside an existing token and use the Invert / Remove rows.
- Click a chip under the field for a worked example, then edit it.

The panel below the field shows the parsed tokens, so you can watch a raw string
turn into `key = value` filters.

## The data

`src/data.ts` is a recipe box: 18 recipes (titles carry `#hashtags`), five
collections (plain nodes with no `url`), and a visit-stats record. It only
satisfies the core's item shape:

```ts
{ id, title, url?, parentId?, dateAdded?, dateLastUsed? }
```

Nothing about it is bookmark-specific — that is the point of the extraction.

## Styling

`src/theme.css` is the smallest thing that makes the component's **default**
Tailwind classes render: it maps `--token-*` variables into Tailwind's colour
namespace and gives them light/dark values. The extension's real stylesheet does
the same thing with more themes.

It also carries an explicit `@source "../../../packages/react/src"` line.
Tailwind only auto-detects sources under the Vite root, and the package lives
outside it — remove that line and the component still renders, but broken: the
suggestion list loses `absolute top-full` (so it flows inline and shoves the
layout around), and the highlight mirror loses `absolute inset-0` (so it shows up
as a duplicate of the input's text). Any host consuming `@queryfield/react`'s
default classes needs the equivalent line; see the package README.

Everything is still overridable at the call site — `className`,
`inputClassName`, `tokenClassName`, `suggestionCapsuleClassName`, and
`renderSuggestion` — so you can drop Tailwind entirely and pass your own class
names.
