/**
 * Assembling a mail-in package, and the manual review that must precede it.
 *
 * This is the surface where the product's one hard boundary lives: the only
 * permitted output is a local PDF a person reviews, prints, signs and mails.
 * So the tests below drive the whole flow against a recording adapter — plan,
 * fill, merge, review every item, acknowledge, authorize, export — and assert
 * on what the adapter was actually asked to do rather than on what the engine
 * says it did.
 *
 * Tax year: 2025. Province: Ontario. Every fixture is synthetic.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { FakePdfAdapter, LOCAL_ONLY_CAPABILITIES, fakeDigest } from "./fake-pdf-adapter.ts";
import { useTypeScriptSources } from "./typescript-source-resolver.ts";

useTypeScriptSources();

const { CRA_DOCUMENT_2025_BY_ID } = await import("../src/catalog/index.ts");
const { createFillPlans2025 } = await import("../src/mapping/2025.ts");
const { assertLocalOnlyAdapter, assertSafePdf, mapSemanticFields } = await import("../src/adapter.ts");
const {
  ELECTRONIC_FILING_CAPABILITIES,
  prepareMailInPackage,
  createReviewPreview,
  exportReviewedMailInPackage,
  printReviewedMailInPackage,
} = await import("../src/engine.ts");
const {
  FINAL_REVIEW_ACKNOWLEDGEMENT,
  createManualReviewState,
  startManualReview,
  confirmManualReviewItem,
  acknowledgeManualReview,
  createPrintAuthorization,
  assertPrintAuthorization,
} = await import("../src/review.ts");

const AT = "2026-04-30T12:00:00.000Z";

const INCLUSION_FLAG_KEYS = [
  "spouseTransfers", "capitalGains", "dependantClaims", "canadaWorkersBenefit",
  "registeredPlanActivity", "cppScheduleRequired", "donations", "tuition",
  "multigenerationalHomeRenovation", "selfEmploymentEi", "fhsaActivity", "ontarioCredits",
  "ontarioBenefitsApplication", "liftCredit", "careCredit", "ontarioSpouseTransfers",
  "ontarioTuitionCarryForward",
] as const;

const UNSUPPORTED_KEYS = [
  "nonResidentOrDeemedResident", "enteredOrLeftCanadaDuringYear", "deceasedReturn",
  "bankruptcyReturn", "businessPermanentEstablishmentOutsideOntario", "farmingOrFishingIncome",
  "trustIncomeOrTrustReturn", "alternativeMinimumTax", "splitIncome", "foreignTaxCredit",
  "specifiedForeignPropertyOverThreshold", "complexCapitalTransaction",
] as const;

const allFalse = (keys: readonly string[]) =>
  Object.fromEntries(keys.map((key) => [key, false])) as Record<string, boolean>;

function syntheticCaseFile(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "cra-pdf-case.v1",
    taxYear: 2025,
    province: "ON",
    identity: {
      givenName: "Sample",
      familyName: "Synthetic-Fixture",
      mailingAddress: {
        line1: "1 Example Street",
        city: "Sample City",
        province: "ON",
        postalCode: "K1A0B1",
        country: "Canada",
      },
      residenceCity: "Sample City",
      dateOfBirth: "1985-03-14",
      // An obviously fake placeholder, not an issued number.
      socialInsuranceNumber: "000000000",
      maritalStatus: "single",
      correspondenceLanguage: "English",
    },
    calculation: {
      schemaVersion: "tax-calculation-snapshot.v1",
      taxYear: 2025,
      province: "ON",
      calculationId: "synthetic-calc-1",
      createdAt: AT,
      federalLines: {},
      ontarioLines: {},
      inclusionFlags: allFalse(INCLUSION_FLAG_KEYS),
      warnings: [],
    },
    attachments: [],
    carryForwards: [],
    unsupportedSituations: allFalse(UNSUPPORTED_KEYS),
    consent: {
      localProcessingOnly: true,
      understandsNotTaxAdvice: true,
      understandsNotCraCertified: true,
      understandsMailOnlyOutput: true,
    },
    ...overrides,
  };
}

/**
 * Builds a request plus a fake adapter already primed with a consistent set of
 * templates, filled outputs and inspections. Field profiles are derived from
 * the real fill plans, so the mapping the engine verifies is the mapping the
 * package actually produced.
 */
