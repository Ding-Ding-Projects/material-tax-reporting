/**
 * The 2025 federal and Ontario calculation, checked against an independent
 * reference model built from the committed research rather than from this
 * package's own tables.
 *
 * The reference below re-implements the official chain — pick the band, add the
 * printed base tax, charge the rate on the excess — reading its brackets,
 * personal amounts, surtax thresholds and premium bands straight out of
 * `research/rates-calculation/`. That makes it a second opinion rather than a
 * restatement: an error in `rules.ts` or in `calculate.ts` shows up as a
 * disagreement, because the two sides never share a number.
 *
 * Tax year: 2025. Province: Ontario. All money is integer Canadian cents.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { CALCULATED_AT, dollars, syntheticReturn } from "./synthetic-return.ts";
import { useTypeScriptSources } from "./typescript-source-resolver.ts";

useTypeScriptSources();

const { calculateTaxReturn } = await import("../src/calculate.ts");

const researchPath = (name: string): string =>
  fileURLToPath(new URL(`../../../research/rates-calculation/${name}`, import.meta.url));
const FEDERAL = JSON.parse(readFileSync(researchPath("federal-2025.parameters.json"), "utf8"));
const ONTARIO = JSON.parse(readFileSync(researchPath("ontario-2025.parameters.json"), "utf8"));

const cents = (amount: string | number): number => Math.round(Number(amount) * 100);

/**
 * The rounding convention the research prescribes for this implementation:
 * "Store Canadian cents as integers, rates as exact rational fractions, and
 * round each non-negative multiplication to the nearest cent with half-cent
 * values upward." Both parameter files state it in identical words.
 *
 * The fraction is recovered from the decimal the research prints, by its own
 * number of decimal places, so the reference reaches the same exact rational
 * the rules table stores without reading that table. Doing this in floating
 * point instead would disagree by a cent at the largest bracket, which is a
 * defect in the reference rather than in the package: `0.33` is not exactly
 * representable, and a taxable income of a quarter of a million dollars is
 * large enough for the error to cross a cent boundary.
 */
const rateFraction = (rate: string | number): { numerator: number; denominator: number } => {
  const text = String(rate);
  const dot = text.indexOf(".");
  const denominator = 10 ** (dot === -1 ? 0 : text.length - dot - 1);
  return { numerator: Math.round(Number(text) * denominator), denominator };
};

const chargeRate = (amount: number, rate: string | number): number => {
  const { numerator, denominator } = rateFraction(rate);
  return Math.floor((amount * numerator + denominator / 2) / denominator);
};

interface ReferenceBracket {
  readonly floor: number;
  readonly ceiling: number | null;
  readonly rate: number;
  readonly baseTax: number;
}

const toReferenceBrackets = (raw: readonly Record<string, unknown>[]): ReferenceBracket[] =>
  raw.map((entry) => ({
    floor: cents(entry.baseIncome as string | number),
    ceiling: entry.upperInclusive === null ? null : cents(entry.upperInclusive as string | number),
    rate: Number(entry.rate),
    baseTax: cents(entry.baseTax as string | number),
  }));

const FEDERAL_BRACKETS = toReferenceBrackets(FEDERAL.federalTax.brackets);
const ONTARIO_BRACKETS = toReferenceBrackets(ONTARIO.taxOnTaxableIncome.brackets);

/** The official band selection: the first band whose inclusive ceiling the income does not exceed. */
function referenceProgressiveTax(taxableIncome: number, brackets: readonly ReferenceBracket[]): number {
  for (const bracket of brackets) {
    if (bracket.ceiling === null || taxableIncome <= bracket.ceiling) {
      return bracket.baseTax + chargeRate(Math.max(0, taxableIncome - bracket.floor), bracket.rate);
    }
  }
  throw new RangeError("reference bracket table has no terminal band");
}

const BPA = FEDERAL.basicPersonalAmount;
const BPA_MAX = cents(BPA.amountAtOrBelowNetIncome.amount);
const BPA_MIN = cents(BPA.amountAtOrAboveNetIncome.amount);
const BPA_PHASE_START = cents(BPA.amountAtOrBelowNetIncome.threshold);
const BPA_PHASE_END = cents(BPA.amountAtOrAboveNetIncome.threshold);

