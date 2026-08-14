import type {
  CarryForwardBalances,
  Money,
  TaxCalculationResult,
  TaxLineResult,
  TaxReturnInput,
} from "./model.js";
import { getTaxYearRules, OFFICIAL_SOURCES_2025, type ProgressiveBracket } from "./rules.js";
import { validateTaxReturn } from "./validation.js";

const round = (value: number): Money => Math.round(value);
const clampAtZero = (value: Money): Money => Math.max(0, value);
const sum = (values: readonly Money[]): Money => values.reduce((total, value) => total + value, 0);

function progressiveTax(taxableIncome: Money, brackets: readonly ProgressiveBracket[]): Money {
  let lowerBound = 0;
  let tax = 0;
  for (const bracket of brackets) {
    const upperBound = bracket.upperBound ?? taxableIncome;
    const amountInBracket = Math.max(0, Math.min(taxableIncome, upperBound) - lowerBound);
    tax += amountInBracket * bracket.rate;
    if (taxableIncome <= upperBound || bracket.upperBound === null) break;
    lowerBound = upperBound;
  }
  return round(tax);
}

function federalBasicPersonalAmount(netIncome: Money): Money {
  const rules = getTaxYearRules(2025).federalBasicPersonalAmount;
  if (netIncome <= rules.phaseOutStarts) return rules.maximum;
  if (netIncome >= rules.phaseOutEnds) return rules.minimum;
  const reduction = ((netIncome - rules.phaseOutStarts) * (rules.maximum - rules.minimum)) /
    (rules.phaseOutEnds - rules.phaseOutStarts);
  return round(rules.maximum - reduction);
}

function ontarioHealthPremium(taxableIncome: Money): Money {
  if (taxableIncome <= 2_000_000) return 0;
  if (taxableIncome <= 3_600_000) return Math.min(30_000, round((taxableIncome - 2_000_000) * 0.06));
  if (taxableIncome <= 4_800_000) return Math.min(45_000, 30_000 + round((taxableIncome - 3_600_000) * 0.06));
  if (taxableIncome <= 7_200_000) return Math.min(60_000, 45_000 + round((taxableIncome - 4_800_000) * 0.25));
  if (taxableIncome <= 20_000_000) return Math.min(75_000, 60_000 + round((taxableIncome - 7_200_000) * 0.25));
  return Math.min(90_000, 75_000 + round((taxableIncome - 20_000_000) * 0.25));
}

function addLine(
  lines: Record<string, TaxLineResult>,
  line: string,
  label: string,
  amount: Money,
  sourceIds: readonly string[],
): void {
  const existing = lines[line];
  lines[line] = existing === undefined
    ? { line, label, amount, sourceIds }
    : { line, label: existing.label, amount: existing.amount + amount, sourceIds: [...new Set([...existing.sourceIds, ...sourceIds])] };
}

function calculateDonationCredits(
  eligibleAmount: Money,
  amountAt33Percent: Money,
): { federal: Money; ontario: Money } {
  const rates = getTaxYearRules(2025).donationRates;
  const first200 = Math.min(20_000, eligibleAmount);
  const remainder = Math.max(0, eligibleAmount - first200);
  const at33 = Math.min(remainder, amountAt33Percent);
  const at29 = remainder - at33;
  return {
    federal: round(first200 * rates.first200Federal + at29 * rates.remainderFederal + at33 * rates.topFederal),
    ontario: round(first200 * rates.first200Ontario + remainder * rates.remainderOntario),
  };
}