function scenario(caseFile = syntheticCaseFile()) {
  const plans = createFillPlans2025(caseFile.identity as never, caseFile.calculation as never);
  const adapter = new FakePdfAdapter();

  const templates: unknown[] = [];
  const fieldProfiles: unknown[] = [];

  for (const [index, plan] of plans.entries()) {
    const definition = CRA_DOCUMENT_2025_BY_ID.get(plan.documentId)!;
    const templateHandle = `${plan.documentId}-template.pdf`;
    const outputHandle = `${plan.documentId}-filled.pdf`;
    const templateDigest = fakeDigest(index + 1);
    const outputDigest = fakeDigest(index + 20);
    const pageCount = index + 2;

    const semanticToPhysicalField = Object.fromEntries(
      plan.fields.map((field, fieldIndex) => [field.semanticField, `physical_${index}_${fieldIndex}`]),
    );

    templates.push({
      localHandle: templateHandle,
      displayName: definition.title,
      documentId: plan.documentId,
      taxYear: 2025,
      officialSourceUrl: definition.officialFillablePdfUrl,
    });
    fieldProfiles.push({
      schemaVersion: "cra-pdf-field-profile.v1",
      documentId: plan.documentId,
      taxYear: 2025,
      officialSourceUrl: definition.officialFillablePdfUrl,
      templateSha256: templateDigest,
      verification: "host-pinned-official-sha256",
      semanticToPhysicalField,
    });

    adapter.register(templateHandle, {
      sha256: templateDigest,
      pageCount,
      physicalFields: Object.values(semanticToPhysicalField),
    });
    adapter.outputs.set(templateHandle, {
      localHandle: outputHandle,
      displayName: `${definition.title} (filled)`,
      pageCount,
      sha256: outputDigest,
    });
    adapter.register(outputHandle, { sha256: outputDigest, pageCount });
  }

  const request = {
    caseFile,
    templates,
    fieldProfiles,
    mailingDestinationSelection: "winnipeg-listed-area",
    packageId: "synthetic-package-0001",
    createdAt: AT,
  };

  return { adapter, request, plans };
}

/** Drives a complete, honest manual review to the point where export is permitted. */
function completeReview(prepared: { manifest: never; fillPlans: never }) {
  let state = createManualReviewState(prepared.manifest, prepared.fillPlans);
  state = startManualReview(state);
  for (const item of [...state.items]) {
    state = confirmManualReviewItem(state, item.id, state.packageSha256, AT);
  }
  return acknowledgeManualReview(state, FINAL_REVIEW_ACKNOWLEDGEMENT, AT);
}

test("the package declares that it cannot file electronically, and the flags are frozen", () => {
  assert.ok(Object.isFrozen(ELECTRONIC_FILING_CAPABILITIES));
  for (const [capability, enabled] of Object.entries(ELECTRONIC_FILING_CAPABILITIES)) {
    assert.equal(enabled, false, `${capability} must never be enabled`);
  }
  for (const expected of [
    "NETFILE",
    "EFILE",
    "electronicSubmission",
    "directCraTransmission",
    "simulatedFiling",
    "automaticFiling",
  ]) {
    assert.ok(expected in ELECTRONIC_FILING_CAPABILITIES, `${expected} must be declared and disabled`);
  }
});