function referenceBasicPersonalAmount(netIncome: number): number {
  if (netIncome <= BPA_PHASE_START) return BPA_MAX;
  if (netIncome >= BPA_PHASE_END) return BPA_MIN;
  const taper = ((netIncome - BPA_PHASE_START) * (BPA_MAX - BPA_MIN)) / (BPA_PHASE_END - BPA_PHASE_START);
  return Math.round(BPA_MAX - taper);
}

const EMPLOYMENT_AMOUNT_MAX = cents(
  FEDERAL.listedConstants.find((entry: { name: string }) => entry.name === "Canada employment amount").maximum,
);
const FEDERAL_CREDIT_RATE = Number(FEDERAL.federalTax.creditRate);
const ONTARIO_CREDIT_RATE = Number(ONTARIO.nonRefundableCredits.creditRate);
const ONTARIO_BPA = cents(
  ONTARIO.nonRefundableCredits.amounts.find((entry: { line: string }) => entry.line === "58040").amount,
);
const TOP_UP_THRESHOLD = cents(FEDERAL.topUpTaxCredit.threshold);
const TOP_UP_RATE = Number(FEDERAL.topUpTaxCredit.rate);

const [SURTAX_FIRST, SURTAX_SECOND] = ONTARIO.surtax.components as readonly {
  threshold: number;
  rate: number;
}[];

/** The plateau-and-ramp premium table, evaluated straight from the researched formulas. */
function referenceHealthPremium(taxableIncome: number): number {
  for (const band of ONTARIO.ontarioHealthPremium.bands as readonly {
    upperInclusive: number | null;
    amountFormula: string;
  }[]) {
    if (band.upperInclusive !== null && taxableIncome > cents(band.upperInclusive)) continue;
    const ramp = /^(?:(\d+) \+ )?\(taxableIncome - (\d+)\) \* ([\d.]+)$/.exec(band.amountFormula);
    if (ramp === null) return cents(Number(band.amountFormula));
    const [, base = "0", floor, rate] = ramp;
    return cents(base) + chargeRate(Math.max(0, taxableIncome - cents(floor)), rate);
  }
  throw new RangeError("reference premium table has no terminal band");
}

/**
 * The whole federal and Ontario chain for the simplest real case: one employment
 * slip, no deductions, no claims, no donations, no dependants. Every downstream
 * quantity is derived, so this models the calculation rather than echoing it.
 */
function referenceTaxes(employmentIncome: number): { federal: number; ontario: number } {
  const taxableIncome = employmentIncome;

  const federalCreditBase =
    referenceBasicPersonalAmount(taxableIncome) + Math.min(employmentIncome, EMPLOYMENT_AMOUNT_MAX);
  const federalCredit = chargeRate(federalCreditBase, FEDERAL_CREDIT_RATE);
  const topUp = chargeRate(Math.max(0, federalCredit - TOP_UP_THRESHOLD), TOP_UP_RATE);
  const federal = Math.max(
    0,
    referenceProgressiveTax(taxableIncome, FEDERAL_BRACKETS) - federalCredit - topUp,
  );

  const ontarioCredit = chargeRate(ONTARIO_BPA, ONTARIO_CREDIT_RATE);
  const basicOntarioTax = Math.max(
    0,
    referenceProgressiveTax(taxableIncome, ONTARIO_BRACKETS) - ontarioCredit,
  );
  const surtax =
    chargeRate(Math.max(0, basicOntarioTax - cents(SURTAX_FIRST.threshold)), SURTAX_FIRST.rate) +
    chargeRate(Math.max(0, basicOntarioTax - cents(SURTAX_SECOND.threshold)), SURTAX_SECOND.rate);

  return { federal, ontario: basicOntarioTax + surtax + referenceHealthPremium(taxableIncome) };
}

const taxesAt = (employmentIncome: number) => {
  const result = calculateTaxReturn(syntheticReturn({ employmentIncome }), CALCULATED_AT);
  return { federal: result.federalTax, ontario: result.ontarioTax, result };
};

/**
 * Incomes worth checking: every federal and Ontario bracket edge and the cent
 * either side of it, every health-premium band edge, the personal-amount
 * phase-out edges, and a spread of ordinary salaries in between.
 */
