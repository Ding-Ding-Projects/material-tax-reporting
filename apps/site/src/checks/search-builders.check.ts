/**
 * Checks that every search field on this site carries a builder.
 *
 * Run from `apps/site`:
 *   node --experimental-strip-types src/checks/search-builders.check.ts
 *
 * The check is a source enumeration rather than a rendered-DOM walk, because
 * this repository runs no browser. It holds the property that matters: a
 * `type="search"` input may only be produced by `app/search-builder.tsx`, and
 * that module always renders the builder toggle and panel beside the field. Any
 * other module that grows its own search input fails this check.
 *
 * It also reports every search field the shell binds, so the count is visible
 * rather than asserted in prose, and fails on a duplicated field identifier
 * (two fields sharing an identifier would share a builder panel).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..", "..", "app");
const builderModule = resolve(appRoot, "search-builder.tsx");

function walk(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) found.push(...walk(path));
    else if (/\.tsx?$/.test(entry)) found.push(path);
  }
  return found;
}

const failures: string[] = [];
const files = walk(appRoot);

for (const file of files) {
  if (file === builderModule) continue;
  const body = readFileSync(file, "utf8");
  if (/type="search"/.test(body)) {
    failures.push(
      `${relative(appRoot, file)} renders its own search input. Every search field must come from search-builder.tsx.`,
    );
  }
}

// Every field the shell binds, by identifier.
const ids = new Set<string>();
for (const file of files) {
  const body = readFileSync(file, "utf8");
  for (const match of body.matchAll(/bind\(\s*"([a-z0-9-]+)"/g)) {
    const id = match[1];
    if (id === undefined) continue;
    if (ids.has(id)) failures.push(`The search field identifier "${id}" is used more than once.`);
    ids.add(id);
  }
}

// The builder module itself must keep the toggle, the panel and the anchors.
const builder = readFileSync(builderModule, "utf8");
for (const required of ["BUILDER_TOKENS", "aria-expanded", "-builder", "analyzeSearchPattern"]) {
  if (!builder.includes(required)) {
    failures.push(`search-builder.tsx no longer references ${required}.`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `PASS search-builders: ${ids.size} bound search fields, all produced by search-builder.tsx with an anchored builder.`,
  );
}
