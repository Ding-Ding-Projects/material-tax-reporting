/**
 * Checks the humour-level copy bundle.
 *
 * Run from `apps/site`:
 *   node --experimental-strip-types src/checks/copy-facts.check.ts
 *
 * Two properties are asserted:
 *   1. humour changes tone and never a fact, using the kernel's
 *      `assertFactsInvariant`; and
 *   2. this repository ships no personal-vocabulary replacement keys or
 *      values, so no private wording can leak through the product.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { assertFactsInvariant } from "@material-tax-reporting/surface-kernel";
import { COPY } from "../../app/data/copy.ts";

const failures: string[] = [];

const offenders = assertFactsInvariant(COPY);
if (offenders.length > 0) {
  failures.push(`Humour variants disagree on a fact-bearing token for: ${offenders.join(", ")}.`);
}

for (const [key, entry] of Object.entries(COPY)) {
  for (const language of ["en", "zh"] as const) {
    const variants = entry[language];
    if (variants.length !== 5) {
      failures.push(`The key "${key}" does not carry five ${language} variants.`);
      continue;
    }
    if (variants.some((variant) => variant.trim().length === 0)) {
      failures.push(`The key "${key}" has an empty ${language} variant.`);
    }
  }
}

// A built-in vocabulary map would defeat the promise that no mappings, examples
// or private defaults ship with this site.
const appRoot = resolve(import.meta.dirname, "..", "..", "app");
const banned = /(BUILTIN|DEFAULT|EXAMPLE|SAMPLE)_?(VOCABULARY|REPLACEMENTS)/i;

function walk(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) found.push(...walk(path));
    else if (/\.(ts|tsx|css|json)$/.test(entry)) found.push(path);
  }
  return found;
}

for (const file of walk(appRoot)) {
  const body = readFileSync(file, "utf8");
  if (banned.test(body)) {
    failures.push(`${relative(appRoot, file)} declares a built-in vocabulary map.`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`PASS copy-facts: ${Object.keys(COPY).length} keys, no fact drift, no built-in vocabulary.`);
}