const SAMPLE_INCOMES: readonly number[] = [
  ...new Set(
    [
      0,
      dollars(1),
      dollars(1_470),
      dollars(1_471),
      dollars(15_000),
      dollars(20_000),
      dollars(25_000),
      dollars(36_000),
      dollars(38_500),
      dollars(48_000),
      dollars(48_600),
      dollars(52_886),
      dollars(57_375),
      dollars(72_000),
      dollars(72_600),
      dollars(80_000),
      dollars(105_775),
      dollars(114_750),
      dollars(150_000),
      dollars(177_882),
      dollars(200_000),
      dollars(200_600),
      dollars(220_000),
      dollars(253_414),
      dollars(400_000),
      dollars(1_000_000),
    ].flatMap((income) => (income === 0 ? [0] : [income - 1, income, income + 1])),
  ),
].sort((a, b) => a - b);

test("federal tax matches the independent reference at every sampled income", () => {
  for (const income of SAMPLE_INCOMES) {
    assert.equal(
      taxesAt(income).federal,
      referenceTaxes(income).federal,
      `federal tax disagrees with the researched model at taxable income ${income} cents`,
    );
  }
});

test("Ontario tax matches the independent reference at every sampled income", () => {
  for (const income of SAMPLE_INCOMES) {
    assert.equal(
      taxesAt(income).ontario,
      referenceTaxes(income).ontario,
      `Ontario tax disagrees with the researched model at taxable income ${income} cents`,
    );
  }
});

test("a worked $80,000 case produces the figures the official chain gives", () => {
  // Pinned independently of the reference model above, so an error common to
  // both the package and the reference would still have to survive arithmetic
  // done by hand from the printed constants:
  //   federal band 2   8319.38 + (80000.00 - 57375.00) x 0.205  = 12957.51
  //   federal credit   (16129.00 + 1471.00) x 0.145             =  2552.00
  //   federal tax      12957.51 - 2552.00                       = 10405.51
  //   Ontario band 2   2670.74 + (80000.00 - 52886.00) x 0.0915 =  5151.67
  //   Ontario credit   12747.00 x 0.0505                        =   643.72
  //   Ontario basic    5151.67 - 643.72                         =  4507.95
  //   surtax           below both thresholds                    =     0.00
  //   health premium   plateau band above 72600.00              =   750.00
  //   Ontario tax      4507.95 + 750.00                         =  5257.95
  const { federal, ontario, result } = taxesAt(dollars(80_000));

  assert.equal(federal, dollars(10_405.51));
  assert.equal(ontario, dollars(5_257.95));
  assert.equal(result.totalPayable, dollars(10_405.51) + dollars(5_257.95));
  assert.equal(result.taxableIncome, dollars(80_000));
  assert.equal(result.lines["40400"]?.amount, federal);
  assert.equal(result.lines["42800"]?.amount, ontario);
});

test("income inside the lowest federal band is fully sheltered by the personal amounts", () => {
  // The basic personal amount plus the employment amount shelter well above
  // $17,000, so a small income must produce no federal tax at all rather than a
  // negative number dressed up as a refund.
  const { federal, result } = taxesAt(dollars(15_000));
  assert.equal(federal, 0);
  assert.equal(result.lines["40400"]?.amount, 0);
  assert.ok(result.balanceOwing >= 0);
  assert.ok(result.refund >= 0);
});

test("the basic personal amount holds, tapers, then floors across the phase-out", () => {
  const below = calculateTaxReturn(syntheticReturn({ employmentIncome: dollars(177_882) }), CALCULATED_AT);
  const above = calculateTaxReturn(syntheticReturn({ employmentIncome: dollars(253_414) }), CALCULATED_AT);
  const middle = calculateTaxReturn(
    syntheticReturn({ employmentIncome: dollars(177_882) + (dollars(253_414) - dollars(177_882)) / 2 }),
    CALCULATED_AT,
  );

  assert.equal(below.lines["30000"]?.amount, dollars(16_129), "at the phase-out start the full amount is kept");
  assert.equal(above.lines["30000"]?.amount, dollars(14_538), "at the phase-out end the minimum applies");
  assert.equal(
    middle.lines["30000"]?.amount,
    dollars(14_538) + (dollars(16_129) - dollars(14_538)) / 2,
    "halfway through the phase-out exactly half the supplement remains",
  );

  // Beyond the phase-out the amount must stop falling rather than continue down.
  const wellAbove = calculateTaxReturn(syntheticReturn({ employmentIncome: dollars(1_000_000) }), CALCULATED_AT);
  assert.equal(wellAbove.lines["30000"]?.amount, dollars(14_538));
});

