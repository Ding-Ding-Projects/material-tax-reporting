/**
 * Renders the whole shell once, on the server, and reports what the markup
 * actually contains.
 *
 * This is not a browser check and makes no claim about how the site looks or
 * behaves. It proves only that the component tree renders without throwing and
 * that a few structural properties hold in the produced markup: every search
 * field has an identifier and a builder toggle beside it, every button carries
 * an accessible name, the tab strip and the panels agree, and the paper-only
 * boundary sentence and the honest unavailable card are present.
 *
 * Build and run it from `apps/site`:
 *   npx vite build --config src/checks/render-smoke.config.ts
 *   node dist/render-smoke/render-smoke.entry.js
 */

import { renderToString } from "react-dom/server";
import { SiteApp } from "../../app/SiteApp.tsx";

const html = renderToString(<SiteApp />);
const count = (pattern: RegExp): number => (html.match(pattern) ?? []).length;

const buttons = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
const namelessButtons = buttons.filter((button) => {
  const labelled = /aria-label="[^"]+"/.test(button);
  const text = button.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return !labelled && text.length === 0;
});

const searchFields = html.match(/<input[^>]*type="search"[^>]*>/g) ?? [];
const unidentifiedFields = searchFields.filter((field) => !/\sid="[^"]+"/.test(field));
const unnamedFields = searchFields.filter(
  (field) => !/aria-label="[^"]+"/.test(field) && !/\sid="[^"]+-input"/.test(field),
);
const builderToggles = count(/regular expression builder/g);

const failures: string[] = [];
if (namelessButtons.length > 0) {
  failures.push(`${namelessButtons.length} rendered buttons carry no accessible name.`);
}
if (unidentifiedFields.length > 0) {
  failures.push(`${unidentifiedFields.length} rendered search fields carry no identifier.`);
}
if (unnamedFields.length > 0) {
  failures.push(`${unnamedFields.length} rendered search fields carry no accessible name.`);
}
if (builderToggles !== searchFields.length) {
  failures.push(
    `${searchFields.length} search fields rendered but ${builderToggles} builder toggles; every field must have one.`,
  );
}
if (count(/role="tab"/g) !== count(/role="tabpanel"/g)) {
  failures.push("The number of tabs and the number of panels disagree.");
}
if (!html.includes("will not implement NETFILE")) {
  failures.push("The paper-only boundary sentence is not rendered.");
}
if (!html.includes("Download unavailable")) {
  failures.push("The honest unavailable card is not rendered while the release manifest is empty.");
}
if (!html.includes('class="skip-link"')) {
  failures.push("The skip link is not rendered.");
}

console.log(`rendered characters: ${html.length}`);
console.log(`tabs: ${count(/role="tab"/g)}, panels: ${count(/role="tabpanel"/g)}`);
console.log(`search fields: ${searchFields.length}, builder toggles: ${builderToggles}`);
console.log(`buttons: ${buttons.length}, live regions: ${count(/aria-live="/g)}`);

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log("PASS render-smoke: the shell rendered and every structural check held.");
}