export function calculateTaxReturn(input: TaxReturnInput, calculatedAt = new Date().toISOString()): TaxCalculationResult {
  const rules = getTaxYearRules(input.taxYear);
  const issues = validateTaxReturn(input);
  const blocked = issues.some((entry) => entry.severity === "error");
  const lines: Record<string, TaxLineResult> = {};

  for (const slip of input.t4Slips) {
    addLine(lines, "10100", "Employment income", slip.box14EmploymentIncome, []);
  }
  for (const slip of input.t4aSlips) {
    for (const income of slip.income) addLine(lines, income.line, income.description, income.amount, []);
  }
  for (const slip of input.t5Slips) {
    addLine(lines, "12100", "Interest and other investment income", slip.box13Interest ?? 0, []);
    addLine(lines, "12000", "Taxable Canadian dividends", (slip.box25TaxableEligibleDividends ?? 0) + (slip.box15TaxableOtherThanEligibleDividends ?? 0), []);
  }
  for (const entry of input.otherIncome) addLine(lines, entry.line, entry.description, entry.amount, []);

  const totalIncome = sum(Object.values(lines).filter((line) => Number(line.line) < 20000).map((line) => line.amount));
  addLine(lines, "15000", "Total income", totalIncome, ["cra-2025-ontario-package"]);

  const deductions = new Map<string, Money>();
  for (const entry of input.deductions) deductions.set(entry.line, (deductions.get(entry.line) ?? 0) + entry.amount);
  const unionDues = sum(input.t4Slips.map((slip) => slip.box44UnionDues ?? 0));
  const enhancedCpp = sum(input.t4Slips.map((slip) => slip.cppEnhancedContributionDeduction ?? 0));
  deductions.set("21200", (deductions.get("21200") ?? 0) + unionDues);
  deductions.set("22215", (deductions.get("22215") ?? 0) + enhancedCpp);
  for (const [line, amount] of deductions) addLine(lines, line, `Deduction at line ${line}`, amount, []);

  const netDeductionTotal = sum([...deductions.entries()].filter(([line]) => Number(line) <= 23500).map(([, amount]) => amount));
  const netIncome = clampAtZero(totalIncome - netDeductionTotal);
  addLine(lines, "23600", "Net income", netIncome, ["cra-2025-ontario-package"]);
  const taxableDeductions = sum([...deductions.entries()].filter(([line]) => Number(line) >= 24400).map(([, amount]) => amount));
  const taxableIncome = clampAtZero(netIncome - taxableDeductions);
  addLine(lines, "26000", "Taxable income", taxableIncome, ["cra-2025-tax-rates"]);

  const employmentIncome = lines["10100"]?.amount ?? 0;
  const cppCredit = sum(input.t4Slips.map((slip) => slip.cppBaseContributionCredit ?? 0));
  const eiCredit = sum(input.t4Slips.map((slip) => slip.box18EiPremiums ?? 0));
  const federalClaimBase = sum(input.credits.federalClaims.map((claim) => claim.amount));
  const ontarioClaimBase = sum(input.credits.ontarioClaims.map((claim) => claim.amount));
  const bpa = federalBasicPersonalAmount(netIncome);
  const employmentAmount = Math.min(employmentIncome, rules.canadaEmploymentAmountMaximum);
  const medicalThreshold = input.credits.medical === undefined
    ? 0
    : (input.credits.medical.thresholdOverride ?? Math.min(rules.federalMedicalThresholdMaximum, round(netIncome * 0.03)));
  const medicalClaim = input.credits.medical === undefined
    ? 0
    : clampAtZero(input.credits.medical.eligibleExpensesForSelfSpouseAndMinorChildren - medicalThreshold);
  const federalNonRefundableBase = bpa + employmentAmount + cppCredit + eiCredit + federalClaimBase + medicalClaim;
  const federalNonRefundableCredit = round(federalNonRefundableBase * rules.federalLowestRate);
  const ontarioNonRefundableBase = rules.ontarioBasicPersonalAmount + cppCredit + eiCredit + ontarioClaimBase;
  const ontarioNonRefundableCredit = round(ontarioNonRefundableBase * rules.ontarioLowestRate);

  const donationLimit = round(netIncome * 0.75);
  const donationInput = input.credits.donations?.eligibleAmount ?? 0;
  const donationsClaimed = Math.min(donationInput, donationLimit);
  const donationCredits = calculateDonationCredits(donationsClaimed, input.credits.donations?.amountEligibleFor33PercentRate ?? 0);

  const federalTaxOnIncome = progressiveTax(taxableIncome, rules.federalBrackets);
  const federalDividendCreditFromSlips = sum(input.t5Slips.map((slip) => (slip.box26EligibleDividendTaxCredit ?? 0) + (slip.box16OtherThanEligibleDividendTaxCredit ?? 0)));
  const federalTax = clampAtZero(
    federalTaxOnIncome - federalNonRefundableCredit - donationCredits.federal -
    federalDividendCreditFromSlips - (input.credits.federalDividendTaxCredit ?? 0) - (input.credits.foreignTaxCredits ?? 0),
  );

  const ontarioTaxOnIncome = progressiveTax(taxableIncome, rules.ontarioBrackets);
  const basicOntarioTax = clampAtZero(ontarioTaxOnIncome - ontarioNonRefundableCredit - donationCredits.ontario);
  const surtax =
    round(Math.max(0, basicOntarioTax - rules.ontarioSurtax.firstThreshold) * rules.ontarioSurtax.firstRate) +
    round(Math.max(0, basicOntarioTax - rules.ontarioSurtax.secondThreshold) * rules.ontarioSurtax.secondRate);
  const ontarioTaxBeforeReduction = clampAtZero(basicOntarioTax + surtax - (input.credits.ontarioDividendTaxCredit ?? 0));
  const reductionAmounts = rules.ontarioTaxReduction.basic +
    input.ontarioTaxReduction.dependentChildrenUnder18 * rules.ontarioTaxReduction.childUnder18 +
    input.ontarioTaxReduction.dependantsWithDisability * rules.ontarioTaxReduction.dependantWithDisability;
  const calculatedReduction = input.ontarioTaxReduction.eligible
    ? Math.min(ontarioTaxBeforeReduction, Math.max(0, 2 * reductionAmounts - ontarioTaxBeforeReduction))
    : 0;
  const ontarioTaxAfterReduction = clampAtZero(ontarioTaxBeforeReduction - calculatedReduction - (input.credits.ontarioLiftCredit ?? 0));
  const healthPremium = ontarioHealthPremium(taxableIncome);
  const ontarioTax = ontarioTaxAfterReduction + healthPremium;

  addLine(lines, "30000", "Basic personal amount", bpa, ["cra-2025-payroll-formulas"]);
  addLine(lines, "31260", "Canada employment amount", employmentAmount, ["cra-2025-canada-employment-amount"]);
  addLine(lines, "40400", "Federal tax", federalTax, ["cra-2025-tax-rates"]);
  addLine(lines, "42800", "Ontario tax", ontarioTax, ["cra-2025-ontario-tax-information"]);
  addLine(lines, "ON-SURTAX", "Ontario surtax", surtax, ["cra-2025-payroll-formulas"]);
  addLine(lines, "ON-HEALTH-PREMIUM", "Ontario health premium", healthPremium, ["cra-2025-ontario-tax-information"]);

  const totalPayable = federalTax + ontarioTax;
  const withholding = sum(input.t4Slips.map((slip) => slip.box22IncomeTaxDeducted ?? 0)) +
    sum(input.t4aSlips.map((slip) => slip.box22IncomeTaxDeducted ?? 0));
  const totalCreditsAndWithholding = withholding + (input.credits.ontarioRefundableCredits ?? 0);
  const netBalance = totalPayable - totalCreditsAndWithholding;
  const carryForwards: CarryForwardBalances = {
    ...input.carryForwards,
    donations: (input.carryForwards.donations ?? 0) + Math.max(0, donationInput - donationsClaimed),
  };

  return {
    schemaVersion: "canada-annual-personal-tax-result/1",
    taxYear: 2025,
    province: "ON",
    calculatedAt,
    blocked,
    issues,
    lines,
    totalIncome,
    netIncome,
    taxableIncome,
    federalTax,
    ontarioTax,
    totalPayable,
    totalCreditsAndWithholding,
    balanceOwing: Math.max(0, netBalance),
    refund: Math.max(0, -netBalance),
    carryForwards,
    sourceIds: OFFICIAL_SOURCES_2025.map((source) => source.id),
    disclaimers: [
      "Preparation estimate only; not tax, legal, accounting, or financial advice.",
      "Not CRA-certified and not a statement of eligibility or assessment.",
      "No NETFILE, EFILE, electronic submission, direct CRA transmission, simulated filing, or automatic filing is provided.",
      "The only supported output is a CRA mail-in PDF package after mandatory manual review and explicit acknowledgement.",
    ],
  };
}
