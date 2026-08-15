import type { Money, OfficialSourceCitation, TaxYear } from "./model.ts";

export interface RateFraction {
  readonly numerator: number;
  readonly denominator: number;
}

export interface ProgressiveBracket {
  readonly lowerBound: Money;
  readonly upperBound: Money | null;
  readonly rate: RateFraction;
  readonly baseTax: Money;
}

export interface PiecewiseAmountBand {
  readonly upperBound: Money | null;
  readonly baseAmount: Money;
  readonly excessOver: Money | null;
  readonly rate: RateFraction;
}

export interface TaxYearRules {
  readonly year: TaxYear;
  readonly federalBrackets: readonly ProgressiveBracket[];
  readonly ontarioBrackets: readonly ProgressiveBracket[];
  readonly federalBasicPersonalAmount: {
    readonly maximum: number;
    readonly minimum: number;
    readonly phaseOutStarts: number;
    readonly phaseOutEnds: number;
  };
  readonly federalTopUpTaxCredit: {
    readonly threshold: Money;
    readonly rate: RateFraction;
  };
  readonly canadaEmploymentAmountMaximum: number;
  readonly federalLowestRate: RateFraction;
  readonly ontarioLowestRate: RateFraction;
  readonly ontarioBasicPersonalAmount: number;
  readonly federalMedicalThresholdMaximum: number;
  readonly donationRates: {
    readonly first200Federal: RateFraction;
    readonly remainderFederal: RateFraction;
    readonly topFederal: RateFraction;
    readonly first200Ontario: RateFraction;
    readonly remainderOntario: RateFraction;
  };
  readonly ontarioSurtax: {
    readonly firstThreshold: number;
    readonly firstRate: RateFraction;
    readonly secondThreshold: number;
    readonly secondRate: RateFraction;
  };
  readonly ontarioHealthPremium: readonly PiecewiseAmountBand[];
  readonly ontarioTaxReduction: {
    readonly basic: number;
    readonly childUnder18: number;
    readonly dependantWithDisability: number;
  };
}

export const TAX_YEAR_2025_RULES: TaxYearRules = {
  year: 2025,
  federalBrackets: [
    { lowerBound: 0, upperBound: 5_737_500, rate: { numerator: 1_450, denominator: 10_000 }, baseTax: 0 },
    { lowerBound: 5_737_500, upperBound: 11_475_000, rate: { numerator: 2_050, denominator: 10_000 }, baseTax: 831_938 },
    { lowerBound: 11_475_000, upperBound: 17_788_200, rate: { numerator: 2_600, denominator: 10_000 }, baseTax: 2_008_125 },
    { lowerBound: 17_788_200, upperBound: 25_341_400, rate: { numerator: 2_900, denominator: 10_000 }, baseTax: 3_649_557 },
    { lowerBound: 25_341_400, upperBound: null, rate: { numerator: 3_300, denominator: 10_000 }, baseTax: 5_839_985 },
  ],
  ontarioBrackets: [
    { lowerBound: 0, upperBound: 5_288_600, rate: { numerator: 505, denominator: 10_000 }, baseTax: 0 },
    { lowerBound: 5_288_600, upperBound: 10_577_500, rate: { numerator: 915, denominator: 10_000 }, baseTax: 267_074 },
    { lowerBound: 10_577_500, upperBound: 15_000_000, rate: { numerator: 1_116, denominator: 10_000 }, baseTax: 751_009 },
    { lowerBound: 15_000_000, upperBound: 22_000_000, rate: { numerator: 1_216, denominator: 10_000 }, baseTax: 1_244_560 },
    { lowerBound: 22_000_000, upperBound: null, rate: { numerator: 1_316, denominator: 10_000 }, baseTax: 2_095_760 },
  ],
  federalBasicPersonalAmount: {
    maximum: 1_612_900,
    minimum: 1_453_800,
    phaseOutStarts: 17_788_200,
    phaseOutEnds: 25_341_400,
  },
  federalTopUpTaxCredit: {
    threshold: 831_938,
    rate: { numerator: 345, denominator: 10_000 },
  },
  canadaEmploymentAmountMaximum: 147_100,
  federalLowestRate: { numerator: 1_450, denominator: 10_000 },
  ontarioLowestRate: { numerator: 505, denominator: 10_000 },
  ontarioBasicPersonalAmount: 1_274_700,
  federalMedicalThresholdMaximum: 283_400,
  donationRates: {
    first200Federal: { numerator: 1_450, denominator: 10_000 },
    remainderFederal: { numerator: 2_900, denominator: 10_000 },
    topFederal: { numerator: 3_300, denominator: 10_000 },
    first200Ontario: { numerator: 505, denominator: 10_000 },
    remainderOntario: { numerator: 1_116, denominator: 10_000 },
  },
  ontarioSurtax: {
    firstThreshold: 571_000,
    firstRate: { numerator: 2_000, denominator: 10_000 },
    secondThreshold: 730_700,
    secondRate: { numerator: 3_600, denominator: 10_000 },
  },
  ontarioHealthPremium: [
    { upperBound: 2_000_000, baseAmount: 0, excessOver: null, rate: { numerator: 0, denominator: 10_000 } },
    { upperBound: 2_500_000, baseAmount: 0, excessOver: 2_000_000, rate: { numerator: 600, denominator: 10_000 } },
    { upperBound: 3_600_000, baseAmount: 30_000, excessOver: null, rate: { numerator: 0, denominator: 10_000 } },
    { upperBound: 3_850_000, baseAmount: 30_000, excessOver: 3_600_000, rate: { numerator: 600, denominator: 10_000 } },
    { upperBound: 4_800_000, baseAmount: 45_000, excessOver: null, rate: { numerator: 0, denominator: 10_000 } },
    { upperBound: 4_860_000, baseAmount: 45_000, excessOver: 4_800_000, rate: { numerator: 2_500, denominator: 10_000 } },
    { upperBound: 7_200_000, baseAmount: 60_000, excessOver: null, rate: { numerator: 0, denominator: 10_000 } },
    { upperBound: 7_260_000, baseAmount: 60_000, excessOver: 7_200_000, rate: { numerator: 2_500, denominator: 10_000 } },
    { upperBound: 20_000_000, baseAmount: 75_000, excessOver: null, rate: { numerator: 0, denominator: 10_000 } },
    { upperBound: 20_060_000, baseAmount: 75_000, excessOver: 20_000_000, rate: { numerator: 2_500, denominator: 10_000 } },
    { upperBound: null, baseAmount: 90_000, excessOver: null, rate: { numerator: 0, denominator: 10_000 } },
  ],
  ontarioTaxReduction: {
    basic: 29_400,
    childUnder18: 54_400,
    dependantWithDisability: 54_400,
  },
};