test("an adapter that does not disable the network or declare every prohibition is refused", () => {
  assert.doesNotThrow(() => assertLocalOnlyAdapter({ capabilities: LOCAL_ONLY_CAPABILITIES } as never));

  for (const broken of [
    { ...LOCAL_ONLY_CAPABILITIES, networkAccess: "enabled" },
    { ...LOCAL_ONLY_CAPABILITIES, storage: "remote" },
    { ...LOCAL_ONLY_CAPABILITIES, atomicWrites: false },
  ]) {
    assert.throws(
      () => assertLocalOnlyAdapter({ capabilities: broken } as never),
      /network access|local-only|atomic/,
    );
  }

  for (const prohibition of LOCAL_ONLY_CAPABILITIES.prohibitedOperations) {
    const missing = LOCAL_ONLY_CAPABILITIES.prohibitedOperations.filter((entry) => entry !== prohibition);
    assert.throws(
      () => assertLocalOnlyAdapter({ capabilities: { ...LOCAL_ONLY_CAPABILITIES, prohibitedOperations: missing } } as never),
      new RegExp(prohibition),
      `an adapter that does not prohibit ${prohibition} must be refused`,
    );
  }
});

test("an unsafe or unreadable PDF is refused before anything is built from it", () => {
  const safe = {
    validPdf: true,
    pageCount: 3,
    sha256: fakeDigest(1),
    encrypted: false,
    activeContentDetected: false,
    embeddedFilesDetected: false,
    physicalFields: [],
  };
  assert.doesNotThrow(() => assertSafePdf(safe as never, "Sample"));

  const refusals: readonly [Partial<typeof safe>, RegExp][] = [
    [{ validPdf: false }, /not a valid non-empty PDF/],
    [{ pageCount: 0 }, /not a valid non-empty PDF/],
    [{ sha256: "too-short" }, /no valid SHA-256/],
    [{ encrypted: true }, /encrypted/],
    [{ activeContentDetected: true }, /active PDF content/],
    [{ embeddedFilesDetected: true }, /embedded files/],
  ];
  for (const [override, expected] of refusals) {
    assert.throws(() => assertSafePdf({ ...safe, ...override } as never, "Sample"), expected);
  }
});

test("a field profile pinned to a different template digest is refused", () => {
  const plan = {
    documentId: "T1",
    taxYear: 2025,
    officialTemplateUrl: CRA_DOCUMENT_2025_BY_ID.get("T1")!.officialFillablePdfUrl,
    outputMode: "official-fillable",
    fields: [{ semanticField: "T1.identity.givenName", value: "Sample", source: { kind: "identity", path: "x" } }],
    calculationLines: [],
    manualFields: [],
  };
  const profile = {
    schemaVersion: "cra-pdf-field-profile.v1",
    documentId: "T1",
    taxYear: 2025,
    officialSourceUrl: plan.officialTemplateUrl,
    templateSha256: fakeDigest(1),
    verification: "host-pinned-official-sha256",
    semanticToPhysicalField: { "T1.identity.givenName": "physical_1" },
  };
  const inspection = { sha256: fakeDigest(1), physicalFields: ["physical_1"] };

  assert.deepEqual(mapSemanticFields(plan as never, profile as never, inspection as never), [
    { physicalField: "physical_1", value: "Sample" },
  ]);

  assert.throws(
    () => mapSemanticFields(plan as never, { ...profile, templateSha256: fakeDigest(2) } as never, inspection as never),
    /pinned template digest/,
    "a profile pinned to another document's digest must be refused",
  );
  assert.throws(
    () => mapSemanticFields(plan as never, { ...profile, documentId: "ON428" } as never, inspection as never),
    /does not match/,
  );
  assert.throws(
    () => mapSemanticFields(plan as never, { ...profile, verification: "trust-me" } as never, inspection as never),
    /host-verified official template digest/,
  );
  assert.throws(
    () => mapSemanticFields(plan as never, profile as never, { ...inspection, physicalFields: [] } as never),
    /No verified physical PDF field/,
    "a semantic field with no verified physical counterpart must be refused",
  );
});

