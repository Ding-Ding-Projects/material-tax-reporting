export type TaxYear = 2025;
export type ProvinceCode = "ON";

/** Integer Canadian cents. Floating-point dollar inputs are intentionally not accepted. */
export type Money = number;

export interface OfficialSourceCitation {
  readonly id: string;
  readonly title: string;
  readonly url: `https://${string}`;
  readonly publisher: "Canada Revenue Agency" | "Government of Canada" | "Government of Ontario";
  readonly appliesToTaxYear: TaxYear;
  readonly accessedOn: string;
}

export interface TaxpayerIdentity {
  readonly givenName: string;
  readonly familyName: string;
  readonly dateOfBirth: string;
  readonly socialInsuranceNumber?: string;
}

export interface ResidencyFacts {
  readonly provinceAtYearEnd: ProvinceCode;
  readonly residentInCanadaAtStartOfYear: boolean;
  readonly residentInOntarioAtYearEnd: boolean;
  readonly mailingCity: string;
  readonly emigratedDuringYear?: boolean;
  readonly immigratedDuringYear?: boolean;
  readonly nonResident?: boolean;
}

export interface T4Slip {
  readonly id: string;
  readonly employerName: string;
  readonly box14EmploymentIncome: Money;
  readonly box16CppContributions?: Money;
  readonly box16aCpp2Contributions?: Money;
  readonly box18EiPremiums?: Money;
  readonly box22IncomeTaxDeducted?: Money;
  readonly box44UnionDues?: Money;
  readonly cppBaseContributionCredit?: Money;
  readonly cppEnhancedContributionDeduction?: Money;
}

export type T4AIncomeLine = "10400" | "11500" | "13000";

export interface T4ASlip {
  readonly id: string;
  readonly payerName: string;
  readonly income: readonly {
    readonly line: T4AIncomeLine;
    readonly amount: Money;
    readonly description: string;
  }[];
  readonly box22IncomeTaxDeducted?: Money;
}

export interface T5Slip {
  readonly id: string;
  readonly payerName: string;
  readonly box13Interest?: Money;
  readonly box25TaxableEligibleDividends?: Money;
  readonly box26EligibleDividendTaxCredit?: Money;
  readonly box15TaxableOtherThanEligibleDividends?: Money;
  readonly box16OtherThanEligibleDividendTaxCredit?: Money;
}

export type OtherIncomeLine =
  | "10400"
  | "11300"
  | "11400"
  | "11500"
  | "11600"
  | "11900"
  | "12000"
  | "12100"
  | "12500"
  | "12700"
  | "12900"
  | "13000";

export interface OtherIncomeEntry {
  readonly id: string;
  readonly line: OtherIncomeLine;
  readonly description: string;
  readonly amount: Money;
  readonly sourceDocument?: string;
}

export type DeductionLine =
  | "20600"
  | "20700"
  | "20800"
  | "21000"
  | "21200"
  | "21300"
  | "21400"
  | "21500"
  | "21700"
  | "21900"
  | "22000"
  | "22100"
  | "22200"
  | "22215"
  | "22400"
  | "22900"
  | "23100"
  | "23200"
  | "23500"
  | "24400"
  | "24900"
  | "25000"
  | "25100"
  | "25200"
  | "25300"
  | "25400"
  | "25500"
  | "25600";

export interface DeductionEntry {
  readonly id: string;
  readonly line: DeductionLine;
  readonly description: string;
  readonly amount: Money;
  readonly verifiedAgainstOfficialWorksheet: boolean;
}

export type FederalClaimLine =
  | "30100"
  | "30300"
  | "30400"
  | "30425"
  | "30450"
  | "30500"
  | "30700"
  | "30800"
  | "31000"
  | "31200"
  | "31240"
  | "31270"
  | "31285"
  | "31300"
  | "31400"
  | "31600"
  | "31800"
  | "31900"
  | "32300"
  | "32400"
  | "32600"
  | "33099"
  | "33199";

export type OntarioClaimLine =
  | "58080"
  | "58120"
  | "58160"
  | "58185"
  | "58330"
  | "58360"
  | "58440"
  | "58480"
  | "58640"
  | "58689"
  | "58729"
  | "58900"
  | "58969";

