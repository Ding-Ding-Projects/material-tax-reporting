/**
 * The official box-to-line table, and the manual confirmation that gates it.
 *
 * Nothing this package reads may reach a return without a person confirming it
 * against the source document, so `confirmSlipDraft` is the real product
 * boundary here and most of these tests are its refusals. The mapping table is
 * checked for internal consistency rather than re-transcribed: a direct mapping
 * with no destination line, or a citation that is not an official page, is
 * wrong regardless of which box it belongs to.
 *
 * Every fixture is synthetic. None is a real tax slip.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { useTypeScriptSources } from "./typescript-source-resolver.ts";

useTypeScriptSources();

const { OFFICIAL_CITATIONS, SLIP_DEFINITIONS, getSlipDefinition } = await import(
  "../src/official-mappings.ts"
);
const { confirmSlipDraft } = await import("../src/confirmation.ts");
const { AdapterRegistry } = await import("../src/adapters.ts");

const REVIEWED_AT = "2026-04-30T12:00:00.000Z";

const CHECKLIST_KEYS = [
  "sourceShownSideBySide",
  "slipTypeConfirmed",
  "taxYearConfirmed",
  "everyCandidateReviewed",
  "extractionEvidenceReviewed",
  "everyAmbiguityResolved",
  "missingFieldsReviewed",
  "officialMappingsReviewed",
  "calculationsRequireFinalReview",
  "attachmentsRequireFinalReview",
  "mailingAddressRequiresFinalReview",
  "signatureFieldsRequireFinalReview",
  "everyPopulatedFormRequiresFinalReview",
] as const;

const fullChecklist = () =>
  Object.fromEntries(CHECKLIST_KEYS.map((key) => [key, true])) as Record<string, boolean>;

const candidate = (overrides: Record<string, unknown> = {}) => ({
  id: "candidate:aaaaaaaaaaaaaaaaaaaaaaaa",
  box: "14",
  label: "Employment income",
  rawValue: "52,000.00",
  normalizedValue: { kind: "money", currency: "CAD", decimal: "52000" },
  source: {
    text: "52,000.00",
    page: 1,
    bounds: { x: 45, y: 700, width: 40, height: 10 },
    coordinateSpace: "pdf-points-bottom-left",
    confidence: 0.99,
    adapterId: "synthetic-test-adapter",
    sourceDigest: "synthetic-source",
    pageDigest: "synthetic-page",
    evidenceDigest: "synthetic-evidence",
  },
  confidence: 0.95,
  alternatives: [],
  mappings: [{ kind: "direct", target: "T1.10100", explanation: "Employment income", citation: OFFICIAL_CITATIONS.t4 }],
  status: "requires-manual-confirmation",
  flags: [],
  ...overrides,
});

const draft = (overrides: Record<string, unknown> = {}) => ({
  state: "requires-manual-confirmation",
  schemaVersion: 1,
  sourceDigest: "synthetic-source-digest",
  resultDigest: "synthetic-result-digest",
  documentKind: "application/pdf",
  pageCount: 1,
  adapterId: "synthetic-test-adapter",
  adapterArtifact: { artifactId: "synthetic", artifactVersion: "1", runtimeId: "node-test" },
  extractionEvidenceDigest: "synthetic-evidence",
  classification: { slipType: "T4", confidence: 0.95, candidates: [] },
  taxYear: { value: 2025, confidence: 0.9, candidates: [2025] },
  candidates: [candidate()],
  missingRequiredBoxes: [],
  issues: [],
  privacy: { localOnly: true, networkUsed: false, telemetryUsed: false, sourceDocumentRetained: false },
  deliveryBoundary: {
    method: "cra-mail-in-pdf-only",
    electronicSubmissionSupported: false,
    automaticFilingSupported: false,
  },
  ...overrides,
});

const submission = (overrides: Record<string, unknown> = {}) => ({
  sourceDigest: "synthetic-source-digest",
  resultDigest: "synthetic-result-digest",
  reviewedAt: REVIEWED_AT,
  confirmedSlipType: "T4",
  confirmedTaxYear: 2025,
  fieldDecisions: [{ candidateId: "candidate:aaaaaaaaaaaaaaaaaaaaaaaa", decision: "accept" }],
  acknowledgedIssueIds: [],
  checklist: fullChecklist(),
  ...overrides,
});

const reject = (draftValue: unknown, submissionValue: unknown) => {
  const result = confirmSlipDraft(draftValue as never, submissionValue as never);
  assert.equal(result.state, "rejected", "this submission should have been refused");
  return result.issues;
};

test("the official mapping table covers the eight supported slip types once each", () => {
  assert.equal(SLIP_DEFINITIONS.length, 8);
  const types = SLIP_DEFINITIONS.map((definition) => definition.slipType);
  assert.equal(new Set(types).size, 8);
  for (const expected of ["T4", "T4A", "T4E", "T5", "T3", "T5008", "T2202", "RRSP_RECEIPT"]) {
    assert.ok(types.includes(expected), `${expected} must be defined`);
  }
});

test("every slip definition names itself and its boxes coherently", () => {
  for (const definition of SLIP_DEFINITIONS) {
    assert.ok(definition.title.length > 0, `${definition.slipType} must carry a title`);
    assert.ok(definition.classificationTerms.length > 0, `${definition.slipType} must be recognisable`);
    assert.ok(definition.boxes.length > 0, `${definition.slipType} must define boxes`);
    assert.equal(
      new Set(definition.boxes.map((box) => box.box)).size,
      definition.boxes.length,
      `${definition.slipType} must not define a box twice`,
    );

    for (const box of definition.boxes) {
      assert.ok(box.label.length > 0, `${definition.slipType} box ${box.box} must carry a label`);
      assert.ok(
        ["money", "integer", "date", "text"].includes(box.valueKind),
        `${definition.slipType} box ${box.box} has an unexpected value kind`,
      );
      assert.equal(typeof box.requiredForReview, "boolean");
      assert.ok(box.mappings.length > 0, `${definition.slipType} box ${box.box} must map somewhere`);
    }
  }
});

test("a direct mapping names a destination and a non-direct one explains itself", () => {
  // A direct mapping with no target would be entered nowhere; a review-only one
  // with a target invites exactly the automatic entry it exists to prevent.
  for (const definition of SLIP_DEFINITIONS) {
    for (const box of definition.boxes) {
      for (const mapping of box.mappings) {
        const where = `${definition.slipType} box ${box.box}`;
        assert.ok(
          ["direct", "formula", "review-only"].includes(mapping.kind),
          `${where} has an unexpected mapping kind`,
        );
        if (mapping.kind === "direct") {
          assert.ok(
            typeof mapping.target === "string" && mapping.target.length > 0,
            `${where} is direct and must name a destination line`,
          );
        }
        assert.ok(mapping.explanation.length > 0, `${where} must explain its mapping`);
        assert.ok(mapping.citation, `${where} must cite an official source`);
      }
    }
  }
});

test("every citation is an official Canada Revenue Agency page with a retrieval date", () => {
  const citations = Object.values(OFFICIAL_CITATIONS);
  assert.ok(citations.length > 0);
  for (const citation of citations) {
    assert.ok(citation.url.startsWith("https://www.canada.ca/"), `${citation.title} must cite canada.ca`);
    assert.match(citation.retrievedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(citation.title.length > 0);
  }
});

test("every box mapping cites a citation the table actually declares", () => {
  const declared = new Set(Object.values(OFFICIAL_CITATIONS).map((citation) => citation.url));
  for (const definition of SLIP_DEFINITIONS) {
    for (const box of definition.boxes) {
      for (const mapping of box.mappings) {
        assert.ok(
          declared.has(mapping.citation.url),
          `${definition.slipType} box ${box.box} cites a page the table does not declare`,
        );
      }
    }
  }
});

test("the boxes a review cannot proceed without are the ones marked required", () => {
  const required = SLIP_DEFINITIONS.flatMap((definition) =>
    definition.boxes.filter((box) => box.requiredForReview).map((box) => `${definition.slipType}:${box.box}`),
  );

  // Employment income on a T4 and interest on a T5 are the figures those slips
  // exist to report; a draft missing them is not a usable draft.
  assert.ok(required.includes("T4:14"));
  assert.ok(required.includes("T5:13"));
  assert.ok(required.includes("T2202:26"));
});

test("an unknown slip type is refused rather than defaulted", () => {
  assert.equal(getSlipDefinition("T4").slipType, "T4");
  assert.throws(() => getSlipDefinition("T9999" as never), /No slip definition is registered/);
});

/**
 * KNOWN GAP, pinned deliberately.
 *
 * Two T3 formula mappings subtract boxes the table never defines, so neither
 * formula can be resolved from extracted candidates alone. Both boxes are
 * review-only in effect, which is the safe direction, but the formulas read as
 * though the parser could compute them. Pinned so that defining boxes 30 and 31
 * — or rewording the formulas — turns this red and gets a deliberate decision.
 */
