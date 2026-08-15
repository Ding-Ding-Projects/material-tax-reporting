/**
 * The 2025 ruleset must agree, constant for constant, with the official-source
 * research committed under `research/rates-calculation/`.
 *
 * This is the suite that makes a wrong rate visible. Everything else in this
 * package can be correct while a single mistyped bracket ceiling quietly
 * produces a confidently wrong return, and no amount of testing the arithmetic
 * catches that, because the arithmetic would be faithfully applying the wrong
 * number. So the numbers themselves are asserted against the transcribed
 * parameters rather than against anything remembered or recomputed here.
 *
 * The research files are read from disk on every run. That is deliberate: it
 * makes this an independent channel rather than a second copy of the same
 * belief, so editing either side alone turns the suite red.
 *
 * Tax year: 2025. Jurisdiction: Canada federal and Ontario.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { useTypeScriptSources } from "./typescript-source-resolver.ts";

useTypeScriptSources();

const { TAX_YEAR_2025_RULES, getTaxYearRules, OFFICIAL_SOURCES_2025 } = await import("../src/rules.ts");
type RateFraction = { readonly numerator: number; readonly denominator: number };

const researchPath = (name: string): string =>
  fileURLToPath(new URL(`../../../research/rates-calculation/${name}`, import.meta.url));

const FEDERAL = JSON.parse(readFileSync(researchPath("federal-2025.parameters.json"), "utf8"));
const ONTARIO = JSON.parse(readFileSync(researchPath("ontario-2025.parameters.json"), "utf8"));

/**
 * The research records money as decimal dollars, sometimes as a string and
 * sometimes as a number; the ruleset stores integer cents. Every value involved
 * is far below the point where scaling by 100 loses an integer, so rounding the
 * scaled value recovers the exact cent.
 */
const cents = (dollars: string | number): number => Math.round(Number(dollars) * 100);

/** Compares an exact rational rate against the research's decimal rate without leaving integers. */
const assertRate = (actual: RateFraction, expected: string | number, label: string): void => {
  assert.equal(
    actual.numerator,
    Math.round(Number(expected) * actual.denominator),
    `${label}: rate ${actual.numerator}/${actual.denominator} does not equal the researched ${expected}`,
  );
};

test("the research files describe the 2025 tax year for Ontario", () => {
  // A parameter file that quietly became a different year would make every
  // assertion below meaningless while still passing.
  assert.equal(FEDERAL.taxYear, 2025);
  assert.equal(FEDERAL.jurisdiction, "CA-federal");
  assert.equal(FEDERAL.residentProvinceContext, "ON");
  assert.equal(ONTARIO.taxYear, 2025);
  assert.equal(ONTARIO.jurisdiction.province, "Ontario");
  assert.equal(TAX_YEAR_2025_RULES.year, 2025);
});

test("every federal bracket matches the researched bound, rate, and base tax", () => {
  const researched = FEDERAL.federalTax.brackets;
  assert.equal(TAX_YEAR_2025_RULES.federalBrackets.length, researched.length);

  for (const [index, bracket] of TAX_YEAR_2025_RULES.federalBrackets.entries()) {
    const source = researched[index];
    const label = `federal bracket ${index}`;

    assert.equal(bracket.lowerBound, cents(source.baseIncome), `${label}: lower bound`);
    assert.equal(
      bracket.upperBound,
      source.upperInclusive === null ? null : cents(source.upperInclusive),
      `${label}: upper bound`,
    );
    assert.equal(bracket.baseTax, cents(source.baseTax), `${label}: base tax`);
    assertRate(bracket.rate, source.rate, label);
  }
});

test("the lowest and highest federal bands carry the researched 2025 rates", () => {
  // Named explicitly because these two are the ones a reader checks first, and
  // because 2025 is the split year: the legislated rate changed mid-year and the
  // full-year figure is 14.5%, not the 15% of previous years or the 14% the
  // change moved toward.
  const [lowest] = TAX_YEAR_2025_RULES.federalBrackets;
  const highest = TAX_YEAR_2025_RULES.federalBrackets.at(-1)!;

  assertRate(lowest.rate, "0.145", "lowest federal bracket");
  assert.equal(lowest.lowerBound, 0);
  assert.equal(lowest.baseTax, 0);
  assert.equal(FEDERAL.federalTax.lowestLegislatedRateChange.fullYear2025Rate, "0.145");

  assertRate(highest.rate, "0.33", "highest federal bracket");
  assert.equal(highest.upperBound, null, "the top federal band must be open-ended");
  assert.equal(highest.lowerBound, cents("253414.00"));
});

