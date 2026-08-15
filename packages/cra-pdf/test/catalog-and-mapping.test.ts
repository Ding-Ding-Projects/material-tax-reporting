/**
 * The 2025 CRA document catalogue and the fill-plan mapping.
 *
 * The catalogue decides which official forms a mail-in package contains and
 * where each template is fetched from, so a wrong form number or a mistyped
 * template URL sends somebody to the wrong document — a failure that looks like
 * working software right up until an envelope reaches a tax centre. The URLs
 * are therefore checked as derivations of the form number rather than as free
 * text, which is what makes a single-character typo visible.
 *
 * Tax year: 2025. Province: Ontario.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { useTypeScriptSources } from "./typescript-source-resolver.ts";

useTypeScriptSources();

const {
  CRA_DOCUMENTS_2025,
  CRA_DOCUMENT_2025_BY_ID,
  OFFICIAL_SOURCES_2025,
  createOntarioMailingDestination,
} = await import("../src/catalog/index.ts");
const { parseCalculationLineKey, formatCentsForCraField, createFillPlans2025 } = await import(
  "../src/mapping/2025.ts"
);
const { SUPPORTED_TAX_YEARS } = await import("../src/types.ts");

const PDF_ROOT = "https://www.canada.ca/content/dam/cra-arc/formspubs/pbg";
const PACKAGE_ROOT =
  "https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package";

const IDENTITY = {
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
} as const;

const INCLUSION_FLAG_KEYS = [
  "spouseTransfers",
  "capitalGains",
  "dependantClaims",
  "canadaWorkersBenefit",
  "registeredPlanActivity",
  "cppScheduleRequired",
  "donations",
  "tuition",
  "multigenerationalHomeRenovation",
  "selfEmploymentEi",
  "fhsaActivity",
  "ontarioCredits",
  "ontarioBenefitsApplication",
  "liftCredit",
  "careCredit",
  "ontarioSpouseTransfers",
  "ontarioTuitionCarryForward",
] as const;

const noFlags = () =>
  Object.fromEntries(INCLUSION_FLAG_KEYS.map((key) => [key, false])) as Record<string, boolean>;

const snapshot = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: "tax-calculation-snapshot.v1",
  taxYear: 2025,
  province: "ON",
  calculationId: "synthetic-calc-1",
  createdAt: "2026-04-30T12:00:00.000Z",
  federalLines: {},
  ontarioLines: {},
  inclusionFlags: noFlags(),
  warnings: [],
  ...overrides,
});

test("only the 2025 tax year is supported", () => {
  assert.deepEqual([...SUPPORTED_TAX_YEARS], [2025]);
});

test("the catalogue holds nineteen documents with unique identifiers", () => {
  assert.equal(CRA_DOCUMENTS_2025.length, 19);
  assert.equal(new Set(CRA_DOCUMENTS_2025.map((entry) => entry.id)).size, 19);
  assert.equal(new Set(CRA_DOCUMENTS_2025.map((entry) => entry.formNumber)).size, 19);
});

test("every document declares the 2025 tax year and a non-empty title", () => {
  for (const entry of CRA_DOCUMENTS_2025) {
    assert.equal(entry.taxYear, 2025, `${entry.id} must declare its tax year`);
    assert.ok(entry.title.length > 0, `${entry.id} must carry a title`);
    assert.ok(
      entry.province === "ON" || entry.province === "federal",
      `${entry.id} must be federal or Ontario`,
    );
  }
});

test("the T1 return and ON428 are always included; every other form is conditional", () => {
  const always = CRA_DOCUMENTS_2025.filter((entry) => entry.inclusion === "always");
  assert.deepEqual(
    always.map((entry) => entry.id).sort(),
    ["ON428", "T1"],
    "a mail-in Ontario package is the return plus ON428 at minimum",
  );

  // An always-included form must not also be gated on a flag, or the two rules
  // could disagree about whether it belongs in the package.
  for (const entry of always) {
    assert.ok(!("inclusionFlag" in entry), `${entry.id} must not carry an inclusion flag`);
  }
});

test("each conditional form is gated on its own distinct inclusion flag", () => {
  const conditional = CRA_DOCUMENTS_2025.filter((entry) => entry.inclusion === "conditional");
  const flags = conditional.map((entry) => entry.inclusionFlag);

  assert.equal(conditional.length, 17);
  assert.equal(new Set(flags).size, 17, "no two forms may share a flag");
  assert.deepEqual([...flags].sort(), [...INCLUSION_FLAG_KEYS].sort());
});

test("every template URL is derived from the form number rather than typed by hand", () => {
  // The one assertion that catches a single-character typo in a URL nobody
  // would notice until a download 404s.
  for (const entry of CRA_DOCUMENTS_2025) {
    const slug = entry.formNumber.toLowerCase();
    assert.equal(
      entry.officialFillablePdfUrl,
      `${PDF_ROOT}/${slug}/${slug}-fill-25e.pdf`,
      `${entry.id} fillable PDF URL`,
    );
    assert.equal(
      entry.landingPageUrl,
      entry.province === "ON" ? `${PACKAGE_ROOT}/ontario/${slug}.html` : `${PACKAGE_ROOT}/${slug}.html`,
      `${entry.id} landing page URL`,
    );
    assert.ok(entry.officialFillablePdfUrl.startsWith("https://"), `${entry.id} must use https`);
  }
});

test("the lookup map and the catalogue array describe the same documents", () => {
  assert.equal(CRA_DOCUMENT_2025_BY_ID.size, CRA_DOCUMENTS_2025.length);
  for (const entry of CRA_DOCUMENTS_2025) {
    assert.equal(
      CRA_DOCUMENT_2025_BY_ID.get(entry.id),
      entry,
      `${entry.id} must resolve to the very same definition`,
    );
  }
});

test("the T1 return records that its signature fields stay manual", () => {
  const t1 = CRA_DOCUMENT_2025_BY_ID.get("T1");
  assert.ok(t1);
  assert.equal(t1.formNumber, "5006-R");
  assert.ok(
    t1.notes.some((note) => note.includes("signature")),
    "the return must say its signature is not filled in for the taxpayer",
  );
});

test("every official source is an https Canada Revenue Agency citation", () => {
  assert.ok(OFFICIAL_SOURCES_2025.length > 0);
  assert.equal(new Set(OFFICIAL_SOURCES_2025.map((entry) => entry.id)).size, OFFICIAL_SOURCES_2025.length);
  for (const source of OFFICIAL_SOURCES_2025) {
    assert.ok(source.url.startsWith("https://www.canada.ca/"), `${source.id} must cite canada.ca`);
    assert.match(source.retrievedOn, /^\d{4}-\d{2}-\d{2}$/, `${source.id} must record retrieval`);
    assert.ok(source.supports.length > 0, `${source.id} must say what it supports`);
  }
});

test("the mailing destination is a real tax centre carrying its official basis", () => {
  const winnipeg = createOntarioMailingDestination("winnipeg-listed-area", "Sample City");
  const sudbury = createOntarioMailingDestination("sudbury-listed-area", "Sample City");

  assert.equal(winnipeg.taxCentreName, "Winnipeg Tax Centre");
  assert.equal(sudbury.taxCentreName, "Sudbury Tax Centre");
  assert.notDeepEqual(winnipeg.addressLines, sudbury.addressLines);

  for (const destination of [winnipeg, sudbury]) {
    assert.equal(destination.basis, "official-current-address-page");
    assert.equal(destination.selectedForResidenceCity, "Sample City");
    assert.ok(destination.addressLines.length >= 2);
    assert.equal(destination.addressLines.at(-1), "Canada");
    assert.ok(destination.officialSourceUrl.startsWith("https://www.canada.ca/"));
  }
});

test("cents are formatted as plain decimal dollars with two places", () => {
  const cases: readonly [number, string][] = [
    [0, "0.00"],
    [1, "0.01"],
    [5, "0.05"],
    [100, "1.00"],
    [123_456, "1234.56"],
    [-1, "-0.01"],
    [-5, "-0.05"],
    [-123_456, "-1234.56"],
  ];
  for (const [cents, expected] of cases) {
    assert.equal(formatCentsForCraField(cents), expected, `${cents} cents`);
  }
});

test("a field amount that is not safe integer cents is refused rather than rounded", () => {
  for (const invalid of [1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
    assert.throws(
      () => formatCentsForCraField(invalid),
      /safe integer cents/,
      `${invalid} must be refused`,
    );
  }
});

test("a calculation line key names a supported document and a well-formed line", () => {
  assert.deepEqual(parseCalculationLineKey("T1:31600"), { documentId: "T1", line: "31600" });
  assert.deepEqual(parseCalculationLineKey("ON428:58080"), { documentId: "ON428", line: "58080" });
  assert.deepEqual(parseCalculationLineKey("ON(S11):5"), { documentId: "ON(S11)", line: "5" });
});

test("a malformed or unknown calculation line key is rejected", () => {
  for (const key of ["", "T1", "T1:", ":31600", "XX:1", "T1:a:b", "T1:_x", `T1:${"a".repeat(65)}`]) {
    assert.equal(parseCalculationLineKey(key), undefined, `${key || "(empty)"} must be rejected`);
  }
  assert.ok(parseCalculationLineKey(`T1:${"a".repeat(64)}`), "64 characters is still accepted");
});

test("a minimal case produces plans for the two always-included forms, in catalogue order", () => {
  const plans = createFillPlans2025(IDENTITY, snapshot());

  assert.deepEqual(plans.map((plan) => plan.documentId), ["T1", "ON428"]);
  for (const plan of plans) {
    assert.equal(plan.taxYear, 2025);
    assert.equal(
      plan.officialTemplateUrl,
      CRA_DOCUMENT_2025_BY_ID.get(plan.documentId)?.officialFillablePdfUrl,
      `${plan.documentId} must point at its catalogue template`,
    );
  }
});

test("a raised inclusion flag adds exactly its own form", () => {
  const plans = createFillPlans2025(
    IDENTITY,
    snapshot({ inclusionFlags: { ...noFlags(), donations: true } }),
  );
  assert.deepEqual(plans.map((plan) => plan.documentId), ["T1", "ON428", "S9"]);
});

test("only the return carries manual signature fields", () => {
  const plans = createFillPlans2025(IDENTITY, snapshot());
  const t1 = plans.find((plan) => plan.documentId === "T1");
  const on428 = plans.find((plan) => plan.documentId === "ON428");

  assert.ok(t1);
  assert.deepEqual(t1.manualFields, [
    "Taxpayer signature",
    "Signature date",
    "Telephone number if required by the current form",
  ]);
  assert.deepEqual(on428?.manualFields, [], "a schedule is not separately signed");
});

test("the return is populated from the identity, and the province is a stated constant", () => {
  const plans = createFillPlans2025(IDENTITY, snapshot());
  const t1 = plans.find((plan) => plan.documentId === "T1");
  assert.ok(t1);

  const byField = new Map(t1.fields.map((field) => [field.semanticField, field]));
  assert.equal(byField.get("T1.identity.givenName")?.value, "Sample");
  assert.equal(byField.get("T1.identity.familyName")?.value, "Synthetic-Fixture");
  assert.equal(byField.get("T1.identity.address.postalCode")?.value, "K1A0B1");
  assert.equal(byField.get("T1.identity.sin")?.value, "000000000");

  // Ontario residence is not read off the address; it is asserted by the
  // package itself, and must say so rather than pretending to be user input.
  const province = byField.get("T1.residence.provinceOnDecember31");
  assert.equal(province?.value, "ON");
  assert.equal(province?.source.kind, "constant");
});

test("an optional second address line appears only when it was supplied", () => {
  const without = createFillPlans2025(IDENTITY, snapshot()).find((plan) => plan.documentId === "T1");
  const with_ = createFillPlans2025(
    { ...IDENTITY, mailingAddress: { ...IDENTITY.mailingAddress, line2: "Unit 4" } },
    snapshot(),
  ).find((plan) => plan.documentId === "T1");

  assert.equal(without?.fields.length, 11);
  assert.equal(with_?.fields.length, 12);
  assert.ok(!without?.fields.some((field) => field.semanticField === "T1.identity.address.line2"));
  assert.equal(
    with_?.fields.find((field) => field.semanticField === "T1.identity.address.line2")?.value,
    "Unit 4",
  );
});

test("a calculation line becomes a formatted field on the document it names", () => {
  const plans = createFillPlans2025(
    IDENTITY,
    snapshot({
      federalLines: { "T1:15000": 8_000_000, "T1:26000": 7_600_000 },
      ontarioLines: { "ON428:58040": 1_274_700 },
    }),
  );

  const t1 = plans.find((plan) => plan.documentId === "T1");
  const on428 = plans.find((plan) => plan.documentId === "ON428");

  assert.equal(
    t1?.fields.find((field) => field.semanticField === "T1.line.15000")?.value,
    "80000.00",
    "cents become the decimal string a CRA field expects",
  );
  assert.equal(t1?.fields.find((field) => field.semanticField === "T1.line.26000")?.value, "76000.00");
  assert.equal(
    on428?.fields.find((field) => field.semanticField === "ON428.line.58040")?.value,
    "12747.00",
  );

  assert.deepEqual(t1?.calculationLines, ["T1:15000", "T1:26000"]);
  assert.deepEqual(on428?.calculationLines, ["ON428:58040"]);
});

test("a calculation line for an excluded form is not smuggled onto another document", () => {
  // S9 is not included here, so its line must not appear anywhere. Silently
  // relocating it would populate a field on the wrong official form.
  const plans = createFillPlans2025(IDENTITY, snapshot({ federalLines: { "S9:34900": 100_000 } }));

  assert.deepEqual(plans.map((plan) => plan.documentId), ["T1", "ON428"]);
  for (const plan of plans) {
    assert.ok(
      !plan.calculationLines.includes("S9:34900"),
      `${plan.documentId} must not carry an excluded form's line`,
    );
    assert.ok(!plan.fields.some((field) => field.semanticField.includes("34900")));
  }
});

test("every generated field names the source it came from", () => {
  const plans = createFillPlans2025(IDENTITY, snapshot({ federalLines: { "T1:15000": 8_000_000 } }));
  for (const plan of plans) {
    for (const field of plan.fields) {
      assert.ok(field.semanticField.startsWith(`${plan.documentId}.`), "a field belongs to its document");
      assert.ok(
        ["identity", "federal-line", "ontario-line", "constant"].includes(field.source.kind),
        `unexpected source kind ${field.source.kind}`,
      );
      assert.ok(typeof field.value === "string" || typeof field.value === "boolean");
    }
  }
});