test("preparing a package fills every included form and merges them in order", async () => {
  const { adapter, request } = scenario();
  const prepared = await prepareMailInPackage(adapter as never, request as never);

  assert.deepEqual(adapter.fills.map((fill) => fill.documentId), ["T1", "ON428"]);
  assert.deepEqual(adapter.overlays, [], "every 2025 form is filled, not overlaid");
  assert.deepEqual(adapter.merges, [["T1-filled.pdf", "ON428-filled.pdf"]]);

  assert.equal(prepared.manifest.schemaVersion, "cra-mail-package.v1");
  assert.equal(prepared.manifest.taxYear, 2025);
  assert.equal(prepared.manifest.province, "ON");
  assert.equal(prepared.manifest.packageId, "synthetic-package-0001");
  assert.equal(prepared.manifest.calculationId, "synthetic-calc-1");
  assert.equal(prepared.artifact.pageCount, 2 + 3, "the package is as long as its parts");
});

test("the assembled manifest lists each document once, numbered in order", async () => {
  const { adapter, request } = scenario();
  const prepared = await prepareMailInPackage(adapter as never, request as never);

  assert.deepEqual(prepared.manifest.documents.map((entry: { documentId: string }) => entry.documentId), [
    "T1",
    "ON428",
  ]);
  assert.deepEqual(prepared.manifest.documents.map((entry: { sequence: number }) => entry.sequence), [1, 2]);
  for (const document of prepared.manifest.documents) {
    assert.equal(document.declaration, "filled official CRA form");
    assert.ok(document.title.length > 0);
    assert.match(document.sha256, /^[a-f0-9]{64}$/i);
  }
});

test("the manifest declares mail-only preparation and never claims to have filed", async () => {
  const { adapter, request } = scenario();
  const prepared = await prepareMailInPackage(adapter as never, request as never);
  const declarations = prepared.manifest.declarations.join(" ");

  assert.ok(declarations.includes("mail-in PDF preparation only"));
  assert.ok(declarations.includes("not an electronic filing or transmission"));
  assert.ok(declarations.includes("not CRA-certified"));
  assert.ok(declarations.includes("manual inspection and signatures are required"));
});

test("the mailing destination is carried into the manifest with its official basis", async () => {
  const { adapter, request } = scenario();
  const prepared = await prepareMailInPackage(adapter as never, request as never);

  assert.equal(prepared.manifest.mailingDestination.taxCentreName, "Winnipeg Tax Centre");
  assert.equal(prepared.manifest.mailingDestination.basis, "official-current-address-page");
  assert.equal(prepared.manifest.mailingDestination.selectedForResidenceCity, "Sample City");
});

test("a case file that cannot be prepared is refused before any adapter call", async () => {
  const { adapter, request } = scenario(
    syntheticCaseFile({
      unsupportedSituations: { ...allFalse(UNSUPPORTED_KEYS), deceasedReturn: true },
    }),
  );

  await assert.rejects(
    () => prepareMailInPackage(adapter as never, request as never),
    /preparation is blocked/,
  );
  assert.deepEqual(adapter.fills, [], "nothing may be built for a blocked case");
  assert.deepEqual(adapter.merges, []);
});

test("an invalid case file names what is wrong rather than failing vaguely", async () => {
  const { adapter, request } = scenario(
    syntheticCaseFile({
      consent: {
        localProcessingOnly: false,
        understandsNotTaxAdvice: true,
        understandsNotCraCertified: true,
        understandsMailOnlyOutput: true,
      },
    }),
  );

  await assert.rejects(
    () => prepareMailInPackage(adapter as never, request as never),
    /case file is invalid.*acknowledgements are required/s,
  );
  assert.deepEqual(adapter.fills, []);
});

test("a malformed package id is refused", async () => {
  for (const packageId of ["", "short", `${"a".repeat(129)}`, "-leading-dash"]) {
    const { adapter, request } = scenario();
    await assert.rejects(
      () => prepareMailInPackage(adapter as never, { ...request, packageId } as never),
      /Package id/,
      `${packageId || "(empty)"} must be refused`,
    );
  }
});

test("a review preview is available before review completes and needs no authorization", async () => {
  const { adapter, request } = scenario();
  const prepared = await prepareMailInPackage(adapter as never, request as never);

  const preview = await createReviewPreview(adapter as never, prepared as never);
  assert.equal(preview.localHandle, "package.pdf.preview");
  assert.deepEqual(adapter.previews, ["package.pdf"]);
  assert.deepEqual(adapter.exports, [], "previewing must not write anything");
});