test("the T3 formulas reference boxes the table does not define", () => {
  const t3 = getSlipDefinition("T3");
  const defined = new Set(t3.boxes.map((box) => box.box));
  const referenced = new Set<string>();

  for (const box of t3.boxes) {
    for (const mapping of box.mappings) {
      for (const match of (mapping.formula ?? "").matchAll(/\bbox(\d{1,3}[A-Z]?)\b/g)) {
        referenced.add(match[1]);
      }
    }
  }

  const undefinedBoxes = [...referenced].filter((box) => !defined.has(box)).sort();
  assert.deepEqual(
    undefinedBoxes,
    ["30", "31"],
    "if this list changed, the T3 formulas or the T3 box set moved",
  );
});

test("an adapter without a bundled offline proof is disabled rather than trusted", () => {
  const proof = {
    bundled: true,
    declared: true,
    declaredInPackage: "packages/slip-parser/test/synthetic-adapter.ts",
    artifactId: "synthetic",
    artifactVersion: "1",
    runtimeId: "node-test",
    offline: true,
    networkAccess: "forbidden",
    telemetry: "none",
  };
  const adapter = {
    id: "synthetic-adapter-v1",
    supportedKinds: ["application/pdf"],
    proof,
    canExtract: () => true,
    extract: async () => ({ state: "extracted", document: { pageCount: 1, tokens: [], warnings: [], evidenceDigest: "e" } }),
  };

  assert.deepEqual(new AdapterRegistry([adapter] as never).registrationIssues, []);

  for (const broken of [
    { bundled: false },
    { offline: false },
    { networkAccess: "allowed" },
    { telemetry: "basic" },
    { declaredInPackage: "somewhere/else.ts" },
  ]) {
    const registry = new AdapterRegistry([{ ...adapter, proof: { ...proof, ...broken } }] as never);
    assert.equal(
      registry.registrationIssues.length,
      1,
      `${JSON.stringify(broken)} must disable the adapter`,
    );
    assert.equal(registry.registrationIssues[0].code, "adapter-runtime-unproven");
    assert.deepEqual(registry.listEnabled(), [], "a disabled adapter must not be selectable");
  }
});