test("the Canada employment amount is capped at its researched maximum", () => {
  const under = calculateTaxReturn(syntheticReturn({ employmentIncome: dollars(1_000) }), CALCULATED_AT);
  const over = calculateTaxReturn(syntheticReturn({ employmentIncome: dollars(90_000) }), CALCULATED_AT);

  assert.equal(under.lines["31260"]?.amount, dollars(1_000), "below the cap the claim is the income itself");
  assert.equal(over.lines["31260"]?.amount, dollars(1_471), "above the cap the claim stops at 1471.00");
  assert.equal(over.lines["31260"]?.amount, EMPLOYMENT_AMOUNT_MAX);
});

test("both Ontario surtax components apply together rather than replacing one another", () => {
  // The research calls this out as an important boundary: the 36% component is
  // additive, not a higher band that supersedes the 20% one. An implementation
  // that switched between them would undercharge every high income.
  const high = calculateTaxReturn(syntheticReturn({ employmentIncome: dollars(400_000) }), CALCULATED_AT);
  const surtax = high.lines["ON-SURTAX"]?.amount ?? 0;
  const basicOntarioTax = (high.ontarioTax - surtax - (high.lines["ON-HEALTH-PREMIUM"]?.amount ?? 0));

  const first = Math.floor(Math.max(0, basicOntarioTax - cents(SURTAX_FIRST.threshold)) * SURTAX_FIRST.rate + 0.5);
  const second = Math.floor(Math.max(0, basicOntarioTax - cents(SURTAX_SECOND.threshold)) * SURTAX_SECOND.rate + 0.5);

  assert.ok(first > 0 && second > 0, "this income must be above both surtax thresholds");
  assert.equal(surtax, first + second, "the two components must be summed");
  assert.notEqual(surtax, second, "the 36% component alone would undercharge");
});

test("no surtax applies below the first threshold", () => {
  const modest = calculateTaxReturn(syntheticReturn({ employmentIncome: dollars(60_000) }), CALCULATED_AT);
  assert.equal(modest.lines["ON-SURTAX"]?.amount, 0);
});

test("the Ontario health premium follows its plateaus and ramps exactly", () => {
  // Sampled at the researched band edges. The premium is flat across a plateau
  // and climbs only inside the short ramps, so a table read as ordinary marginal
  // brackets would be wrong almost everywhere.
  const expected: readonly [number, number][] = [
    [dollars(20_000), dollars(0)],
    [dollars(25_000), dollars(300)],
    [dollars(30_000), dollars(300)],
    [dollars(36_000), dollars(300)],
    [dollars(38_500), dollars(450)],
    [dollars(48_000), dollars(450)],
    [dollars(48_600), dollars(600)],
    [dollars(72_000), dollars(600)],
    [dollars(72_600), dollars(750)],
    [dollars(200_000), dollars(750)],
    [dollars(200_600), dollars(900)],
    [dollars(500_000), dollars(900)],
  ];

  for (const [taxableIncome, premium] of expected) {
    const result = calculateTaxReturn(syntheticReturn({ employmentIncome: taxableIncome }), CALCULATED_AT);
    assert.equal(
      result.lines["ON-HEALTH-PREMIUM"]?.amount,
      premium,
      `health premium at taxable income ${taxableIncome} cents`,
    );
  }
});

test("the health premium never decreases as income rises", () => {
  let previous = 0;
  for (let income = 0; income <= dollars(210_000); income += dollars(100)) {
    const premium =
      calculateTaxReturn(syntheticReturn({ employmentIncome: income }), CALCULATED_AT).lines[
        "ON-HEALTH-PREMIUM"
      ]?.amount ?? 0;
    assert.ok(premium >= previous, `premium fell from ${previous} to ${premium} at ${income} cents`);
    previous = premium;
  }
  assert.equal(previous, dollars(900));
});

test("the Ontario tax reduction wipes out a small Ontario tax and never turns negative", () => {
  const eligible = calculateTaxReturn(
    syntheticReturn({
      employmentIncome: dollars(30_000),
      overrides: {
        ontarioTaxReduction: { dependentChildrenUnder18: 2, dependantsWithDisability: 0, eligible: true },
      },
    }),
    CALCULATED_AT,
  );
  const ineligible = calculateTaxReturn(
    syntheticReturn({ employmentIncome: dollars(30_000) }),
    CALCULATED_AT,
  );

  // Two children raise the reduction well past twice the Ontario tax at this
  // income, so the reduction must clamp to the tax rather than overshoot into a
  // refund. What remains is the health premium, which the reduction never touches.
  const premium = eligible.lines["ON-HEALTH-PREMIUM"]?.amount ?? 0;
  assert.equal(eligible.ontarioTax, premium);
  assert.ok(ineligible.ontarioTax > eligible.ontarioTax, "an eligible claimant must pay less");
  assert.ok(eligible.ontarioTax >= 0);
});