test("the review checklist covers every form, signature field and the mailing destination", async () => {
  const { adapter, request } = scenario();
  const prepared = await prepareMailInPackage(adapter as never, request as never);
  const state = createManualReviewState(prepared.manifest, prepared.fillPlans);

  assert.equal(state.phase, "not-started");
  assert.ok(state.items.every((item: { status: string }) => item.status === "pending"));

  const ids = state.items.map((item: { id: string }) => item.id);
  assert.ok(ids.includes("form:T1"));
  assert.ok(ids.includes("form:ON428"));
  assert.ok(ids.includes("mailing-destination"), "the destination is reviewed like any other item");
  assert.equal(
    ids.filter((id: string) => id.startsWith("signature:T1:")).length,
    3,
    "each manual signature field is its own review item",
  );

  const categories = new Set(state.items.map((item: { category: string }) => item.category));
  assert.ok(categories.has("populated-form"));
  assert.ok(categories.has("signature-field"));
  assert.ok(categories.has("mailing-destination"));
});

test("review cannot be started twice, and confirming needs a started review", async () => {
  const { adapter, request } = scenario();
  const prepared = await prepareMailInPackage(adapter as never, request as never);
  const state = createManualReviewState(prepared.manifest, prepared.fillPlans);

  assert.throws(
    () => confirmManualReviewItem(state, "form:T1", state.packageSha256, AT),
    /must be in progress/,
  );

  const started = startManualReview(state);
  assert.equal(started.phase, "in-progress");
  assert.throws(() => startManualReview(started), /only be started once/);
});

test("confirming an item is recorded without mutating the previous state", async () => {
  const { adapter, request } = scenario();
  const prepared = await prepareMailInPackage(adapter as never, request as never);
  const started = startManualReview(createManualReviewState(prepared.manifest, prepared.fillPlans));

  const confirmed = confirmManualReviewItem(started, "form:T1", started.packageSha256, AT);

  assert.equal(
    started.items.find((item: { id: string }) => item.id === "form:T1")?.status,
    "pending",
    "the earlier state must be left alone",
  );
  const item = confirmed.items.find((entry: { id: string }) => entry.id === "form:T1");
  assert.equal(item?.status, "confirmed");
  assert.equal(item?.confirmedAt, AT);
  assert.equal(confirmed.phase, "in-progress", "one item does not complete the review");
});

test("a review confirmed against a different package digest is refused", async () => {
  const { adapter, request } = scenario();
  const prepared = await prepareMailInPackage(adapter as never, request as never);
  const started = startManualReview(createManualReviewState(prepared.manifest, prepared.fillPlans));

  // Somebody reviewed one package and confirmed against another. The whole
  // point of reviewing is that it was this content that was inspected.
  assert.throws(
    () => confirmManualReviewItem(started, "form:T1", fakeDigest(63), AT),
    /digest changed; restart manual review/,
  );
});

test("an unknown review item is refused", async () => {
  const { adapter, request } = scenario();
  const prepared = await prepareMailInPackage(adapter as never, request as never);
  const started = startManualReview(createManualReviewState(prepared.manifest, prepared.fillPlans));

  assert.throws(
    () => confirmManualReviewItem(started, "form:DOES-NOT-EXIST", started.packageSha256, AT),
    /Unknown manual-review item/,
  );
});