test("the federal credit rate is the lowest bracket rate", () => {
  assertRate(TAX_YEAR_2025_RULES.federalLowestRate, FEDERAL.federalTax.creditRate, "federal credit rate");
  assert.deepEqual(TAX_YEAR_2025_RULES.federalLowestRate, TAX_YEAR_2025_RULES.federalBrackets[0].rate);
});

test("every Ontario bracket matches the researched bound, rate, and base tax", () => {
  const researched = ONTARIO.taxOnTaxableIncome.brackets;
  assert.equal(TAX_YEAR_2025_RULES.ontarioBrackets.length, researched.length);

  for (const [index, bracket] of TAX_YEAR_2025_RULES.ontarioBrackets.entries()) {
    const source = researched[index];
    const label = `Ontario bracket ${index}`;

    assert.equal(bracket.lowerBound, cents(source.baseIncome), `${label}: lower bound`);
    assert.equal(
      bracket.upperBound,
      source.upperInclusive === null ? null : cents(source.upperInclusive),
      `${label}: upper bound`,
    );
    assert.equal(bracket.baseTax, cents(source.baseTax), `${label}: base tax`);
    assertRate(bracket.rate, source.rate, label);
  }
});

test("the lowest and highest Ontario bands carry the researched 2025 rates", () => {
  const [lowest] = TAX_YEAR_2025_RULES.ontarioBrackets;
  const highest = TAX_YEAR_2025_RULES.ontarioBrackets.at(-1)!;

  assertRate(lowest.rate, 0.0505, "lowest Ontario bracket");
  assert.equal(lowest.lowerBound, 0);
  assert.equal(lowest.baseTax, 0);

  assertRate(highest.rate, 0.1316, "highest Ontario bracket");
  assert.equal(highest.upperBound, null, "the top Ontario band must be open-ended");
  assert.equal(highest.lowerBound, cents(220_000));
});

test("bracket tables are contiguous and ascending in both jurisdictions", () => {
  // A gap or an overlap between bands is not something a spot-check of two
  // brackets would reveal, and either one silently mistaxes a whole income range.
  for (const [name, brackets] of [
    ["federal", TAX_YEAR_2025_RULES.federalBrackets],
    ["Ontario", TAX_YEAR_2025_RULES.ontarioBrackets],
  ] as const) {
    for (const [index, bracket] of brackets.entries()) {
      if (index === 0) continue;
      const previous = brackets[index - 1];
      assert.equal(
        bracket.lowerBound,
        previous.upperBound,
        `${name} bracket ${index} must begin exactly where bracket ${index - 1} ends`,
      );
      assert.ok(
        bracket.rate.numerator / bracket.rate.denominator >
          previous.rate.numerator / previous.rate.denominator,
        `${name} bracket ${index} must carry a higher rate than bracket ${index - 1}`,
      );
    }
  }
});

test("the federal basic personal amount matches the researched phase-out", () => {
  const bpa = TAX_YEAR_2025_RULES.federalBasicPersonalAmount;
  const research = FEDERAL.basicPersonalAmount;

  assert.equal(bpa.maximum, cents(research.amountAtOrBelowNetIncome.amount));
  assert.equal(bpa.phaseOutStarts, cents(research.amountAtOrBelowNetIncome.threshold));
  assert.equal(bpa.minimum, cents(research.amountAtOrAboveNetIncome.amount));
  assert.equal(bpa.phaseOutEnds, cents(research.amountAtOrAboveNetIncome.threshold));

  // The researched formula phrases the same band as a base plus a supplement
  // that tapers over a stated width. Both spellings must describe one band.
  assert.equal(bpa.minimum, cents(research.betweenThresholds.baseAmount));
  assert.equal(bpa.maximum, cents(research.betweenThresholds.maximum));
  assert.equal(bpa.maximum - bpa.minimum, cents(research.betweenThresholds.supplementAmount));
  assert.equal(bpa.phaseOutEnds - bpa.phaseOutStarts, cents(research.betweenThresholds.phaseOutWidth));
});

