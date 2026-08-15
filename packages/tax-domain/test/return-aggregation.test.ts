/**
 * How slips, deductions, and withholding become the figures on the return.
 *
 * These tests cover the assembly rather than the rates: which slip box lands on
 * which line, which deductions reduce net income and which reduce taxable
 * income, how withholding turns a balance owing into a refund, and what happens
 * to a donation the year cannot absorb.
 *
 * Tax year: 2025. All fixtures are synthetic.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { CALCULATED_AT, dollars, syntheticReturn } from "./synthetic-return.ts";
import { useTypeScriptSources } from "./typescript-source-resolver.ts";

useTypeScriptSources();

const { calculateTaxReturn } = await import("../src/calculate.ts");

const run = (overrides: Parameters<typeof syntheticReturn>[0] = {}) =>
  calculateTaxReturn(syntheticReturn(overrides), CALCULATED_AT);

const amountOn = (result: ReturnType<typeof run>, line: string): number =>
  result.lines[line]?.amount ?? 0;

test("employment income from every T4 lands on line 10100 and totals on line 15000", () => {
  const result = run({
    overrides: {
      t4Slips: [
        { id: "t4-a", employerName: "First", box14EmploymentIncome: dollars(30_000) },
        { id: "t4-b", employerName: "Second", box14EmploymentIncome: dollars(21_500) },
      ],
    },
  });

  assert.equal(amountOn(result, "10100"), dollars(51_500), "two slips accumulate on one line");
  assert.equal(result.totalIncome, dollars(51_500));
  assert.equal(amountOn(result, "15000"), result.totalIncome);
});

test("T5 interest and both kinds of taxable dividend reach their own lines", () => {
  const result = run({
    employmentIncome: dollars(40_000),
    overrides: {
      t5Slips: [
        {
          id: "t5-a",
          payerName: "Example Bank",
          box13Interest: dollars(1_200),
          box25TaxableEligibleDividends: dollars(2_000),
          box15TaxableOtherThanEligibleDividends: dollars(500),
        },
      ],
    },
  });

  assert.equal(amountOn(result, "12100"), dollars(1_200), "interest is its own line");
  assert.equal(
    amountOn(result, "12000"),
    dollars(2_500),
    "both taxable dividend kinds are summed onto the dividend line",
  );
  assert.equal(result.totalIncome, dollars(40_000) + dollars(1_200) + dollars(2_500));
});

test("T4A and other income are placed on the lines they declare", () => {
  const result = run({
    employmentIncome: dollars(10_000),
    overrides: {
      t4aSlips: [
        {
          id: "t4a-a",
          payerName: "Example Payer",
          income: [
            { line: "11500", amount: dollars(6_000), description: "Pension income" },
            { line: "13000", amount: dollars(1_500), description: "Other income" },
          ],
        },
      ],
      otherIncome: [
        {
          id: "oi-a",
          line: "11900",
          description: "Employment insurance benefits",
          amount: dollars(2_400),
        },
      ],
    },
  });

  assert.equal(amountOn(result, "11500"), dollars(6_000));
  assert.equal(amountOn(result, "13000"), dollars(1_500));
  assert.equal(amountOn(result, "11900"), dollars(2_400));
  assert.equal(result.totalIncome, dollars(10_000 + 6_000 + 1_500 + 2_400));
});

test("a deduction at or below line 23500 reduces net income", () => {
  const withDeduction = run({
    overrides: {
      deductions: [
        {
          id: "d1",
          line: "20700",
          description: "Registered pension plan",
          amount: dollars(4_000),
          verifiedAgainstOfficialWorksheet: true,
        },
      ],
    },
  });

  assert.equal(withDeduction.totalIncome, dollars(80_000));
  assert.equal(withDeduction.netIncome, dollars(76_000));
  assert.equal(withDeduction.taxableIncome, dollars(76_000));
  assert.equal(amountOn(withDeduction, "23600"), withDeduction.netIncome);
  assert.equal(amountOn(withDeduction, "26000"), withDeduction.taxableIncome);
});

test("a deduction at or above line 24400 reduces taxable income but not net income", () => {
  // The distinction matters: net income is what the personal-amount phase-out
  // and the medical threshold are measured against, so a deduction applied to
  // the wrong one of the two quietly changes a credit as well as the tax.
  const result = run({
    overrides: {
      deductions: [
        {
          id: "d1",
          line: "25300",
          description: "Capital gains deduction",
          amount: dollars(5_000),
          verifiedAgainstOfficialWorksheet: true,
        },
      ],
    },
  });

  assert.equal(result.netIncome, dollars(80_000), "net income is untouched");
  assert.equal(result.taxableIncome, dollars(75_000), "taxable income falls");
});

test("union dues and the enhanced CPP deduction are carried off the slip automatically", () => {
  const result = run({
    overrides: {
      t4Slips: [
        {
          id: "t4-a",
          employerName: "Example Synthetic Employer",
          box14EmploymentIncome: dollars(80_000),
          box44UnionDues: dollars(900),
          box16CppContributions: dollars(4_034),
          cppEnhancedContributionDeduction: dollars(1_074),
        },
      ],
    },
  });

  assert.equal(amountOn(result, "21200"), dollars(900), "box 44 reaches the union dues line");
  assert.equal(amountOn(result, "22215"), dollars(1_074), "the enhanced portion reaches its own line");
  assert.equal(result.netIncome, dollars(80_000) - dollars(900) - dollars(1_074));
});

test("income and deductions never drive net or taxable income below zero", () => {
  const result = run({
    employmentIncome: dollars(5_000),
    overrides: {
      deductions: [
        {
          id: "d1",
          line: "20700",
          description: "Oversized deduction",
          amount: dollars(50_000),
          verifiedAgainstOfficialWorksheet: true,
        },
      ],
    },
  });

  assert.equal(result.netIncome, 0);
  assert.equal(result.taxableIncome, 0);
  assert.equal(result.federalTax, 0);
});

test("withholding turns a balance owing into a refund, and never both at once", () => {
  const owing = run({ employmentIncome: dollars(80_000) });
  assert.ok(owing.balanceOwing > 0);
  assert.equal(owing.refund, 0);
  assert.equal(owing.totalCreditsAndWithholding, 0);

  const refunded = run({
    overrides: {
      t4Slips: [
        {
          id: "t4-a",
          employerName: "Example Synthetic Employer",
          box14EmploymentIncome: dollars(80_000),
          box22IncomeTaxDeducted: dollars(25_000),
        },
      ],
    },
  });

  assert.equal(refunded.totalCreditsAndWithholding, dollars(25_000));
  assert.equal(refunded.balanceOwing, 0);
  assert.equal(refunded.refund, dollars(25_000) - refunded.totalPayable);
  assert.ok(refunded.refund > 0);
});

test("balance owing and refund are always the two sides of one figure", () => {
  for (const withheld of [0, dollars(1_000), dollars(15_657), dollars(40_000)]) {
    const result = run({
      overrides: {
        t4Slips: [
          {
            id: "t4-a",
            employerName: "Example Synthetic Employer",
            box14EmploymentIncome: dollars(80_000),
            box22IncomeTaxDeducted: withheld,
          },
        ],
      },
    });

    assert.ok(
      result.balanceOwing === 0 || result.refund === 0,
      "a return owes money or is owed money, never both",
    );
    assert.equal(
      result.balanceOwing - result.refund,
      result.totalPayable - result.totalCreditsAndWithholding,
    );
    assert.ok(result.balanceOwing >= 0 && result.refund >= 0);
  }
});

test("withholding from a T4A counts alongside a T4, and refundable Ontario credits count too", () => {
  const result = run({
    employmentIncome: dollars(50_000),
    overrides: {
      t4Slips: [
        {
          id: "t4-a",
          employerName: "Example Synthetic Employer",
          box14EmploymentIncome: dollars(50_000),
          box22IncomeTaxDeducted: dollars(6_000),
        },
      ],
      t4aSlips: [
        {
          id: "t4a-a",
          payerName: "Example Payer",
          income: [{ line: "11500", amount: dollars(4_000), description: "Pension income" }],
          box22IncomeTaxDeducted: dollars(700),
        },
      ],
      credits: { federalClaims: [], ontarioClaims: [], ontarioRefundableCredits: dollars(300) },
    },
  });

  assert.equal(result.totalCreditsAndWithholding, dollars(6_000) + dollars(700) + dollars(300));
});

test("a donation beyond the 75% net-income limit is carried forward rather than claimed", () => {
  // The limit is a share of net income, so a very large gift in a modest year is
  // partly deferred. What the year cannot use must reappear in the carry-forward
  // rather than vanish.
  const result = run({
    employmentIncome: dollars(40_000),
    overrides: {
      credits: {
        federalClaims: [],
        ontarioClaims: [],
        donations: { eligibleAmount: dollars(35_000) },
      },
    },
  });

  const limit = Math.round(dollars(40_000) * 0.75);
  assert.equal(result.carryForwards.donations, dollars(35_000) - limit);
  assert.ok((result.carryForwards.donations ?? 0) > 0);
});

test("a donation inside the limit is fully claimed and adds nothing to the carry-forward", () => {
  const result = run({
    overrides: {
      credits: {
        federalClaims: [],
        ontarioClaims: [],
        donations: { eligibleAmount: dollars(1_000) },
      },
      carryForwards: { donations: dollars(250) },
    },
  });

  assert.equal(result.carryForwards.donations, dollars(250), "the existing balance is preserved unchanged");
});

test("a donation reduces both federal and Ontario tax", () => {
  const without = run({ employmentIncome: dollars(80_000) });
  const with_ = run({
    employmentIncome: dollars(80_000),
    overrides: {
      credits: {
        federalClaims: [],
        ontarioClaims: [],
        donations: { eligibleAmount: dollars(2_000) },
      },
    },
  });

  assert.ok(with_.federalTax < without.federalTax, "the federal donation credit must apply");
  assert.ok(with_.ontarioTax < without.ontarioTax, "the Ontario donation credit must apply");
});

test("unrelated carry-forward balances survive the calculation untouched", () => {
  const result = run({
    overrides: {
      carryForwards: {
        federalTuition: dollars(4_000),
        ontarioTuition: dollars(3_000),
        capitalLosses: dollars(1_250),
        unusedRrspContributions: dollars(900),
      },
    },
  });

  assert.equal(result.carryForwards.federalTuition, dollars(4_000));
  assert.equal(result.carryForwards.ontarioTuition, dollars(3_000));
  assert.equal(result.carryForwards.capitalLosses, dollars(1_250));
  assert.equal(result.carryForwards.unusedRrspContributions, dollars(900));
});

test("a medical claim above the threshold reduces federal tax and an empty one does not", () => {
  const none = run({ employmentIncome: dollars(80_000) });
  const claimed = run({
    employmentIncome: dollars(80_000),
    overrides: {
      credits: {
        federalClaims: [],
        ontarioClaims: [],
        medical: {
          eligibleExpensesForSelfSpouseAndMinorChildren: dollars(6_000),
          chosenPeriodEnding: "2025-12-31",
        },
      },
    },
  });
  const belowThreshold = run({
    employmentIncome: dollars(80_000),
    overrides: {
      credits: {
        federalClaims: [],
        ontarioClaims: [],
        medical: {
          eligibleExpensesForSelfSpouseAndMinorChildren: dollars(100),
          chosenPeriodEnding: "2025-12-31",
        },
      },
    },
  });

  assert.ok(claimed.federalTax < none.federalTax, "expenses above the threshold produce a credit");
  assert.equal(
    belowThreshold.federalTax,
    none.federalTax,
    "expenses below the threshold produce nothing rather than a negative claim",
  );
});

test("every reported line carries a label and a numeric amount", () => {
  const result = run({
    overrides: {
      t5Slips: [{ id: "t5-a", payerName: "Example Bank", box13Interest: dollars(500) }],
      deductions: [
        {
          id: "d1",
          line: "20700",
          description: "Registered pension plan",
          amount: dollars(1_000),
          verifiedAgainstOfficialWorksheet: true,
        },
      ],
    },
  });

  const entries = Object.entries(result.lines);
  assert.ok(entries.length > 0);
  for (const [key, line] of entries) {
    assert.equal(line.line, key, "a line must be filed under its own number");
    assert.ok(line.label.length > 0, `line ${key} must carry a label`);
    assert.ok(Number.isSafeInteger(line.amount), `line ${key} must report integer cents`);
    assert.ok(Array.isArray(line.sourceIds));
  }
});
