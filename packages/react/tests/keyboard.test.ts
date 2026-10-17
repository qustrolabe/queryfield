import { describe, expect, test } from "bun:test";
import { resolveKeyEvent } from "../src/keyboard.ts";
import type { KeyEventContext } from "../src/keyboard.ts";
import type { Suggestion } from "@queryfield/core";

/** A value suggestion that inserts `tag:"tech"` at the end of an empty query. */
const insertTech: Suggestion = {
  type: "value",
  label: 'tag:"tech"',
  category: "tag",
  replaceFrom: 0,
  replaceTo: 0,
  insert: 'tag:"tech"',
};

/** An action suggestion over a token spanning [0, 10). */
const removeTag: Suggestion = {
  type: "action",
  action: "remove",
  label: "Remove",
  category: "tag",
  replaceFrom: 0,
  replaceTo: 10,
};

const ctx = (over: Partial<KeyEventContext> = {}): KeyEventContext => ({
  suggestions: [],
  activeIndex: -1,
  highlightedIndex: -1,
  query: "",
  ...over,
});

describe("resolveKeyEvent — navigation", () => {
  test("ArrowDown selects the first suggestion", () => {
    const resolution = resolveKeyEvent(
      { key: "ArrowDown" },
      ctx({ suggestions: [insertTech, removeTag] }),
    );

    expect(resolution).toEqual({
      outcome: { type: "handled" },
      highlightedIndex: 0,
      dismissed: false,
    });
  });

  test("ArrowDown wraps from the last back to the first", () => {
    const resolution = resolveKeyEvent(
      { key: "ArrowDown" },
      ctx({
        suggestions: [insertTech, removeTag],
        highlightedIndex: 1,
      }),
    );

    expect(resolution?.highlightedIndex).toBe(0);
  });

  test("ArrowDown with no suggestions clears the highlight", () => {
    const resolution = resolveKeyEvent({ key: "ArrowDown" }, ctx());

    expect(resolution).toEqual({
      outcome: { type: "handled" },
      highlightedIndex: -1,
      dismissed: false,
    });
  });

  test("ArrowUp walks back and leaves the list at the top", () => {
    const two = [insertTech, removeTag];

    expect(
      resolveKeyEvent({ key: "ArrowUp" }, ctx({ suggestions: two, highlightedIndex: 1 }))
        ?.highlightedIndex,
    ).toBe(0);

    expect(
      resolveKeyEvent({ key: "ArrowUp" }, ctx({ suggestions: two, highlightedIndex: 0 }))
        ?.highlightedIndex,
    ).toBe(-1);
  });

  test("ArrowUp never clears an existing dismissal", () => {
    const resolution = resolveKeyEvent(
      { key: "ArrowUp" },
      ctx({ suggestions: [insertTech], highlightedIndex: 0 }),
    );

    expect(resolution?.dismissed).toBeUndefined();
  });
});

describe("resolveKeyEvent — acceptance", () => {
  test("Enter applies the active suggestion", () => {
    const resolution = resolveKeyEvent(
      { key: "Enter" },
      ctx({ suggestions: [insertTech], activeIndex: 0, query: "" }),
    );

    expect(resolution?.outcome).toEqual({
      type: "apply",
      query: 'tag:"tech"',
      caret: 'tag:"tech"'.length,
    });
  });

  test("Enter with nothing highlighted dismisses instead of accepting", () => {
    const resolution = resolveKeyEvent(
      { key: "Enter" },
      ctx({ suggestions: [insertTech], activeIndex: -1 }),
    );

    expect(resolution).toEqual({
      outcome: { type: "dismiss" },
      dismissed: true,
    });
  });

  test("Tab takes the first suggestion when none is highlighted", () => {
    const resolution = resolveKeyEvent(
      { key: "Tab" },
      ctx({ suggestions: [insertTech], activeIndex: -1, query: "" }),
    );

    expect(resolution?.outcome).toEqual({
      type: "apply",
      query: 'tag:"tech"',
      caret: 'tag:"tech"'.length,
    });
  });

  test("Tab with nothing to accept falls through to the browser", () => {
    expect(resolveKeyEvent({ key: "Tab" }, ctx())).toBeNull();
  });

  test("Escape blurs and dismisses", () => {
    const resolution = resolveKeyEvent({ key: "Escape" }, ctx());

    expect(resolution).toEqual({
      outcome: { type: "blur" },
      dismissed: true,
    });
  });

  test("an action suggestion rewrites the query", () => {
    const resolution = resolveKeyEvent(
      { key: "Enter" },
      ctx({ suggestions: [removeTag], activeIndex: 0, query: 'tag:"tech" x' }),
    );

    expect(resolution?.outcome).toEqual({
      type: "apply",
      query: "x",
      caret: 1,
    });
  });
});

describe("resolveKeyEvent — passthrough", () => {
  test("composition events are ignored", () => {
    expect(
      resolveKeyEvent({ key: "Enter", isComposing: true }, ctx({ suggestions: [insertTech], activeIndex: 0 })),
    ).toBeNull();
  });

  test("ordinary characters are ignored", () => {
    expect(resolveKeyEvent({ key: "a" }, ctx())).toBeNull();
  });
});