test("the basic personal amount phase-out spans the fourth federal bracket exactly", () => {
  // The phase-out is defined to run across one whole bracket. If either the
  // bracket or the phase-out moved independently, this is what would notice.
  const bpa = TAX_YEAR_2025_RULES.federalBasicPersonalAmount;
  const fourth = TAX_YEAR_2025_RULES.federalBrackets[3];
  assert.equal(bpa.phaseOutStarts, fourth.lowerBound);
  assert.equal(bpa.phaseOutEnds, fourth.upperBound);
});

test("the top-up tax credit matches the researched threshold and rate", () => {
  assert.equal(TAX_YEAR_2025_RULES.federalTopUpTaxCredit.threshold, cents(FEDERAL.topUpTaxCredit.threshold));
  assertRate(TAX_YEAR_2025_RULES.federalTopUpTaxCredit.rate, FEDERAL.topUpTaxCredit.rate, "top-up tax credit");

  // The researched threshold is the second bracket's base tax; the ruleset must
  // not have drifted into carrying two different numbers for one quantity.
  assert.equal(TAX_YEAR_2025_RULES.federalTopUpTaxCredit.threshold, TAX_YEAR_2025_RULES.federalBrackets[1].baseTax);
});

test("the Canada employment amount and medical threshold match their researched constants", () => {
  const listed = (name: string) =>
    FEDERAL.listedConstants.find((entry: { name: string }) => entry.name === name);

  assert.equal(
    TAX_YEAR_2025_RULES.canadaEmploymentAmountMaximum,
    cents(listed("Canada employment amount").maximum),
  );

  const medical = listed("medical expense threshold");
  assert.equal(TAX_YEAR_2025_RULES.federalMedicalThresholdMaximum, cents(medical.fixedMaximum));
  assert.equal(medical.incomeRate, "0.03", "the calculation applies a 3% income test alongside the fixed cap");
});

test("the Ontario basic personal amount and credit rate match Form ON428", () => {
  const basic = ONTARIO.nonRefundableCredits.amounts.find(
    (entry: { line: string }) => entry.line === "58040",
  );
  assert.equal(basic.name, "Basic personal amount");
  assert.equal(TAX_YEAR_2025_RULES.ontarioBasicPersonalAmount, cents(basic.amount));

  assertRate(TAX_YEAR_2025_RULES.ontarioLowestRate, ONTARIO.nonRefundableCredits.creditRate, "Ontario credit rate");
  assert.deepEqual(TAX_YEAR_2025_RULES.ontarioLowestRate, TAX_YEAR_2025_RULES.ontarioBrackets[0].rate);
});

test("both Ontario surtax components match their researched thresholds and rates", () => {
  const [first, second] = ONTARIO.surtax.components;
  const surtax = TAX_YEAR_2025_RULES.ontarioSurtax;

  assert.equal(surtax.firstThreshold, cents(first.threshold));
  assertRate(surtax.firstRate, first.rate, "Ontario first surtax");
  assert.equal(surtax.secondThreshold, cents(second.threshold));
  assertRate(surtax.secondRate, second.rate, "Ontario second surtax");

  assert.ok(
    surtax.secondThreshold > surtax.firstThreshold,
    "the 36% component must begin above the 20% component",
  );
});

test("the Ontario tax reduction amounts match Form ON428", () => {
  const reduction = TAX_YEAR_2025_RULES.ontarioTaxReduction;
  assert.equal(reduction.basic, cents(ONTARIO.ontarioTaxReduction.basicReductionAmount));
  assert.equal(
    reduction.childUnder18,
    cents(ONTARIO.ontarioTaxReduction.additionalReductionPerEligibleDependant),
  );
  assert.equal(
    reduction.dependantWithDisability,
    cents(ONTARIO.ontarioTaxReduction.additionalReductionPerEligibleDependant),
  );
});

