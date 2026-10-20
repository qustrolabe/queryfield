import { describe, expect, test } from "bun:test";
import { applySuggestion } from "../src/apply.ts";
import { parseQuery } from "../src/parser.ts";
import { suggest } from "../src/suggest.ts";
import type { SuggestData } from "../src/suggest.ts";

const DATA: SuggestData = {
  tags: { tech: 10, testing: 5, gamedev: 3 },
  folderTree: [],
};

describe("applySuggestion", () => {
  test("splices an insert suggestion and moves the caret after it", () => {
    const query = "tech";
    const [suggestion] = suggest(query, 4, DATA);

    expect(suggestion?.insert).toBe('tag:"tech"');

    const result = applySuggestion(query, suggestion!);

    expect(result).toEqual({ query: 'tag:"tech"', caret: 'tag:"tech"'.length });
  });

  test("removes the token under the caret", () => {
    // Caret sits inside the first token -> an action list is offered.
    const query = 'tag:"tech" url:"x.test"';
    const remove = suggest(query, 3, DATA).find(
      (s) => s.action === "remove",
    );

    const result = applySuggestion(query, remove!);

    expect(result?.query).toBe('url:"x.test"');
  });

  test("inverts the token under the caret", () => {
    const query = 'tag:"tech" url:"x.test"';
    const invert = suggest(query, 3, DATA).find(
      (s) => s.action === "invert",
    );

    const result = applySuggestion(query, invert!);

    expect(result?.query).toBe('-tag:"tech" url:"x.test"');
  });

  test("returns null for a suggestion with nothing to apply", () => {
    const result = applySuggestion("x", {
      type: "value",
      label: "x",
      replaceFrom: 0,
      replaceTo: 1,
    });

    expect(result).toBeNull();
  });

  test("applies a host token action by splicing its insert", () => {
    const query = 'folder:"Projects" tag:tech';
    const [converted] = suggest(query, 8, DATA, undefined, {
      tokenActions: () => [
        {
          id: "convert:folder_strict",
          label: "Convert to folder_strict",
          insert: 'folder_strict:"Projects"',
        },
      ],
    });

    const result = applySuggestion(query, converted!);

    expect(result).toEqual({
      query: 'folder_strict:"Projects" tag:tech',
      caret: 'folder_strict:"Projects"'.length,
    });
  });

  test("the applied query re-parses to the expected token", () => {
    const query = "tech";
    const [suggestion] = suggest(query, 4, DATA);
    const result = applySuggestion(query, suggestion!);

    expect(parseQuery(result!.query).tokens[0]).toMatchObject({
      kind: "filter",
      key: "tag",
      value: "tech",
    });
  });
});
