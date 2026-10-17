import { describe, expect, test } from "bun:test";
import {
  createMatchContext,
  createQueryEngine,
  createRegistry,
} from "../src/index.ts";
import type { KeySpec } from "../src/registry.ts";
import type { BookmarkLike } from "../src/types.ts";

/** A host-specific item + key, to prove the engine is not bookmark-bound. */
interface PinnedItem extends BookmarkLike {
  pinned?: boolean;
}

const pinnedSpec: KeySpec = {
  key: "pinned",
  label: "pinned",
  description: "pinned items",
  kind: "text",
  match: (item) => Boolean((item as PinnedItem).pinned),
};

const items: PinnedItem[] = [
  { id: "1", title: "a", url: "https://a.test", pinned: true },
  { id: "2", title: "b", url: "https://b.test" },
];

const ctx = createMatchContext(items, {});

describe("createRegistry", () => {
  test("get is case-insensitive", () => {
    const registry = createRegistry([pinnedSpec]);

    expect(registry.get("PINNED")?.key).toBe("pinned");
  });

  test("find matches by key prefix", () => {
    const registry = createRegistry([pinnedSpec]);

    expect(registry.find("pin").map((s) => s.key)).toEqual(["pinned"]);
    expect(registry.find("nope")).toEqual([]);
  });
});

describe("createQueryEngine", () => {
  test("uses a custom registry to match", () => {
    const engine = createQueryEngine(createRegistry([pinnedSpec]));

    expect(engine.filter("pinned:yes", items, ctx).map((i) => i.id)).toEqual([
      "1",
    ]);
  });

  test("respects negation with a custom registry", () => {
    const engine = createQueryEngine(createRegistry([pinnedSpec]));

    expect(engine.filter("-pinned:yes", items, ctx).map((i) => i.id)).toEqual([
      "2",
    ]);
  });

  test("the default registry ignores unknown keys", () => {
    const engine = createQueryEngine();

    expect(engine.filter("pinned:yes", items, ctx)).toHaveLength(2);
  });
});