test("acknowledgement requires every item confirmed and the exact statement", async () => {
  const { adapter, request } = scenario();
  const prepared = await prepareMailInPackage(adapter as never, request as never);
  let state = startManualReview(createManualReviewState(prepared.manifest, prepared.fillPlans));

  assert.throws(
    () => acknowledgeManualReview(state, FINAL_REVIEW_ACKNOWLEDGEMENT, AT),
    /must be individually confirmed/,
  );

  for (const item of [...state.items]) {
    state = confirmManualReviewItem(state, item.id, state.packageSha256, AT);
  }
  assert.equal(state.phase, "items-complete");

  assert.throws(
    () => acknowledgeManualReview(state, "I read it, honest." as never, AT),
    /exact mail-only final-review acknowledgement/,
    "a paraphrase must not be accepted",
  );

  const acknowledged = acknowledgeManualReview(state, FINAL_REVIEW_ACKNOWLEDGEMENT, AT);
  assert.equal(acknowledged.phase, "acknowledged");
  assert.equal(acknowledged.finalAcknowledgement?.statementVersion, "mail-review-2025.v1");
});

test("the acknowledgement statement says the taxpayer must mail it and that nothing was filed", () => {
  assert.ok(FINAL_REVIEW_ACKNOWLEDGEMENT.includes("sign and mail the package myself"));
  assert.ok(FINAL_REVIEW_ACKNOWLEDGEMENT.includes("no return has been filed"));
  for (const subject of ["form", "calculation", "attachment", "mailing destination", "signature"]) {
    assert.ok(FINAL_REVIEW_ACKNOWLEDGEMENT.includes(subject), `the statement must name ${subject}`);
  }
});

test("export is blocked until review is genuinely finished", async () => {
  const { adapter, request } = scenario();
  const prepared = await prepareMailInPackage(adapter as never, request as never);
  let state = createManualReviewState(prepared.manifest, prepared.fillPlans);

  assert.throws(() => createPrintAuthorization(prepared.manifest, state, AT), /remain blocked/);

  state = startManualReview(state);
  assert.throws(() => createPrintAuthorization(prepared.manifest, state, AT), /remain blocked/);

  const [first, ...rest] = state.items;
  state = confirmManualReviewItem(state, first.id, state.packageSha256, AT);
  assert.throws(
    () => createPrintAuthorization(prepared.manifest, state, AT),
    /remain blocked/,
    "a partly reviewed package must not be exportable",
  );
  assert.deepEqual(adapter.exports, []);
  assert.ok(rest.length > 0);
});

test("a completed review authorizes local export and print, and prohibits every filing route", async () => {
  const { adapter, request } = scenario();
  const prepared = await prepareMailInPackage(adapter as never, request as never);
  const authorization = createPrintAuthorization(prepared.manifest, completeReview(prepared as never), AT);

  assert.equal(authorization.kind, "cra-mail-package-print-authorization");
  assert.equal(authorization.packageId, prepared.manifest.packageId);
  assert.equal(authorization.expiresOnContentChange, true);
  assert.deepEqual([...authorization.permits], ["export-local-pdf", "print-local-pdf"]);
  for (const prohibited of [
    "NETFILE",
    "EFILE",
    "electronic submission",
    "direct CRA transmission",
    "simulated filing",
    "automatic filing",
  ]) {
    assert.ok(authorization.prohibits.includes(prohibited), `${prohibited} must be prohibited`);
  }
});

test("an authorized package exports and prints locally, and nowhere else", async () => {
  const { adapter, request } = scenario();
  const prepared = await prepareMailInPackage(adapter as never, request as never);
  const authorization = createPrintAuthorization(prepared.manifest, completeReview(prepared as never), AT);

  await exportReviewedMailInPackage(adapter as never, prepared as never, "C:/synthetic/out.pdf", authorization as never);
  await printReviewedMailInPackage(adapter as never, prepared as never, authorization as never);

  assert.deepEqual(adapter.exports, [
    { handle: "package.pdf", destination: "C:/synthetic/out.pdf", authorization },
  ]);
  assert.deepEqual(adapter.prints, [{ handle: "package.pdf", authorization }]);
});

