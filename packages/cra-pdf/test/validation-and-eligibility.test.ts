/**
 * What a case file must satisfy, and which situations block preparation.
 *
 * Eligibility here is not a quality score: it decides whether the package will
 * build a return at all. A situation this implementation cannot handle must
 * block with a message naming the official form that does handle it, rather
 * than producing a plausible package for a return that needed T2203 or T691.
 *
 * Tax year: 2025. Province: Ontario. Every fixture is synthetic.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { useTypeScriptSources } from "./typescript-source-resolver.ts";

useTypeScriptSources();

const {
  assessEligibility,
  validateCaseFile,
  assertCaseFileCanBePrepared,
  createPortableCarryForwardExport,
  importPortableCarryForwards,
} = await import("../src/validation.ts");

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

function caseFile(overrides: Record<string, unknown> = {}) {
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

const withIdentity = (patch: Record<string, unknown>) =>
  caseFile({ identity: { ...caseFile().identity, ...patch } });

test("a well-formed synthetic case file validates cleanly and is eligible", () => {
  assert.deepEqual(validateCaseFile(caseFile() as never), []);
  const assessment = assessEligibility(caseFile() as never);
  assert.equal(assessment.eligibleForAutomatedPreparation, true);
});

test("every case file is told, as information, that this prepares paper only", () => {
  // Present even for a spotless return, because it is the product boundary and
  // not a warning about the taxpayer's circumstances.
  const finding = assessEligibility(caseFile() as never).findings.find(
    (entry: { code: string }) => entry.code === "scope.mail-only",
  );

  assert.ok(finding);
  assert.equal(finding.severity, "information");
  assert.ok(finding.message.includes("does not file a return"));
  assert.ok(finding.message.includes("mailing"));
  assert.equal(finding.sourceId, "cra-paper-filing");
});

test("each unsupported situation blocks preparation on its own", () => {
  for (const situation of UNSUPPORTED_KEYS) {
    const subject = caseFile({
      unsupportedSituations: { ...allFalse(UNSUPPORTED_KEYS), [situation]: true },
    });
    const assessment = assessEligibility(subject as never);

    assert.equal(
      assessment.eligibleForAutomatedPreparation,
      false,
      `${situation} must block automated preparation`,
    );
    const blockers = assessment.findings.filter((entry: { severity: string }) => entry.severity === "blocker");
    assert.equal(blockers.length, 1, `${situation} must raise exactly one blocker`);
    assert.ok(blockers[0].code.startsWith("unsupported."), `${situation} must use an unsupported code`);
    assert.ok(blockers[0].message.length > 0);
    assert.ok(blockers[0].sourceId.length > 0, `${situation} must cite an official source`);
  }
});

test("a blocked situation names the official form that does handle it", () => {
  // Naming T2203, T691 and T1206 is what turns a refusal into a next step.
  const expectations: readonly [string, string][] = [
    ["businessPermanentEstablishmentOutsideOntario", "T2203"],
    ["alternativeMinimumTax", "T691"],
    ["splitIncome", "T1206"],
    ["specifiedForeignPropertyOverThreshold", "T1135"],
  ];

  for (const [situation, form] of expectations) {
    const assessment = assessEligibility(
      caseFile({ unsupportedSituations: { ...allFalse(UNSUPPORTED_KEYS), [situation]: true } }) as never,
    );
    const blocker = assessment.findings.find((entry: { severity: string }) => entry.severity === "blocker");
    assert.ok(blocker?.message.includes(form), `${situation} must point at ${form}`);
  }
});

test("several unsupported situations are all reported rather than only the first", () => {
  const assessment = assessEligibility(
    caseFile({
      unsupportedSituations: {
        ...allFalse(UNSUPPORTED_KEYS),
        deceasedReturn: true,
        bankruptcyReturn: true,
        trustIncomeOrTrustReturn: true,
      },
    }) as never,
  );
  const blockers = assessment.findings.filter((entry: { severity: string }) => entry.severity === "blocker");
  assert.equal(blockers.length, 3, "fixing them one at a time is a worse experience than seeing all three");
});

test("a calculation warning becomes a manual-review finding without blocking", () => {
  const assessment = assessEligibility(
    caseFile({
      calculation: { ...caseFile().calculation, warnings: ["A donation carry-forward needs checking."] },
    }) as never,
  );

  const review = assessment.findings.find((entry: { code: string }) => entry.code === "calculation.manual-review");
  assert.ok(review);
  assert.equal(review.severity, "manual-review");
  assert.equal(review.message, "A donation carry-forward needs checking.");
  assert.equal(assessment.eligibleForAutomatedPreparation, true, "a warning is not a blocker");
});

test("an unsupported schema version, tax year or province is refused", () => {
  assert.ok(
    validateCaseFile(caseFile({ schemaVersion: "cra-pdf-case.v2" }) as never)
      .some((message: string) => message.includes("case-file schema version")),
  );
  assert.ok(
    validateCaseFile(caseFile({ taxYear: 2024 }) as never)
      .some((message: string) => message.includes("2025 tax-year package")),
  );
  assert.ok(
    validateCaseFile(caseFile({ province: "BC" }) as never)
      .some((message: string) => message.includes("Ontario package")),
  );
});

test("every consent acknowledgement is required", () => {
  for (const key of [
    "localProcessingOnly",
    "understandsNotTaxAdvice",
    "understandsNotCraCertified",
    "understandsMailOnlyOutput",
  ]) {
    const errors = validateCaseFile(
      caseFile({ consent: { ...caseFile().consent, [key]: false } }) as never,
    );
    assert.ok(
      errors.some((message: string) => message.includes("acknowledgements are required")),
      `${key} must be required`,
    );
  }
});

test("identity formats are checked, and the number itself is never echoed back", () => {
  const sinError = validateCaseFile(withIdentity({ socialInsuranceNumber: "12345" }) as never);
  assert.ok(sinError.some((message: string) => message.includes("exactly nine digits")));
  assert.ok(
    sinError.every((message: string) => !message.includes("12345")),
    "a validation message must never quote the value it rejected",
  );

  assert.ok(
    validateCaseFile(withIdentity({ dateOfBirth: "14/03/1985" }) as never)
      .some((message: string) => message.includes("YYYY-MM-DD")),
  );
  assert.ok(
    validateCaseFile(withIdentity({ mailingAddress: { ...caseFile().identity.mailingAddress, postalCode: "NOPE" } }) as never)
      .some((message: string) => message.includes("postal code")),
  );
});

test("an Ontario mailing address in Canada is required for this package", () => {
  const address = caseFile().identity.mailingAddress;
  assert.ok(
    validateCaseFile(withIdentity({ mailingAddress: { ...address, province: "BC" } }) as never)
      .some((message: string) => message.includes("Ontario mailing address")),
  );
  assert.ok(
    validateCaseFile(withIdentity({ mailingAddress: { ...address, country: "United States" } }) as never)
      .some((message: string) => message.includes("Ontario mailing address")),
  );
});

test("a calculation line for a form the flags exclude is refused", () => {
  // Populating a field on a form that will not be in the envelope is a silent
  // way to lose a figure, so it fails validation rather than being dropped.
  const errors = validateCaseFile(
    caseFile({ calculation: { ...caseFile().calculation, federalLines: { "S9:34900": 100_000 } } }) as never,
  );
  assert.ok(errors.some((message: string) => message.includes("not included by the case flags")));
});

test("a calculation amount that is not safe integer cents is refused", () => {
  const errors = validateCaseFile(
    caseFile({ calculation: { ...caseFile().calculation, federalLines: { "T1:15000": 1.5 } } }) as never,
  );
  assert.ok(errors.some((message: string) => message.includes("not safe integer cents")));
});

test("an unparseable calculation line key is refused", () => {
  const errors = validateCaseFile(
    caseFile({ calculation: { ...caseFile().calculation, federalLines: { "nonsense": 100 } } }) as never,
  );
  assert.ok(errors.some((message: string) => message.includes("must identify a supported document and line")));
});

test("attachment identifiers, names and digests are bounded and unique", () => {
  const attachment = {
    id: "att-1",
    displayName: "Synthetic receipt",
    localHandle: "receipt.pdf",
    kind: "receipt",
  };

  assert.deepEqual(validateCaseFile(caseFile({ attachments: [attachment] }) as never), []);

  assert.ok(
    validateCaseFile(caseFile({ attachments: [attachment, attachment] }) as never)
      .some((message: string) => message.includes("Duplicate attachment id")),
  );
  assert.ok(
    validateCaseFile(caseFile({ attachments: [{ ...attachment, displayName: "" }] }) as never)
      .some((message: string) => message.includes("invalid display name")),
  );
  assert.ok(
    validateCaseFile(caseFile({ attachments: [{ ...attachment, sha256: "not-a-digest" }] }) as never)
      .some((message: string) => message.includes("invalid SHA-256")),
  );
});

test("a carry-forward must be non-negative cents from a plausible year", () => {
  const carryForward = {
    type: "charitable-donation",
    amountCents: 50_000,
    originTaxYear: 2024,
    source: "notice-of-assessment",
  };

  assert.deepEqual(validateCaseFile(caseFile({ carryForwards: [carryForward] }) as never), []);
  assert.ok(
    validateCaseFile(caseFile({ carryForwards: [{ ...carryForward, amountCents: -1 }] }) as never)
      .some((message: string) => message.includes("non-negative safe integer cents")),
  );
  for (const originTaxYear of [1899, 2026, 2025.5]) {
    assert.ok(
      validateCaseFile(caseFile({ carryForwards: [{ ...carryForward, originTaxYear }] }) as never)
        .some((message: string) => message.includes("invalid origin tax year")),
      `${originTaxYear} must be refused`,
    );
  }
});

test("preparation throws with the reason rather than returning a broken assessment", () => {
  assert.doesNotThrow(() => assertCaseFileCanBePrepared(caseFile() as never));

  assert.throws(
    () => assertCaseFileCanBePrepared(caseFile({ taxYear: 2024 }) as never),
    /case file is invalid.*2025 tax-year package/s,
  );
  assert.throws(
    () =>
      assertCaseFileCanBePrepared(
        caseFile({ unsupportedSituations: { ...allFalse(UNSUPPORTED_KEYS), deceasedReturn: true } }) as never,
      ),
    /preparation is blocked.*deceased/s,
  );
});

test("a carry-forward export carries only balances and lists what it left out", () => {
  const carryForward = {
    type: "charitable-donation",
    amountCents: 50_000,
    originTaxYear: 2024,
    source: "notice-of-assessment",
  };
  const exported = createPortableCarryForwardExport(caseFile({ carryForwards: [carryForward] }) as never, AT);

  assert.equal(exported.schemaVersion, "cra-carry-forward.v1");
  assert.equal(exported.sourceTaxYear, 2025);
  assert.equal(exported.province, "ON");
  assert.equal(exported.exportedAt, AT);
  assert.deepEqual([...exported.carryForwards], [carryForward]);

  for (const excluded of [
    "taxpayer identity",
    "social insurance number",
    "addresses",
    "attachments",
    "signatures",
    "PDF content",
  ]) {
    assert.ok(exported.exclusions.includes(excluded), `the export must declare it omits ${excluded}`);
  }

  // The strongest form: the identity must not survive anywhere in the bytes.
  const serialized = JSON.stringify(exported);
  assert.ok(!serialized.includes("000000000"));
  assert.ok(!serialized.includes("Synthetic-Fixture"));
  assert.ok(!serialized.includes("Example Street"));
});

test("a carry-forward export is refused for a case file that cannot be prepared", () => {
  assert.throws(
    () =>
      createPortableCarryForwardExport(
        caseFile({ unsupportedSituations: { ...allFalse(UNSUPPORTED_KEYS), bankruptcyReturn: true } }) as never,
        AT,
      ),
    /preparation is blocked/,
  );
});

test("an import refuses a foreign schema, year or province, and a negative balance", () => {
  const exported = createPortableCarryForwardExport(caseFile() as never, AT);
  assert.equal(importPortableCarryForwards(exported), exported);

  for (const broken of [
    { schemaVersion: "cra-carry-forward.v2" },
    { sourceTaxYear: 2024 },
    { province: "BC" },
  ]) {
    assert.throws(
      () => importPortableCarryForwards({ ...exported, ...broken } as never),
      /Unsupported carry-forward export schema, tax year, or province/,
      `${JSON.stringify(broken)} must be refused`,
    );
  }

  assert.throws(
    () =>
      importPortableCarryForwards({
        ...exported,
        carryForwards: [
          { type: "charitable-donation", amountCents: -1, originTaxYear: 2024, source: "prior-return" },
        ],
      } as never),
    /non-negative safe integer cents/,
  );
});