export interface ClaimAmount<Line extends string> {
  readonly id: string;
  readonly line: Line;
  readonly description: string;
  readonly amount: Money;
  readonly verifiedAgainstOfficialWorksheet: boolean;
}

export interface DonationClaims {
  readonly eligibleAmount: Money;
  readonly amountEligibleFor33PercentRate?: Money;
  readonly carriedForwardIntoYear?: Money;
}

export interface MedicalClaims {
  readonly eligibleExpensesForSelfSpouseAndMinorChildren: Money;
  readonly chosenPeriodEnding: string;
  readonly thresholdOverride?: Money;
}

export interface TaxCreditsInput {
  readonly federalClaims: readonly ClaimAmount<FederalClaimLine>[];
  readonly ontarioClaims: readonly ClaimAmount<OntarioClaimLine>[];
  readonly donations?: DonationClaims;
  readonly medical?: MedicalClaims;
  readonly federalDividendTaxCredit?: Money;
  readonly ontarioDividendTaxCredit?: Money;
  readonly foreignTaxCredits?: Money;
  readonly ontarioLiftCredit?: Money;
  readonly ontarioRefundableCredits?: Money;
}

export interface OntarioTaxReductionFacts {
  readonly dependentChildrenUnder18: number;
  readonly dependantsWithDisability: number;
  readonly eligible: boolean;
}

export interface CarryForwardBalances {
  readonly unusedRrspContributions?: Money;
  readonly federalTuition?: Money;
  readonly ontarioTuition?: Money;
  readonly donations?: Money;
  readonly capitalLosses?: Money;
  readonly alternativeMinimumTax?: Money;
}

export type UnsupportedSituation =
  | "bankruptcy"
  | "deceased-return"
  | "non-resident"
  | "multiple-jurisdictions"
  | "self-employment"
  | "rental-income"
  | "foreign-income-or-assets"
  | "trust-or-estate-income"
  | "tax-on-split-income"
  | "alternative-minimum-tax"
  | "farming-or-fishing"
  | "tax-shelter"
  | "complex-capital-gains"
  | "indigenous-tax-exemption"
  | "other-special-election";

export interface TaxReturnInput {
  readonly schemaVersion: "canada-annual-personal-tax/1";
  readonly taxYear: TaxYear;
  readonly province: ProvinceCode;
  readonly taxpayer: TaxpayerIdentity;
  readonly residency: ResidencyFacts;
  readonly t4Slips: readonly T4Slip[];
  readonly t4aSlips: readonly T4ASlip[];
  readonly t5Slips: readonly T5Slip[];
  readonly otherIncome: readonly OtherIncomeEntry[];
  readonly deductions: readonly DeductionEntry[];
  readonly credits: TaxCreditsInput;
  readonly ontarioTaxReduction: OntarioTaxReductionFacts;
  readonly carryForwards: CarryForwardBalances;
  readonly unsupportedSituations: readonly UnsupportedSituation[];
}

export type ValidationSeverity = "error" | "warning" | "review";

export interface ValidationIssue {
  readonly code: string;
  readonly severity: ValidationSeverity;
  readonly path: string;
  readonly message: string;
  readonly sourceIds: readonly string[];
}

export interface TaxLineResult {
  readonly line: string;
  readonly label: string;
  readonly amount: Money;
  readonly sourceIds: readonly string[];
}

export interface TaxCalculationResult {
  readonly schemaVersion: "canada-annual-personal-tax-result/1";
  readonly taxYear: TaxYear;
  readonly province: ProvinceCode;
  readonly calculatedAt: string;
  readonly blocked: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly lines: Readonly<Record<string, TaxLineResult>>;
  readonly totalIncome: Money;
  readonly netIncome: Money;
  readonly taxableIncome: Money;
  readonly federalTax: Money;
  readonly ontarioTax: Money;
  readonly totalPayable: Money;
  readonly totalCreditsAndWithholding: Money;
  readonly balanceOwing: Money;
  readonly refund: Money;
  readonly carryForwards: CarryForwardBalances;
  readonly sourceIds: readonly string[];
  readonly disclaimers: readonly string[];
}
