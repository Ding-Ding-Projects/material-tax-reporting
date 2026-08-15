/**
 * What the 2025 ruleset refuses.
 *
 * The calculation is only half the contract. The other half is that a return it
 * cannot honestly compute is blocked rather than approximated, and that a
 * figure nobody has checked against its official worksheet is reported as
 * needing review rather than passed through silently. These tests exercise the
 * refusals themselves, because a validator nobody has watched reject something
 * is indistinguishable from one that accepts everything.
 *
 * Tax year: 2025. All fixtures are synthetic.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { CALCULATED_AT, dollars, syntheticReturn } from "./synthetic-return.ts";
import { useTypeScriptSources } from "./typescript-source-resolver.ts";

useTypeScriptSources();

const { validateTaxReturn } = await import("../src/validation.ts");
const { calculateTaxReturn } = await import("../src/calculate.ts");

type Issue = ReturnType<typeof validateTaxReturn>[number];

const codes = (issues: readonly Issue[]): string[] => issues.map((entry) => entry.code);
const errorsOf = (issues: readonly Issue[]): Issue[] =>
  issues.filter((entry) => entry.severity === "error");

test("a well-formed synthetic return raises no errors", () => {
  const issues = validateTaxReturn(syntheticReturn());
  assert.deepEqual(errorsOf(issues), [], "the baseline fixture must be valid");
});

test("mandatory manual review is always raised, even for a spotless return", () => {
  // This is the product boundary expressed as a validation issue. It must never
  // be conditional on anything, because it is the step that stands between a
  // computed figure and a package somebody mails.
  const issues = validateTaxReturn(syntheticReturn());
  const review = issues.find((entry) => entry.code === "MANDATORY_MANUAL_REVIEW");

  assert.ok(review, "every return must carry the manual-review issue");
  assert.equal(review.severity, "review");
  assert.equal(review.path, "return");
  assert.ok(review.sourceIds.includes("cra-paper-filing"));
  for (const subject of ["calculation", "form", "attachment", "mailing destination", "signature"]) {
    assert.ok(review.message.includes(subject), `the review notice must name ${subject}`);
  }
});

test("an unsupported schema version, tax year, or province is refused", () => {
  assert.ok(
    codes(validateTaxReturn(syntheticReturn({ overrides: { schemaVersion: "something-else" as never } })))
      .includes("UNSUPPORTED_SCHEMA"),
  );
  assert.ok(
    codes(validateTaxReturn(syntheticReturn({ overrides: { taxYear: 2024 as never } })))
      .includes("UNSUPPORTED_TAX_YEAR"),
  );
  assert.ok(
    codes(validateTaxReturn(syntheticReturn({ overrides: { province: "BC" as never } })))
      .includes("UNSUPPORTED_PROVINCE"),
  );
});

test("a return whose province and residency disagree is refused", () => {
  const issues = validateTaxReturn(
    syntheticReturn({
      overrides: {
        residency: {
          provinceAtYearEnd: "AB" as never,
          residentInCanadaAtStartOfYear: true,
          residentInOntarioAtYearEnd: true,
          mailingCity: "Sample City",
        },
      },
    }),
  );
  assert.ok(codes(issues).includes("UNSUPPORTED_PROVINCE"));
});

test("Ontario residence at year end is required and cites its official source", () => {
  const issues = validateTaxReturn(
    syntheticReturn({
      overrides: {
        residency: {
          provinceAtYearEnd: "ON",
          residentInCanadaAtStartOfYear: true,
          residentInOntarioAtYearEnd: false,
          mailingCity: "Sample City",
        },
      },
    }),
  );
  const issue = issues.find((entry) => entry.code === "ONTARIO_RESIDENCY_REQUIRED");
  assert.ok(issue);
  assert.equal(issue.severity, "error");
  assert.ok(issue.sourceIds.includes("cra-2025-ontario-tax-information"));
});

test("every unsupported situation is refused individually and names itself", () => {
  // Each of these is a return the ruleset genuinely cannot compute. Reporting
  // one and swallowing the rest would leave a taxpayer fixing them one at a time.
  const situations = [
    "bankruptcy",
    "deceased-return",
    "non-resident",
    "self-employment",
    "rental-income",
    "alternative-minimum-tax",
  ] as const;

  const issues = validateTaxReturn(
    syntheticReturn({ overrides: { unsupportedSituations: situations } }),
  );
  const raised = issues.filter((entry) => entry.code === "UNSUPPORTED_TAX_SITUATION");

  assert.equal(raised.length, situations.length, "each situation must raise its own issue");
  for (const situation of situations) {
    assert.ok(
      raised.some((entry) => entry.message.includes(situation)),
      `the refusal must name ${situation}`,
    );
  }
  assert.ok(raised.every((entry) => entry.severity === "error"));
});

test("a calculation carrying an error is marked blocked", () => {
  const blocked = calculateTaxReturn(
    syntheticReturn({ overrides: { unsupportedSituations: ["self-employment"] } }),
    CALCULATED_AT,
  );
  const clean = calculateTaxReturn(syntheticReturn(), CALCULATED_AT);

  assert.equal(blocked.blocked, true);
  assert.equal(clean.blocked, false, "a review-only issue must not block");
  assert.ok(
    clean.issues.some((entry) => entry.severity === "review"),
    "the clean return still carries its review notice",
  );
});

test("a malformed date of birth is refused", () => {
  for (const dateOfBirth of ["1985-3-14", "14/03/1985", "", "1985-03-14T00:00:00Z"]) {
    const issues = validateTaxReturn(
      syntheticReturn({
        overrides: { taxpayer: { givenName: "Sample", familyName: "Synthetic-Fixture", dateOfBirth } },
      }),
    );
    assert.ok(codes(issues).includes("INVALID_DATE"), `${dateOfBirth || "(empty)"} must be refused`);
  }
});

test("a social insurance number is checked for shape only, and separators are tolerated", () => {
  // The digits below are an obviously fake placeholder, not an issued number.
  const withSin = (socialInsuranceNumber: string) =>
    validateTaxReturn(
      syntheticReturn({
        overrides: {
          taxpayer: {
            givenName: "Sample",
            familyName: "Synthetic-Fixture",
            dateOfBirth: "1985-03-14",
            socialInsuranceNumber,
          },
        },
      }),
    );

  for (const accepted of ["000000000", "000 000 000", "000-000-000"]) {
    assert.ok(
      !codes(withSin(accepted)).includes("INVALID_SIN_FORMAT"),
      `${accepted} should pass the shape check`,
    );
  }
  for (const refused of ["12345678", "1234567890", "abcdefghi", ""]) {
    assert.ok(
      codes(withSin(refused)).includes("INVALID_SIN_FORMAT"),
      `${refused || "(empty)"} must be refused`,
    );
  }
});

test("money must be a non-negative safe integer within the supported bound", () => {
  for (const amount of [1.5, -1, Number.NaN, Number.POSITIVE_INFINITY, 100_000_000_001, 2 ** 53]) {
    const issues = validateTaxReturn(syntheticReturn({ employmentIncome: amount }));
    assert.ok(
      codes(issues).includes("INVALID_MONEY"),
      `${amount} must be refused as an amount in cents`,
    );
  }
  assert.ok(!codes(validateTaxReturn(syntheticReturn({ employmentIncome: 0 }))).includes("INVALID_MONEY"));
});

test("duplicate and malformed record identifiers are refused", () => {
  const duplicated = validateTaxReturn(
    syntheticReturn({
      overrides: {
        t4Slips: [
          { id: "same-id", employerName: "A", box14EmploymentIncome: dollars(1_000) },
          { id: "same-id", employerName: "B", box14EmploymentIncome: dollars(2_000) },
        ],
      },
    }),
  );
  assert.ok(codes(duplicated).includes("DUPLICATE_ID"));

  const blank = validateTaxReturn(
    syntheticReturn({
      overrides: { t4Slips: [{ id: "   ", employerName: "A", box14EmploymentIncome: dollars(1_000) }] },
    }),
  );
  assert.ok(codes(blank).includes("INVALID_ID"));
});

test("a CPP allocation larger than the slip reports is refused", () => {
  // The credit and deduction portions are two halves of one reported figure, so
  // allocating more than the slip carries is arithmetic that cannot be right.
  const issues = validateTaxReturn(
    syntheticReturn({
      overrides: {
        t4Slips: [
          {
            id: "synthetic-t4-1",
            employerName: "Example Synthetic Employer",
            box14EmploymentIncome: dollars(60_000),
            box16CppContributions: dollars(3_000),
            cppBaseContributionCredit: dollars(2_500),
            cppEnhancedContributionDeduction: dollars(1_000),
          },
        ],
      },
    }),
  );
  assert.ok(codes(issues).includes("CPP_ALLOCATION_EXCEEDS_SLIP"));
});

test("a CPP allocation within the slip is accepted", () => {
  const issues = validateTaxReturn(
    syntheticReturn({
      overrides: {
        t4Slips: [
          {
            id: "synthetic-t4-1",
            employerName: "Example Synthetic Employer",
            box14EmploymentIncome: dollars(60_000),
            box16CppContributions: dollars(3_000),
            cppBaseContributionCredit: dollars(2_000),
            cppEnhancedContributionDeduction: dollars(1_000),
          },
        ],
      },
    }),
  );
  assert.ok(!codes(issues).includes("CPP_ALLOCATION_EXCEEDS_SLIP"));
});

test("an unverified deduction or claim is flagged for review rather than dropped", () => {
  const issues = validateTaxReturn(
    syntheticReturn({
      overrides: {
        deductions: [
          {
            id: "d1",
            line: "20700",
            description: "Registered pension plan",
            amount: dollars(1_200),
            verifiedAgainstOfficialWorksheet: false,
          },
        ],
        credits: {
          federalClaims: [
            {
              id: "f1",
              line: "31600",
              description: "Disability amount",
              amount: dollars(9_872),
              verifiedAgainstOfficialWorksheet: false,
            },
          ],
          ontarioClaims: [
            {
              id: "o1",
              line: "58160",
              description: "Eligible dependant",
              amount: dollars(10_823),
              verifiedAgainstOfficialWorksheet: false,
            },
          ],
        },
      },
    }),
  );

  for (const code of [
    "DEDUCTION_REQUIRES_REVIEW",
    "FEDERAL_CLAIM_REQUIRES_REVIEW",
    "ONTARIO_CLAIM_REQUIRES_REVIEW",
  ]) {
    const issue = issues.find((entry) => entry.code === code);
    assert.ok(issue, `${code} must be raised`);
    assert.equal(issue.severity, "review", "an unverified figure is a review item, not an error");
  }
  assert.deepEqual(errorsOf(issues), [], "review items must not block the calculation");
});

test("a duplicated union-dues or CPP deduction is warned about, not silently doubled", () => {
  const issues = validateTaxReturn(
    syntheticReturn({
      overrides: {
        t4Slips: [
          {
            id: "synthetic-t4-1",
            employerName: "Example Synthetic Employer",
            box14EmploymentIncome: dollars(60_000),
            box44UnionDues: dollars(500),
            box16CppContributions: dollars(3_000),
            cppEnhancedContributionDeduction: dollars(600),
          },
        ],
        deductions: [
          {
            id: "d1",
            line: "21200",
            description: "Union dues",
            amount: dollars(500),
            verifiedAgainstOfficialWorksheet: true,
          },
          {
            id: "d2",
            line: "22215",
            description: "Enhanced CPP",
            amount: dollars(600),
            verifiedAgainstOfficialWorksheet: true,
          },
        ],
      },
    }),
  );

  const raised = codes(issues);
  assert.ok(raised.includes("POSSIBLE_DUPLICATE_UNION_DUES"));
  assert.ok(raised.includes("POSSIBLE_DUPLICATE_CPP_DEDUCTION"));
  assert.ok(
    issues
      .filter((entry) => entry.code.startsWith("POSSIBLE_DUPLICATE"))
      .every((entry) => entry.severity === "warning"),
  );
});

test("a donation allocated to the top rate beyond the eligible amount is refused", () => {
  const issues = validateTaxReturn(
    syntheticReturn({
      overrides: {
        credits: {
          federalClaims: [],
          ontarioClaims: [],
          donations: { eligibleAmount: dollars(500), amountEligibleFor33PercentRate: dollars(900) },
        },
      },
    }),
  );
  assert.ok(codes(issues).includes("INVALID_DONATION_RATE_ALLOCATION"));
});

test("a medical period outside 2025 and a duplicated medical claim are refused", () => {
  const badPeriod = validateTaxReturn(
    syntheticReturn({
      overrides: {
        credits: {
          federalClaims: [],
          ontarioClaims: [],
          medical: {
            eligibleExpensesForSelfSpouseAndMinorChildren: dollars(3_000),
            chosenPeriodEnding: "2024-12-31",
          },
        },
      },
    }),
  );
  assert.ok(codes(badPeriod).includes("INVALID_MEDICAL_PERIOD"));

  const doubled = validateTaxReturn(
    syntheticReturn({
      overrides: {
        credits: {
          federalClaims: [
            {
              id: "f1",
              line: "33099",
              description: "Medical expenses",
              amount: dollars(3_000),
              verifiedAgainstOfficialWorksheet: true,
            },
          ],
          ontarioClaims: [],
          medical: {
            eligibleExpensesForSelfSpouseAndMinorChildren: dollars(3_000),
            chosenPeriodEnding: "2025-12-31",
          },
        },
      },
    }),
  );
  assert.ok(codes(doubled).includes("DUPLICATE_MEDICAL_INPUT"));
});

test("a negative or fractional dependant count is refused", () => {
  for (const count of [-1, 1.5, Number.NaN]) {
    const issues = validateTaxReturn(
      syntheticReturn({
        overrides: {
          ontarioTaxReduction: {
            dependentChildrenUnder18: count,
            dependantsWithDisability: 0,
            eligible: true,
          },
        },
      }),
    );
    assert.ok(codes(issues).includes("INVALID_DEPENDANT_COUNT"), `${count} must be refused`);
  }
});

test("every result carries the mail-only product boundary in its disclaimers", () => {
  // The one thing this package must never imply. Asserted on the shipped result
  // rather than on a constant, because a caller reads the result.
  const result = calculateTaxReturn(syntheticReturn(), CALCULATED_AT);
  const disclaimers = result.disclaimers.join(" ");

  for (const prohibited of [
    "NETFILE",
    "EFILE",
    "electronic submission",
    "direct CRA transmission",
    "simulated filing",
    "automatic filing",
  ]) {
    assert.ok(disclaimers.includes(prohibited), `the disclaimers must disclaim ${prohibited}`);
  }
  assert.ok(disclaimers.includes("mail-in PDF package"));
  assert.ok(disclaimers.includes("manual review"));
  assert.ok(disclaimers.includes("not CRA-certified") || disclaimers.includes("Not CRA-certified"));
  assert.ok(result.sourceIds.length > 0, "a result must cite the sources it was computed from");
});

test("a result reports the tax year, province, and the timestamp it was given", () => {
  const result = calculateTaxReturn(syntheticReturn(), CALCULATED_AT);
  assert.equal(result.schemaVersion, "canada-annual-personal-tax-result/1");
  assert.equal(result.taxYear, 2025);
  assert.equal(result.province, "ON");
  assert.equal(result.calculatedAt, CALCULATED_AT);
});