test("an ineligible claimant receives no Ontario tax reduction even with dependants", () => {
  const withDependants = calculateTaxReturn(
    syntheticReturn({
      employmentIncome: dollars(30_000),
      overrides: {
        ontarioTaxReduction: { dependentChildrenUnder18: 3, dependantsWithDisability: 2, eligible: false },
      },
    }),
    CALCULATED_AT,
  );
  const without = calculateTaxReturn(syntheticReturn({ employmentIncome: dollars(30_000) }), CALCULATED_AT);
  assert.equal(withDependants.ontarioTax, without.ontarioTax);
});

test("Ontario tax is monotonic at every bracket seam", () => {
  for (const bracket of ONTARIO_BRACKETS) {
    if (bracket.ceiling === null) continue;
    const atEdge = taxesAt(bracket.ceiling).ontario;
    const pastEdge = taxesAt(bracket.ceiling + 1).ontario;
    assert.ok(
      pastEdge >= atEdge,
      `Ontario tax fell from ${atEdge} to ${pastEdge} across the ${bracket.ceiling}-cent seam`,
    );
  }
});

/**
 * KNOWN DEFECT, pinned deliberately.
 *
 * One extra cent of taxable income at the federal $114,750.00 bracket edge
 * produces one cent LESS federal tax. It is not a rounding wobble in the test:
 * the printed base-tax constants come from an unrounded official chain
 * (8319.375 + 11761.875 = 20081.25 exactly), while this implementation rounds
 * each multiplication to the cent as the research's stated convention requires,
 * so tax computed up to the edge reaches 20081.26 while the constant the next
 * band starts from is 20081.25.
 *
 * It is pinned rather than fixed because the fix is a change of rounding
 * convention, and both parameter files require manual review at exactly these
 * fractional-cent boundaries. This test therefore asserts the seam's exact
 * present size and location: it turns red if the seam moves, changes magnitude,
 * appears at another edge, or is corrected. A correction should delete this test
 * and extend the monotonic case below to cover every federal edge.
 */
test("federal tax is monotonic at every bracket seam except the documented 114750.00 one", () => {
  const KNOWN_SEAM = dollars(114_750);

  for (const bracket of FEDERAL_BRACKETS) {
    if (bracket.ceiling === null) continue;
    const atEdge = taxesAt(bracket.ceiling).federal;
    const pastEdge = taxesAt(bracket.ceiling + 1).federal;

    if (bracket.ceiling === KNOWN_SEAM) {
      assert.equal(atEdge - pastEdge, 1, "the documented seam is exactly one cent wide");
      continue;
    }
    assert.ok(
      pastEdge >= atEdge,
      `federal tax fell from ${atEdge} to ${pastEdge} across the ${bracket.ceiling}-cent seam`,
    );
  }
});

test("the documented seam reaches the total a taxpayer actually pays", () => {
  // Nothing downstream absorbs it. Ontario tax does not change across this
  // federal edge, so the one-cent drop survives into `totalPayable` and into the
  // balance owing. This is what makes the seam worth reporting rather than
  // filing away as an internal rounding curiosity.
  const atEdge = taxesAt(dollars(114_750)).result;
  const pastEdge = taxesAt(dollars(114_750) + 1).result;

  assert.equal(atEdge.ontarioTax, pastEdge.ontarioTax, "Ontario tax is unchanged across this edge");
  assert.equal(atEdge.federalTax - pastEdge.federalTax, 1);
  assert.equal(atEdge.totalPayable - pastEdge.totalPayable, 1);
});

test("total payable rises with income everywhere except that one seam", () => {
  const KNOWN_SEAM = dollars(114_750);
  let previous = -1;
  let previousIncome = -1;

  for (const income of SAMPLE_INCOMES) {
    const { result } = taxesAt(income);
    if (previousIncome === KNOWN_SEAM && income === KNOWN_SEAM + 1) {
      assert.equal(previous - result.totalPayable, 1, "the seam is exactly one cent wide");
    } else {
      assert.ok(
        result.totalPayable >= previous,
        `total payable fell to ${result.totalPayable} at ${income} cents`,
      );
    }
    previous = result.totalPayable;
    previousIncome = income;
  }
});
