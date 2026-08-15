import test from "node:test";
import { useTypeScriptSources } from "./typescript-source-resolver.ts";
useTypeScriptSources();
const { TAX_YEAR_2025_RULES } = await import("../src/rules.ts");
const { calculateTaxReturn } = await import("../src/calculate.ts");

function at(cents: number): any {
  return calculateTaxReturn({
    schemaVersion: "canada-annual-personal-tax/1", taxYear: 2025, province: "ON",
    taxpayer: { givenName: "A", familyName: "B", dateOfBirth: "1980-01-01" },
    residency: { provinceAtYearEnd: "ON", residentInCanadaAtStartOfYear: true, residentInOntarioAtYearEnd: true, mailingCity: "Toronto" },
    t4Slips: [{ id: "t4-1", employerName: "E", box14EmploymentIncome: cents }],
    t4aSlips: [], t5Slips: [], otherIncome: [], deductions: [],
    credits: { federalClaims: [], ontarioClaims: [] },
    ontarioTaxReduction: { dependentChildrenUnder18: 0, dependantsWithDisability: 0, eligible: false },
    carryForwards: {}, unsupportedSituations: [],
  } as any, "2026-01-01T00:00:00.000Z");
}

test("federal bracket seams", () => {
  for (const b of TAX_YEAR_2025_RULES.federalBrackets) {
    if (b.upperBound === null) continue;
    const lo = at(b.upperBound).federalTax, hi = at(b.upperBound + 1).federalTax;
    console.log(`FED boundary ${b.upperBound}: at=${lo} at+1=${hi} delta=${hi - lo}${hi < lo ? "  <<< DECREASES" : ""}`);
  }
});

test("ontario bracket seams", () => {
  for (const b of TAX_YEAR_2025_RULES.ontarioBrackets) {
    if (b.upperBound === null) continue;
    const lo = at(b.upperBound).ontarioTax, hi = at(b.upperBound + 1).ontarioTax;
    console.log(`ONT boundary ${b.upperBound}: at=${lo} at+1=${hi} delta=${hi - lo}${hi < lo ? "  <<< DECREASES" : ""}`);
  }
});
