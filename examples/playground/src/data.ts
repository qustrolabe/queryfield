import {
  buildFolderTree,
  buildTagIndex,
  createMatchContext,
} from "@queryfield/core";
import type { BookmarkLike, MatchContext, SuggestData } from "@queryfield/core";

/**
 * Mock data for the demo: a recipe box, deliberately *not* bookmarks.
 *
 * It only has to satisfy the core's `QueryItem` shape — id/title/url/parentId/
 * dates — which is exactly the point: the engine does not know or care that
 * these were bookmarks in the original app. Tags are `#hashtags` in the title,
 * and "collections" are plain nodes with no `url`.
 */

const DAY = 86_400_000;
const now = Date.now();
const daysAgo = (n: number) => now - n * DAY;

const COLLECTIONS: BookmarkLike[] = [
  { id: "0", title: "Recipe box" },
  { id: "c-baking", title: "Baking", parentId: "0" },
  { id: "c-weeknight", title: "Weeknight", parentId: "0" },
  { id: "c-quick", title: "Quick", parentId: "c-weeknight" },
  { id: "c-weekend", title: "Weekend projects", parentId: "0" },
];

export const RECIPES: BookmarkLike[] = [
  {
    id: "r01",
    title: "Sourdough bread #bread #baking #fermentation",
    url: "https://recipes.test/sourdough",
    parentId: "c-weekend",
    dateAdded: daysAgo(400),
    dateLastUsed: daysAgo(3),
  },
  {
    id: "r02",
    title: "No-knead focaccia #bread #baking",
    url: "https://recipes.test/focaccia",
    parentId: "c-baking",
    dateAdded: daysAgo(300),
    dateLastUsed: daysAgo(12),
  },
  {
    id: "r03",
    title: "Brown butter cookies #baking #dessert",
    url: "https://recipes.test/cookies",
    parentId: "c-baking",
    dateAdded: daysAgo(220),
    dateLastUsed: daysAgo(40),
  },
  {
    id: "r04",
    title: "Miso soup #soup #quick #japanese",
    url: "https://recipes.test/miso-soup",
    parentId: "c-quick",
    dateAdded: daysAgo(180),
    dateLastUsed: daysAgo(1),
  },
  {
    id: "r05",
    title: "Garlic butter noodles #quick #pasta",
    url: "https://recipes.test/garlic-noodles",
    parentId: "c-quick",
    dateAdded: daysAgo(170),
    dateLastUsed: daysAgo(2),
  },
  {
    id: "r06",
    title: "Weeknight ragù #pasta #weeknight #slow",
    url: "https://recipes.test/ragu",
    parentId: "c-weeknight",
    dateAdded: daysAgo(160),
    dateLastUsed: daysAgo(9),
  },
  {
    id: "r07",
    title: "Thai green curry #curry #quick #spicy",
    url: "https://recipes.test/green-curry",
    parentId: "c-quick",
    dateAdded: daysAgo(150),
    dateLastUsed: daysAgo(6),
  },
  {
    id: "r08",
    title: "Slow-roast lamb shoulder #weekend #slow #meat",
    url: "https://recipes.test/lamb",
    parentId: "c-weekend",
    dateAdded: daysAgo(140),
    dateLastUsed: daysAgo(60),
  },
  {
    id: "r09",
    title: "Shakshuka #breakfast #quick #eggs",
    url: "https://recipes.test/shakshuka",
    parentId: "c-quick",
    dateAdded: daysAgo(120),
    dateLastUsed: daysAgo(5),
  },
  {
    id: "r10",
    title: "Kimchi fried rice #quick #korean #rice",
    url: "https://recipes.test/kimchi-rice",
    parentId: "c-quick",
    dateAdded: daysAgo(110),
    dateLastUsed: daysAgo(8),
  },
  {
    id: "r11",
    title: "Cold-fermented pizza dough #bread #baking #fermentation",
    url: "https://recipes.test/pizza-dough",
    parentId: "c-weekend",
    dateAdded: daysAgo(100),
    dateLastUsed: daysAgo(21),
  },
  {
    id: "r12",
    title: "Lemon posset #dessert #quick",
    url: "https://recipes.test/posset",
    parentId: "c-quick",
    dateAdded: daysAgo(90),
    dateLastUsed: daysAgo(30),
  },
  {
    id: "r13",
    title: "Biryani #rice #weekend #spicy",
    url: "https://recipes.test/biryani",
    parentId: "c-weekend",
    dateAdded: daysAgo(80),
    dateLastUsed: daysAgo(75),
  },
  {
    id: "r14",
    title: "Cinnamon rolls #baking #breakfast #dessert",
    url: "https://recipes.test/cinnamon-rolls",
    parentId: "c-baking",
    dateAdded: daysAgo(60),
    dateLastUsed: daysAgo(14),
  },
  {
    id: "r15",
    title: "Ramen broth #soup #japanese #slow",
    url: "https://recipes.test/ramen-broth",
    parentId: "c-weekend",
    dateAdded: daysAgo(45),
    dateLastUsed: daysAgo(33),
  },
  {
    id: "r16",
    title: "Smash burgers #quick #meat",
    url: "https://recipes.test/smash-burgers",
    parentId: "c-quick",
    dateAdded: daysAgo(30),
    dateLastUsed: daysAgo(4),
  },
  {
    id: "r17",
    title: "Overnight oats #breakfast #quick",
    url: "https://recipes.test/overnight-oats",
    parentId: "c-quick",
    dateAdded: daysAgo(20),
    dateLastUsed: daysAgo(2),
  },
  {
    id: "r18",
    title: "Espresso martini #dessert #weekend",
    url: "https://recipes.test/espresso-martini",
    parentId: "c-weekend",
    dateAdded: daysAgo(10),
    dateLastUsed: daysAgo(7),
  },
];

