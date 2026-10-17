import { describe, expect, test } from "bun:test";
import { highlightSegments } from "../src/highlight.ts";

describe("highlightSegments", () => {
  test("splits plain runs and filter tokens", () => {
    const parts = highlightSegments('hello tag:"tech" world');

    expect(parts.map((p) => p.text)).toEqual([
      "hello",
      " ",
      'tag:"tech"',
      " ",
      "world",
    ]);
    expect(parts[0]?.token).toMatchObject({ kind: "term", text: "hello" });
    expect(parts[1]?.token).toBeUndefined();
    expect(parts[2]?.token).toMatchObject({
      kind: "filter",
      key: "tag",
      value: "tech",
    });
  });

  test("an unterminated quote is not highlighted", () => {
    const parts = highlightSegments('tag:"new');

    expect(parts).toHaveLength(1);
    expect(parts[0]?.token).toBeUndefined();
    expect(parts[0]?.text).toBe('tag:"new');
  });

  test("empty query yields no segments", () => {
    expect(highlightSegments("")).toEqual([]);
  });
});
