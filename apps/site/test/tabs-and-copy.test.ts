/**
 * The documentation site's framework-free logic.
 *
 * Most of this app is React and needs a browser, so this suite deliberately
 * covers only what can be tested honestly without one: the persisted tab strip
 * and its validator, the converter registry, and the copy the site is built
 * from. A small suite that genuinely exercises those is worth more than a large
 * one that renders components into a simulated document and proves little.
 *
 * The tab-strip validator gets the most attention because it reads a record
 * written by a previous visit — possibly by an older version of the site, or by
 * somebody editing browser storage — and must never leave the site without
 * navigation whatever it finds.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  SITE_TABS,
  SITE_TAB_GROUPS,
  SITE_TAB_IDS,
  defaultTabsState,
  tabDescriptor,
  tabHaystack,
  tabLabel,
  validateTabsState,
} from "../app/tabs.ts";
import { CONVERTER_SCOPE_NOTE, adapterHaystack, createConverterRegistry, previewRows } from "../app/converter.ts";
import {
  BOUNDARY_SENTENCE,
  DISCLAIMER_SENTENCE,
  FOOTER_DISCLAIMER,
  OFFICIAL_REFERENCES,
  REVIEW_AREAS,
  SHIPPED_PRODUCT_NAME,
  SITE_IMMUTABLE_SPANS,
  WORKFLOW_STEPS,
} from "../app/data/copy.ts";
import { FEATURE_ROWS } from "../app/data/features.ts";

test("the shipped tab strip is coherent", () => {
  assert.ok(SITE_TABS.length > 0);
  assert.equal(new Set(SITE_TAB_IDS).size, SITE_TAB_IDS.length, "tab identifiers must be unique");
  assert.ok(SITE_TAB_IDS.includes("home"));

  const groupIds = new Set(SITE_TAB_GROUPS.map((group) => group.id));
  for (const tab of SITE_TABS) {
    assert.ok(tab.en.length > 0, `${tab.id} must have an English label`);
    assert.ok(tab.zh.length > 0, `${tab.id} must have a Cantonese label`);
    assert.ok(
      tab.groupId === null || groupIds.has(tab.groupId),
      `${tab.id} belongs to a group that does not exist`,
    );
  }
});

test("the home tab cannot be closed", () => {
  // Every other tab may go; losing this one would leave the site unnavigable.
  assert.equal(tabDescriptor("home")?.closable, false);
});

test("a tab label follows the active language mode", () => {
  const home = tabDescriptor("home");
  assert.ok(home);

  assert.equal(tabLabel(home, "en"), home.en);
  assert.equal(tabLabel(home, "zh"), home.zh);

  const both = tabLabel(home, "both");
  assert.ok(both.includes(home.en), "bilingual mode must show the English label");
  assert.ok(both.includes(home.zh), "bilingual mode must show the Cantonese label");
});

test("an unknown tab identifier resolves to nothing rather than a stand-in", () => {
  assert.equal(tabDescriptor("not-a-tab"), null);
  assert.equal(tabDescriptor(""), null);
});

test("the default strip opens every shipped tab, unpinned, with home active", () => {
  const state = defaultTabsState();

  assert.equal(state.tabs.length, SITE_TABS.length);
  assert.equal(state.activeId, "home");
  assert.ok(state.tabs.every((tab) => tab.pinned === false));
  assert.deepEqual(
    state.tabs.map((tab) => tab.order),
    state.tabs.map((_, index) => index),
    "order must be a dense sequence",
  );
});

test("a record that cannot be read at all falls back to the shipped strip", () => {
  for (const raw of [null, undefined, 42, "a string", [], { tabs: "not an array" }]) {
    const state = validateTabsState(raw);
    assert.ok(state.tabs.length > 0, `${JSON.stringify(raw) ?? "undefined"} must still yield a usable strip`);
    assert.ok(state.tabs.some((tab) => tab.id === "home"));
  }
});

test("a stored strip round-trips unchanged", () => {
  const stored = defaultTabsState();
  const restored = validateTabsState(JSON.parse(JSON.stringify(stored)));

  assert.deepEqual(restored.tabs.map((tab) => tab.id), stored.tabs.map((tab) => tab.id));
  assert.equal(restored.activeId, stored.activeId);
});

test("an unknown tab identifier in a stored record is dropped", () => {
  // A record written by a newer or older build must not resurrect a tab this
  // version does not ship.
  const state = validateTabsState({
    tabs: [{ id: "home" }, { id: "a-tab-that-no-longer-exists" }, { id: "settings" }],
    activeId: "home",
  });

  assert.ok(!state.tabs.some((tab) => tab.id === "a-tab-that-no-longer-exists"));
  assert.ok(state.tabs.some((tab) => tab.id === "home"));
});

test("home is restored even when the stored record left it out", () => {
  const state = validateTabsState({ tabs: [{ id: "settings" }], activeId: "settings" });

  const home = state.tabs.find((tab) => tab.id === "home");
  assert.ok(home, "the site must never load without its home tab");
  assert.equal(home.closable, false);
});

test("a stored record with no readable tabs still leaves the site navigable", () => {
  const state = validateTabsState({ tabs: [{ id: "nope" }, { nonsense: true }, null] });

  assert.ok(state.tabs.length >= 1, "an empty strip is not an acceptable outcome");
  assert.ok(state.tabs.some((tab) => tab.id === "home"));
  assert.equal(state.activeId, "home");
});

test("closability comes from the shipped descriptor, not the stored record", () => {
  // Otherwise an edited record could mark home closable and let a visitor
  // remove the only tab that always has to be there.
  const state = validateTabsState({ tabs: [{ id: "home", closable: true }], activeId: "home" });
  assert.equal(state.tabs.find((tab) => tab.id === "home")?.closable, false);
});

test("a tab claiming a group that does not exist is ungrouped rather than rejected", () => {
  const state = validateTabsState({
    tabs: [{ id: "home", groupId: "invented-group" }],
    activeId: "home",
  });
  assert.equal(state.tabs.find((tab) => tab.id === "home")?.groupId, null);
});

test("the pinned flag is only honoured when it is exactly true", () => {
  const truthy = validateTabsState({ tabs: [{ id: "home", pinned: "yes" }], activeId: "home" });
  assert.equal(truthy.tabs[0].pinned, false, "a truthy string is not a stored preference");

  const real = validateTabsState({ tabs: [{ id: "home", pinned: true }], activeId: "home" });
  assert.equal(real.tabs[0].pinned, true);
});

test("order is renumbered densely however the stored record was numbered", () => {
  const state = validateTabsState({
    tabs: [
      { id: "settings", order: 900 },
      { id: "home", order: -50 },
    ],
    activeId: "home",
  });

  assert.deepEqual(state.tabs.map((tab) => tab.order), state.tabs.map((_, index) => index));
});

test("an active identifier that is not in the strip falls back to the first tab", () => {
  const state = validateTabsState({ tabs: [{ id: "home" }], activeId: "a-tab-that-is-not-open" });
  assert.equal(state.activeId, "home");
});

test("every shipped group survives validation, and a stored rename is bounded", () => {
  const state = validateTabsState({
    tabs: [{ id: "home" }],
    groups: [{ id: SITE_TAB_GROUPS[0].id, name: "x".repeat(500), collapsed: true }],
    activeId: "home",
  });

  assert.equal(state.groups.length, SITE_TAB_GROUPS.length, "no shipped group may disappear");
  const renamed = state.groups.find((group) => group.id === SITE_TAB_GROUPS[0].id);
  assert.ok(renamed);
  assert.ok(renamed.name.length <= 60, "a stored name must be bounded");
  assert.equal(renamed.collapsed, true, "a collapsed preference is preserved");
});

test("an empty stored group name falls back to the shipped one", () => {
  const state = validateTabsState({
    tabs: [{ id: "home" }],
    groups: [{ id: SITE_TAB_GROUPS[0].id, name: "" }],
    activeId: "home",
  });
  assert.equal(
    state.groups.find((group) => group.id === SITE_TAB_GROUPS[0].id)?.name,
    SITE_TAB_GROUPS[0].name,
  );
});

test("a tab's searchable text carries both languages so either finds it", () => {
  const state = defaultTabsState();
  const home = state.tabs.find((tab) => tab.id === "home");
  const descriptor = tabDescriptor("home");
  assert.ok(home && descriptor);

  const haystack = tabHaystack(home, "en");
  assert.ok(haystack.includes(descriptor.en));
  assert.ok(haystack.includes(descriptor.zh), "a Cantonese search must find an English-labelled tab");
});

test("the converter registry ships adapters in named categories", () => {
  const registry = createConverterRegistry();
  const adapters = registry.list();

  assert.ok(adapters.length > 0, "an empty registry would be a converter that converts nothing");
  for (const adapter of adapters) {
    assert.ok(adapter.category.length > 0, "every adapter belongs to a category");
    assert.ok(adapter.id.length > 0);
  }
  assert.ok(
    new Set(adapters.map((adapter) => adapter.category)).size > 1,
    "the catalogue is categorised rather than one flat list",
  );
});

test("the converter scope note refuses tax slips rather than implying it takes them", () => {
  // A general-looking file converter on a tax site invites exactly the wrong
  // file, so the note has to close that door in words.
  assert.ok(CONVERTER_SCOPE_NOTE.length > 0);
  assert.ok(CONVERTER_SCOPE_NOTE.includes("does not accept tax slips or return data"));
  assert.ok(CONVERTER_SCOPE_NOTE.includes("no adapter for them exists"));
});

test("an adapter's searchable text names the adapter", () => {
  const [adapter] = createConverterRegistry().list();
  assert.ok(adapter);

  const haystack = adapterHaystack(adapter);
  assert.ok(haystack.length > 0);
  assert.ok(haystack.toLowerCase().includes(adapter.category.toLowerCase()));
});

test("a preview shows at most the requested number of rows", () => {
  const body = Array.from({ length: 40 }, (_, index) => `row ${index}`).join("\n");

  assert.equal(previewRows(body, 5).length, 5);
  assert.equal(previewRows(body, 0).length, 0);
  assert.ok(previewRows(body, 100).length <= 40);
  assert.deepEqual(previewRows("", 5), []);
});

test("the boundary sentence names every filing route in order to refuse it", () => {
  // The copy deliberately says these words. Naming them is how a reader learns
  // the product will not do them, so the test asserts the refusing shape rather
  // than the absence of the terms.
  assert.ok(BOUNDARY_SENTENCE.includes("will not implement"));
  for (const route of [
    "NETFILE",
    "EFILE",
    "electronic submission",
    "direct CRA transmission",
    "automatic filing",
  ]) {
    assert.ok(BOUNDARY_SENTENCE.includes(route), `the boundary must refuse ${route} by name`);
  }
});

test("the site disclaims advice and certification rather than implying either", () => {
  const disclaimers = `${DISCLAIMER_SENTENCE} ${FOOTER_DISCLAIMER}`;

  assert.ok(DISCLAIMER_SENTENCE.includes("not tax, legal, accounting, or financial advice"));
  assert.ok(DISCLAIMER_SENTENCE.includes("does not claim CRA certification"));
  assert.ok(FOOTER_DISCLAIMER.includes("not tax, legal, accounting, or financial advice"));
  assert.ok(!/\bis CRA[- ]certified\b/i.test(disclaimers));
});

test("no workflow step promises to send the return anywhere", () => {
  const workflow = WORKFLOW_STEPS.map((step) => `${step.title} ${step.body}`).join(" ").toLowerCase();
  for (const forbidden of ["file electronically", "submit your return", "transmit", "netfile", "efile"]) {
    assert.ok(!workflow.includes(forbidden), `no step may offer to ${forbidden}`);
  }
});

test("the review areas name every part a person must check before mailing", () => {
  const areas = REVIEW_AREAS.join(" ").toLowerCase();
  for (const subject of ["form", "calculation", "attachment", "mailing", "signature"]) {
    assert.ok(areas.includes(subject), `the review list must name ${subject}`);
  }
  assert.ok(REVIEW_AREAS.length >= 5);
});

test("every official reference is an https government citation with readable link text", () => {
  assert.ok(OFFICIAL_REFERENCES.length > 0);
  for (const reference of OFFICIAL_REFERENCES) {
    assert.ok(reference.href.startsWith("https://"), `${reference.text} must be cited over https`);
    assert.ok(
      reference.href.includes("canada.ca") || reference.href.includes("ontario.ca"),
      `${reference.text} must cite an official source`,
    );
    assert.ok(reference.text.length > 0, "a bare URL is not a usable link");
    assert.ok(reference.note.length > 0, `${reference.text} must say what it is for`);
  }
});

test("official wording and the boundary are protected from personal-vocabulary rewriting", () => {
  // A visitor's vocabulary file may rename almost anything on this site. These
  // spans are the exceptions, because rewording an official citation or the
  // paper-only boundary would change a fact rather than a label.
  const protectedSpans = SITE_IMMUTABLE_SPANS;

  assert.ok(protectedSpans.includes(BOUNDARY_SENTENCE), "the boundary must be unrewritable");
  assert.ok(protectedSpans.includes(DISCLAIMER_SENTENCE));
  for (const reference of OFFICIAL_REFERENCES) {
    assert.ok(protectedSpans.includes(reference.href), `${reference.text} address must be protected`);
    assert.ok(protectedSpans.includes(reference.text), `${reference.text} wording must be protected`);
  }
});

test("the workflow is described end to end and ends at the post", () => {
  assert.ok(WORKFLOW_STEPS.length >= 3);
  for (const step of WORKFLOW_STEPS) {
    assert.ok(step.number.length > 0);
    assert.ok(step.title.length > 0);
    assert.ok(step.body.length > 0, `step ${step.number} must explain itself`);
  }

  const last = WORKFLOW_STEPS.at(-1);
  assert.ok(
    /mail|print|sign|post/i.test(`${last?.title} ${last?.body}`),
    "the final step must be the person mailing it",
  );
});

test("the feature list is complete enough to describe the product", () => {
  assert.ok(FEATURE_ROWS.length > 0);
  for (const row of FEATURE_ROWS) {
    for (const [field, value] of Object.entries(row)) {
      assert.ok(
        typeof value !== "string" || value.length > 0,
        `a feature row has an empty ${field}`,
      );
    }
  }
});

test("the shipped product name is a constant the copy can be checked against", () => {
  assert.equal(SHIPPED_PRODUCT_NAME, "Material Tax Reporting");
  assert.ok(SHIPPED_PRODUCT_NAME.length > 0);
});
