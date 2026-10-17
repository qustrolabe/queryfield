#!/usr/bin/env bun
/**
 * Cut a release: bump both packages to the same version, commit, and tag.
 *
 *   bun run release <major|minor|patch>
 *
 * Does not push — check the commit and tag, then `git push --follow-tags`.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const TARGETS = ["packages/core/package.json", "packages/react/package.json"];
const BUMPS = ["major", "minor", "patch"];
const bump = process.argv[2];

if (!BUMPS.includes(bump)) {
  console.error("Usage: bun run release <major|minor|patch>");
  process.exit(1);
}

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const versions = TARGETS.map((path) => read(path).version);

// The packages ship in lockstep, so a mismatch means something is already wrong.
if (new Set(versions).size !== 1) {
  console.error(`Packages disagree: ${TARGETS.map((p, i) => `${p} is ${versions[i]}`).join(", ")}`);
  process.exit(1);
}

const [major, minor, patch] = versions[0].split(".").map(Number);
const next =
  bump === "major"
    ? `${major + 1}.0.0`
    : bump === "minor"
      ? `${major}.${minor + 1}.0`
      : `${major}.${minor}.${patch + 1}`;

try {
  execSync(`git rev-parse v${next}`, { stdio: "ignore" });
  console.error(`Tag v${next} already exists!`);
  process.exit(1);
} catch {
  // Tag does not exist yet.
}

for (const path of TARGETS) {
  const pkg = read(path);
  pkg.version = next;
  writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
}

// bun.lock records workspace packages by path, not version, so it needs no bump.
execSync(`git add ${TARGETS.join(" ")}`);
execSync(`git commit -m "chore(release): v${next}"`, { stdio: "inherit" });
execSync(`git tag -a v${next} -m "v${next}"`, { stdio: "inherit" });

console.log(`Released v${next} — push with \`git push --follow-tags\`.`);