export const OFFICIAL_SOURCES_2025: readonly OfficialSourceCitation[] = [
  {
    id: "cra-2025-tax-rates",
    title: "Last year tax rates and income brackets (2025)",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/tax-rates-brackets/last-year.html",
    publisher: "Canada Revenue Agency",
    appliesToTaxYear: 2025,
    accessedOn: "2026-08-14",
  },
  {
    id: "cra-2025-ontario-package",
    title: "Ontario - 2025 Income tax package",
    url: "https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario.html",
    publisher: "Canada Revenue Agency",
    appliesToTaxYear: 2025,
    accessedOn: "2026-08-14",
  },
  {
    id: "cra-2025-ontario-return",
    title: "5006-R Income Tax and Benefit Return (for ON only)",
    url: "https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-r.html",
    publisher: "Canada Revenue Agency",
    appliesToTaxYear: 2025,
    accessedOn: "2026-08-14",
  },
  {
    id: "cra-2025-federal-worksheet",
    title: "5000-D1 Federal Worksheet (for all except non-residents)",
    url: "https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-d1.html",
    publisher: "Canada Revenue Agency",
    appliesToTaxYear: 2025,
    accessedOn: "2026-08-14",
  },
  {
    id: "cra-2025-ontario-on428",
    title: "5006-C ON428 - Ontario Tax",
    url: "https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-c.html",
    publisher: "Canada Revenue Agency",
    appliesToTaxYear: 2025,
    accessedOn: "2026-08-14",
  },
  {
    id: "cra-2025-ontario-tax-information",
    title: "Ontario tax information for 2025",
    url: "https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-pc.html",
    publisher: "Canada Revenue Agency",
    appliesToTaxYear: 2025,
    accessedOn: "2026-08-14",
  },
  {
    id: "cra-2025-payroll-formulas",
    title: "Payroll Deductions Formulas - 120th Edition Effective January 1, 2025",
    url: "https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/payroll-deductions-t4127-payroll-deductions-formulas/t4127-jan-120th-edition-effective-january-1-2025/t4127-jan-payroll-deductions-formulas-computer-programs.html",
    publisher: "Canada Revenue Agency",
    appliesToTaxYear: 2025,
    accessedOn: "2026-08-14",
  },
  {
    id: "cra-2025-canada-employment-amount",
    title: "Canada employment amount",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-31260-canada-employment-amount.html",
    publisher: "Canada Revenue Agency",
    appliesToTaxYear: 2025,
    accessedOn: "2026-08-14",
  },
  {
    id: "cra-2025-donations",
    title: "How much you can claim - Donations and gifts",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-34900-donations-gifts/how-much-claim.html",
    publisher: "Canada Revenue Agency",
    appliesToTaxYear: 2025,
    accessedOn: "2026-08-14",
  },
  {
    id: "cra-paper-filing",
    title: "Filing a paper tax return",
    url: "https://www.canada.ca/en/services/taxes/income-tax/personal-income-tax/how-file/paper.html",
    publisher: "Government of Canada",
    appliesToTaxYear: 2025,
    accessedOn: "2026-08-14",
  },
  {
    id: "cra-paper-mailing-addresses",
    title: "Where to mail your paper T1 return",
    url: "https://www.canada.ca/en/revenue-agency/corporate/contact-information/where-mail-your-paper-t1-return.html",
    publisher: "Canada Revenue Agency",
    appliesToTaxYear: 2025,
    accessedOn: "2026-08-14",
  },
];

export function getTaxYearRules(year: number): TaxYearRules {
  if (year !== 2025) {
    throw new RangeError(`Unsupported tax year: ${year}. Only the explicit 2025 ruleset is available.`);
  }
  return TAX_YEAR_2025_RULES;
}
