import type { OfficialSourceCitation, TaxYear } from "./model.js";

export interface ProgressiveBracket {
  readonly upperBound: number | null;
  readonly rate: number;
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
  readonly canadaEmploymentAmountMaximum: number;
  readonly federalLowestRate: number;
  readonly ontarioLowestRate: number;
  readonly ontarioBasicPersonalAmount: number;
  readonly federalMedicalThresholdMaximum: number;
  readonly donationRates: {
    readonly first200Federal: number;
    readonly remainderFederal: number;
    readonly topFederal: number;
    readonly first200Ontario: number;
    readonly remainderOntario: number;
  };
  readonly ontarioSurtax: {
    readonly firstThreshold: number;
    readonly firstRate: number;
    readonly secondThreshold: number;
    readonly secondRate: number;
  };
  readonly ontarioTaxReduction: {
    readonly basic: number;
    readonly childUnder18: number;
    readonly dependantWithDisability: number;
  };
}

export const TAX_YEAR_2025_RULES: TaxYearRules = {
  year: 2025,
  federalBrackets: [
    { upperBound: 5_737_500, rate: 0.145 },
    { upperBound: 11_475_000, rate: 0.205 },
    { upperBound: 17_788_200, rate: 0.26 },
    { upperBound: 25_341_400, rate: 0.29 },
    { upperBound: null, rate: 0.33 },
  ],
  ontarioBrackets: [
    { upperBound: 5_288_600, rate: 0.0505 },
    { upperBound: 10_577_500, rate: 0.0915 },
    { upperBound: 15_000_000, rate: 0.1116 },
    { upperBound: 22_000_000, rate: 0.1216 },
    { upperBound: null, rate: 0.1316 },
  ],
  federalBasicPersonalAmount: {
    maximum: 1_612_900,
    minimum: 1_453_800,
    phaseOutStarts: 17_788_200,
    phaseOutEnds: 25_341_400,
  },
  canadaEmploymentAmountMaximum: 147_100,
  federalLowestRate: 0.145,
  ontarioLowestRate: 0.0505,
  ontarioBasicPersonalAmount: 1_274_700,
  federalMedicalThresholdMaximum: 283_400,
  donationRates: {
    first200Federal: 0.145,
    remainderFederal: 0.29,
    topFederal: 0.33,
    first200Ontario: 0.0505,
    remainderOntario: 0.1116,
  },
  ontarioSurtax: {
    firstThreshold: 571_000,
    firstRate: 0.2,
    secondThreshold: 730_700,
    secondRate: 0.36,
  },
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
