/**
 * Synthetic 2025 tax-return fixtures.
 *
 * Every value here is invented for testing. There is no real taxpayer, no real
 * employer, and deliberately no Social Insurance Number on the default fixture:
 * the identity fields carry obviously fictional placeholders so that nothing in
 * this repository can be mistaken for someone's return. Where a test needs a
 * Social Insurance Number to exercise the format check, it supplies an evidently
 * fake digit string at the call site rather than keeping one here.
 *
 * Tax year: 2025. Province: Ontario. All money is integer Canadian cents.
 */

import type { TaxReturnInput } from "../src/model.ts";

/** Dollars to integer cents, for readable fixtures. */
export const dollars = (amount: number): number => Math.round(amount * 100);

export interface SyntheticOptions {
  readonly employmentIncome?: number;
  readonly overrides?: Partial<TaxReturnInput>;
}

/**
 * A minimal, valid, Ontario-resident 2025 return carrying a single employment
 * slip and nothing else. Tests layer their own facts on top through `overrides`
 * so each one states only what it actually depends on.
 */
export function syntheticReturn({ employmentIncome = dollars(80_000), overrides = {} }: SyntheticOptions = {}): TaxReturnInput {
  return {
    schemaVersion: "canada-annual-personal-tax/1",
    taxYear: 2025,
    province: "ON",
    taxpayer: {
      givenName: "Sample",
      familyName: "Synthetic-Fixture",
      dateOfBirth: "1985-03-14",
    },
    residency: {
      provinceAtYearEnd: "ON",
      residentInCanadaAtStartOfYear: true,
      residentInOntarioAtYearEnd: true,
      mailingCity: "Sample City",
    },
    t4Slips: [
      {
        id: "synthetic-t4-1",
        employerName: "Example Synthetic Employer",
        box14EmploymentIncome: employmentIncome,
      },
    ],
    t4aSlips: [],
    t5Slips: [],
    otherIncome: [],
    deductions: [],
    credits: {
      federalClaims: [],
      ontarioClaims: [],
    },
    ontarioTaxReduction: {
      dependentChildrenUnder18: 0,
      dependantsWithDisability: 0,
      eligible: false,
    },
    carryForwards: {},
    unsupportedSituations: [],
    ...overrides,
  };
}

/** A fixed timestamp, so a result is compared on its figures rather than on the clock. */
export const CALCULATED_AT = "2026-04-30T12:00:00.000Z";