test("a complete, honest confirmation is accepted and projects the confirmed values", () => {
  const result = confirmSlipDraft(draft() as never, submission() as never);

  assert.equal(result.state, "confirmed");
  assert.equal(result.projection.state, "confirmed-for-return-entry");
  assert.equal(result.projection.slipType, "T4");
  assert.equal(result.projection.taxYear, 2025);
  assert.equal(result.projection.suggestions.length, 1);
  assert.equal(result.projection.suggestions[0].box, "14");
  assert.deepEqual(result.projection.suggestions[0].value, {
    kind: "money",
    currency: "CAD",
    decimal: "52000",
  });
  assert.equal(result.projection.suggestions[0].confirmedAt, REVIEWED_AT);
});

test("a confirmed projection still insists on paper-only delivery and a final review", () => {
  const result = confirmSlipDraft(draft() as never, submission() as never);
  assert.equal(result.state, "confirmed");

  assert.deepEqual(result.projection.deliveryBoundary, {
    method: "cra-mail-in-pdf-only",
    electronicSubmissionSupported: false,
    automaticFilingSupported: false,
  });
  assert.equal(result.projection.finalMailInReview.required, true);
  assert.deepEqual([...result.projection.finalMailInReview.items], [
    "every populated form",
    "every calculation",
    "every attachment",
    "the CRA mailing address",
    "every signature field",
  ]);
});

test("a confirmation against a different source or result is refused as stale", () => {
  assert.equal(reject(draft(), submission({ sourceDigest: "another-source" }))[0].code, "stale-confirmation");
  assert.equal(reject(draft(), submission({ resultDigest: "another-result" }))[0].code, "stale-confirmation");
});

test("changing the slip type or the detected tax year requires parsing again", () => {
  // Both decide which official mapping set applies, so accepting a change here
  // would enter values under relationships nobody checked.
  const slipType = reject(draft(), submission({ confirmedSlipType: "T4A" }));
  assert.ok(slipType.some((issue) => issue.message.includes("parsing the source again")));

  const taxYear = reject(draft(), submission({ confirmedTaxYear: 2024 }));
  assert.ok(taxYear.some((issue) => issue.message.includes("official mapping set")));
});

test("every checklist item is required individually", () => {
  for (const key of CHECKLIST_KEYS) {
    const issues = reject(draft(), submission({ checklist: { ...fullChecklist(), [key]: false } }));
    assert.ok(
      issues.some((issue) => issue.id === `confirmation:checklist:${key}`),
      `${key} must be required`,
    );
  }
});

test("a review time that is not a UTC timestamp is refused", () => {
  for (const reviewedAt of ["", "yesterday", "2026-04-30", "2026-04-30T12:00:00+02:00"]) {
    const issues = reject(draft(), submission({ reviewedAt }));
    assert.ok(
      issues.some((issue) => issue.message.includes("UTC ISO-8601")),
      `${reviewedAt || "(empty)"} must be refused`,
    );
  }
});