test("every Ontario health premium band matches the researched piecewise table", () => {
  // The premium is a plateau-and-ramp table rather than a marginal bracket, so
  // each band is checked as its own shape: where it ends, what it starts from,
  // what it charges on, and at what rate.
  const researched = ONTARIO.ontarioHealthPremium.bands;
  const bands = TAX_YEAR_2025_RULES.ontarioHealthPremium;
  assert.equal(bands.length, researched.length);

  for (const [index, band] of bands.entries()) {
    const source = researched[index];
    const label = `health premium band ${index} (${source.amountFormula})`;

    assert.equal(
      band.upperBound,
      source.upperInclusive === null ? null : cents(source.upperInclusive),
      `${label}: upper bound`,
    );

    // A flat band states a bare amount. A ramp states "(income - floor) * rate",
    // optionally carrying the plateau it builds on as a "base + " prefix; the
    // first ramp starts from nothing and so states no base at all.
    const ramp = /^(?:(\d+) \+ )?\(taxableIncome - (\d+)\) \* ([\d.]+)$/.exec(source.amountFormula);
    if (ramp === null) {
      const flat = Number(source.amountFormula);
      assert.ok(Number.isFinite(flat), `${label}: expected a flat amount or a ramp formula`);
      assert.equal(band.baseAmount, cents(flat), `${label}: flat amount`);
      assert.equal(band.excessOver, null, `${label}: a flat band charges on no excess`);
      assert.equal(band.rate.numerator, 0, `${label}: a flat band charges at no rate`);
      continue;
    }

    const [, base = "0", floor, rate] = ramp;
    assert.equal(band.baseAmount, cents(base), `${label}: ramp base amount`);
    assert.equal(band.excessOver, cents(floor), `${label}: ramp floor`);
    assertRate(band.rate, rate, label);
  }
});

test("the health premium never exceeds the researched maximum", () => {
  const top = TAX_YEAR_2025_RULES.ontarioHealthPremium.at(-1)!;
  assert.equal(top.upperBound, null, "the premium table must have a terminal band");
  assert.equal(top.baseAmount, cents(900));
  assert.equal(top.rate.numerator, 0, "the terminal band is a plateau, not an open-ended charge");
});

test("donation rates reuse rates the research does state, and the 29% band is flagged as unbacked", () => {
  // The committed research does NOT transcribe charitable-donation credit rates:
  // it records the Schedule 9 and ON428 line 58969 dependency and says the
  // calculation stays with those forms. So four of the five rates are asserted
  // only against rates the research does state elsewhere, and the fifth is
  // recorded here as having no committed backing rather than being asserted as
  // correct. See the testing article in `docs/features/` for the open item.
  const rates = TAX_YEAR_2025_RULES.donationRates;

  assert.deepEqual(rates.first200Federal, TAX_YEAR_2025_RULES.federalLowestRate);
  assert.deepEqual(rates.topFederal, TAX_YEAR_2025_RULES.federalBrackets.at(-1)!.rate);
  assert.deepEqual(rates.first200Ontario, TAX_YEAR_2025_RULES.ontarioLowestRate);
  assert.deepEqual(rates.remainderOntario, TAX_YEAR_2025_RULES.ontarioBrackets[2].rate);

  // Pinned as an observation, not as a researched fact.
  assert.equal(rates.remainderFederal.numerator / rates.remainderFederal.denominator, 0.29);
});

test("an unsupported tax year is refused rather than approximated", () => {
  assert.equal(getTaxYearRules(2025), TAX_YEAR_2025_RULES);
  for (const year of [2024, 2026, 0, -1]) {
    assert.throws(() => getTaxYearRules(year), RangeError, `tax year ${year} must be refused`);
  }
});

test("every official source is an https citation naming the 2025 tax year", () => {
  assert.ok(OFFICIAL_SOURCES_2025.length > 0);
  const ids = new Set<string>();
  for (const source of OFFICIAL_SOURCES_2025) {
    assert.ok(source.url.startsWith("https://"), `${source.id} must cite over https`);
    assert.equal(source.appliesToTaxYear, 2025, `${source.id} must apply to the 2025 tax year`);
    assert.match(source.accessedOn, /^\d{4}-\d{2}-\d{2}$/, `${source.id} must record when it was accessed`);
    assert.ok(!ids.has(source.id), `duplicate source id ${source.id}`);
    ids.add(source.id);
  }
});

test("the cited sources are the official publishers the research names", () => {
  const researchedUrls = new Set<string>([
    ...FEDERAL.sources.map((entry: { url: string }) => entry.url),
    ...ONTARIO.officialSources.map((entry: { url: string }) => entry.url),
  ]);

  // Not every citation in the ruleset appears in these two files, but the ones
  // that do must point at the same page rather than a lookalike.
  const overlapping = OFFICIAL_SOURCES_2025.filter((source) => researchedUrls.has(source.url));
  assert.ok(overlapping.length >= 5, "the ruleset should cite the researched official pages");
  for (const source of overlapping) {
    assert.ok(
      source.publisher === "Canada Revenue Agency" ||
        source.publisher === "Government of Canada" ||
        source.publisher === "Government of Ontario",
      `${source.id} must name an official publisher`,
    );
  }
});