const ALL_ITEMS: BookmarkLike[] = [...COLLECTIONS, ...RECIPES];

/** Visit tracking the query language understands (`visits:`, `frecency:`). */
export const STATS: MatchContext["stats"] = {
  r01: { visits: 24, score: 20, lastVisited: daysAgo(3) },
  r02: { visits: 9, score: 7, lastVisited: daysAgo(12) },
  r03: { visits: 4, score: 3, lastVisited: daysAgo(40) },
  r04: { visits: 30, score: 26, lastVisited: daysAgo(1) },
  r05: { visits: 27, score: 24, lastVisited: daysAgo(2) },
  r06: { visits: 11, score: 9, lastVisited: daysAgo(9) },
  r07: { visits: 15, score: 13, lastVisited: daysAgo(6) },
  r08: { visits: 2, score: 2, lastVisited: daysAgo(60) },
  r09: { visits: 21, score: 18, lastVisited: daysAgo(5) },
  r10: { visits: 13, score: 11, lastVisited: daysAgo(8) },
  r11: { visits: 6, score: 5, lastVisited: daysAgo(21) },
  r12: { visits: 3, score: 3, lastVisited: daysAgo(30) },
  r13: { visits: 1, score: 1, lastVisited: daysAgo(75) },
  r14: { visits: 8, score: 7, lastVisited: daysAgo(14) },
  r15: { visits: 5, score: 4, lastVisited: daysAgo(33) },
  r16: { visits: 18, score: 16, lastVisited: daysAgo(4) },
  r17: { visits: 25, score: 22, lastVisited: daysAgo(2) },
  r18: { visits: 7, score: 6, lastVisited: daysAgo(7) },
};

/** Everything `QueryInput` needs for suggestions. */
export const SUGGEST_DATA: SuggestData = {
  tags: buildTagIndex(RECIPES),
  folderTree: buildFolderTree(ALL_ITEMS),
};

/** Prebuilt match context (folders, tags, stats). */
export const MATCH_CONTEXT = createMatchContext(ALL_ITEMS, STATS);

const collectionById = new Map(COLLECTIONS.map((c) => [c.id, c.title]));

/** "Baking" / "Weeknight / Quick" for display. */
export const collectionPath = (parentId?: string): string => {
  const parts: string[] = [];
  let current = parentId;

  while (current && current !== "0") {
    const node = ALL_ITEMS.find((item) => item.id === current);

    if (!node) break;
    parts.unshift(node.title);
    current = node.parentId;
  }

  return parts.join(" / ") || (parentId ? (collectionById.get(parentId) ?? "") : "");
};