test("an authorization issued for another package is refused", async () => {
  const { adapter, request } = scenario();
  const prepared = await prepareMailInPackage(adapter as never, request as never);
  const authorization = createPrintAuthorization(prepared.manifest, completeReview(prepared as never), AT);

  assert.throws(
    () => assertPrintAuthorization({ ...prepared.manifest, packageId: "another-package-0002" } as never, authorization as never),
    /does not match the prepared package/,
  );
  assert.throws(
    () => assertPrintAuthorization({ ...prepared.manifest, packageSha256: fakeDigest(55) } as never, authorization as never),
    /does not match the prepared package/,
    "a package whose content changed must invalidate its authorization",
  );
});

test("an authorization that does not permit local output is refused", async () => {
  const { adapter, request } = scenario();
  const prepared = await prepareMailInPackage(adapter as never, request as never);
  const authorization = createPrintAuthorization(prepared.manifest, completeReview(prepared as never), AT);

  assert.throws(
    () => assertPrintAuthorization(prepared.manifest, { ...authorization, permits: ["export-local-pdf"] } as never),
    /invalid local-output scope/,
  );
  assert.throws(
    () => assertPrintAuthorization(prepared.manifest, { ...authorization, kind: "something-else" } as never),
    /does not match the prepared package/,
  );
});

/**
 * KNOWN GAP, pinned deliberately.
 *
 * `assertPrintAuthorization` is the only check the export and print entry points
 * run, and it inspects the authorization's kind, package id, digest and permits
 * tuple — never the review state that should have produced it, and never the
 * `prohibits` list. So an authorization literal assembled by hand is accepted,
 * and the entire manual-review chain can be stepped around by a caller inside
 * this process.
 *
 * That is a real weakening of the product's central boundary, and it is pinned
 * rather than fixed because closing it is a design decision about how an
 * authorization proves its own provenance — a signature, a nonce held by the
 * review state, or a token the engine mints and remembers. This test records
 * exactly how far the current gate reaches, and turns red the moment it reaches
 * further, at which point the assertion should be inverted.
 */
test("a fabricated authorization is currently accepted, which is the known review-bypass gap", async () => {
  const { adapter, request } = scenario();
  const prepared = await prepareMailInPackage(adapter as never, request as never);

  const fabricated = {
    kind: "cra-mail-package-print-authorization",
    packageId: prepared.manifest.packageId,
    packageSha256: prepared.manifest.packageSha256,
    issuedAt: AT,
    expiresOnContentChange: true,
    permits: ["export-local-pdf", "print-local-pdf"],
    // Deliberately empty: the gate does not look at this list at all.
    prohibits: [],
  };

  assert.doesNotThrow(
    () => assertPrintAuthorization(prepared.manifest, fabricated as never),
    "if this now throws, the gate was tightened and this test should assert the refusal instead",
  );

  await exportReviewedMailInPackage(adapter as never, prepared as never, "C:/synthetic/out.pdf", fabricated as never);
  assert.equal(adapter.exports.length, 1, "no manual review was performed, and the export still happened");
});

test("an export with no destination handle is refused", async () => {
  const { adapter, request } = scenario();
  const prepared = await prepareMailInPackage(adapter as never, request as never);
  const authorization = createPrintAuthorization(prepared.manifest, completeReview(prepared as never), AT);

  await assert.rejects(
    () => exportReviewedMailInPackage(adapter as never, prepared as never, "", authorization as never),
    /bounded local destination handle/,
  );
  assert.deepEqual(adapter.exports, []);
});

test("the adapter exposes no route that could transmit a return", () => {
  // Structural rather than declarative: whatever the capability flags say, there
  // must be no method on the boundary that could send anything anywhere.
  const adapter = new FakePdfAdapter();
  const methods = new Set([
    ...Object.getOwnPropertyNames(Object.getPrototypeOf(adapter)),
    ...Object.keys(adapter),
  ]);

  for (const forbidden of ["submit", "transmit", "send", "netfile", "efile", "upload", "file"]) {
    assert.ok(!methods.has(forbidden), `the adapter boundary must expose no ${forbidden} method`);
  }
  for (const expected of ["inspect", "fillOfficialTemplate", "merge", "preview", "exportAtomically", "printLocally"]) {
    assert.ok(methods.has(expected), `the adapter boundary must expose ${expected}`);
  }
});