test("every candidate needs a decision, and an unknown one is refused", () => {
  const missing = reject(draft(), submission({ fieldDecisions: [] }));
  assert.ok(missing.some((issue) => issue.message.includes("No decision was supplied")));

  const unknown = reject(
    draft(),
    submission({ fieldDecisions: [{ candidateId: "candidate:does-not-exist", decision: "accept" }] }),
  );
  assert.ok(unknown.some((issue) => issue.id.startsWith("confirmation:unknown:")));
});

test("one candidate may not carry two decisions", () => {
  const issues = reject(
    draft(),
    submission({
      fieldDecisions: [
        { candidateId: "candidate:aaaaaaaaaaaaaaaaaaaaaaaa", decision: "accept" },
        { candidateId: "candidate:aaaaaaaaaaaaaaaaaaaaaaaa", decision: "exclude" },
      ],
    }),
  );
  assert.ok(issues.some((issue) => issue.message.includes("more than one decision")));
});

test("a correction must supply the corrected value, and only a correction may", () => {
  const withoutValue = reject(
    draft(),
    submission({ fieldDecisions: [{ candidateId: "candidate:aaaaaaaaaaaaaaaaaaaaaaaa", decision: "correct" }] }),
  );
  assert.ok(withoutValue.some((issue) => issue.message.includes("corrected value is required")));

  const strayValue = reject(
    draft(),
    submission({
      fieldDecisions: [
        {
          candidateId: "candidate:aaaaaaaaaaaaaaaaaaaaaaaa",
          decision: "accept",
          correctedValue: { kind: "money", currency: "CAD", decimal: "1" },
        },
      ],
    }),
  );
  assert.ok(strayValue.some((issue) => issue.message.includes("may only accompany a correct decision")));
});

test("a correction replaces the extracted value in the projection", () => {
  const result = confirmSlipDraft(
    draft() as never,
    submission({
      fieldDecisions: [
        {
          candidateId: "candidate:aaaaaaaaaaaaaaaaaaaaaaaa",
          decision: "correct",
          correctedValue: { kind: "money", currency: "CAD", decimal: "52500" },
        },
      ],
    }) as never,
  );

  assert.equal(result.state, "confirmed");
  assert.equal(result.projection.suggestions[0].value.decimal, "52500");
});

test("an excluded candidate is recorded as excluded rather than dropped", () => {
  const result = confirmSlipDraft(
    draft() as never,
    submission({
      fieldDecisions: [{ candidateId: "candidate:aaaaaaaaaaaaaaaaaaaaaaaa", decision: "exclude" }],
    }) as never,
  );

  assert.equal(result.state, "confirmed");
  assert.deepEqual([...result.projection.suggestions], []);
  assert.deepEqual([...result.projection.excludedCandidateIds], ["candidate:aaaaaaaaaaaaaaaaaaaaaaaa"]);
});

test("an ambiguous candidate may not simply be accepted", () => {
  // Accepting an ambiguous reading is exactly the decision the flag exists to
  // stop somebody making by reflex; it must be corrected or excluded.
  const ambiguous = draft({ candidates: [candidate({ flags: ["ambiguous"] })] });

  const issues = reject(ambiguous, submission());
  assert.ok(issues.some((issue) => issue.message.includes("must be corrected or excluded")));

  const excluded = confirmSlipDraft(
    ambiguous as never,
    submission({
      fieldDecisions: [{ candidateId: "candidate:aaaaaaaaaaaaaaaaaaaaaaaa", decision: "exclude" }],
    }) as never,
  );
  assert.equal(excluded.state, "confirmed", "excluding it is an acceptable resolution");
});

test("every parser issue must be acknowledged before a draft is confirmed", () => {
  const withIssue = draft({
    issues: [
      {
        id: "field:T4:16:review-only",
        code: "review-only-mapping",
        severity: "info",
        message: "This box has a contextual mapping.",
      },
    ],
  });

  const unacknowledged = reject(withIssue, submission());
  assert.ok(unacknowledged.some((issue) => issue.message.includes("must be acknowledged")));

  const acknowledged = confirmSlipDraft(
    withIssue as never,
    submission({ acknowledgedIssueIds: ["field:T4:16:review-only"] }) as never,
  );
  assert.equal(acknowledged.state, "confirmed");
});

test("a rejected confirmation produces no projection at all", () => {
  const result = confirmSlipDraft(draft() as never, submission({ checklist: {} }) as never);

  assert.equal(result.state, "rejected");
  assert.equal(result.projection, undefined, "a partial projection is worse than none");
  assert.ok(result.issues.length > 0);
  assert.ok(result.issues.every((issue) => issue.severity === "error"));
});
