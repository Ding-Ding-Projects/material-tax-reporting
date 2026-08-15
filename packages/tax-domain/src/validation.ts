import type {
  Money,
  TaxReturnInput,
  ValidationIssue,
  ValidationSeverity,
} from "./model.ts";

const MAX_MONEY = 100_000_000_000;

function issue(
  code: string,
  severity: ValidationSeverity,
  path: string,
  message: string,
  sourceIds: readonly string[] = [],
): ValidationIssue {
  return { code, severity, path, message, sourceIds };
}

function validateMoney(
  value: Money | undefined,
  path: string,
  issues: ValidationIssue[],
): void {
  if (value === undefined) return;
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MONEY) {
    issues.push(
      issue(
        "INVALID_MONEY",
        "error",
        path,
        "Amount must be a non-negative safe integer in Canadian cents and within the supported bound.",
      ),
    );
  }
}

function validateUniqueIds(
  values: readonly { readonly id: string }[],
  path: string,
  issues: ValidationIssue[],
): void {
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (!value.id.trim() || value.id.length > 100) {
      issues.push(issue("INVALID_ID", "error", `${path}.${index}.id`, "ID must contain 1 to 100 characters."));
    } else if (seen.has(value.id)) {
      issues.push(issue("DUPLICATE_ID", "error", `${path}.${index}.id`, `Duplicate ID: ${value.id}`));
    }
    seen.add(value.id);
  }
}

export function validateTaxReturn(input: TaxReturnInput): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (input.schemaVersion !== "canada-annual-personal-tax/1") {
    issues.push(issue("UNSUPPORTED_SCHEMA", "error", "schemaVersion", "Only schema version canada-annual-personal-tax/1 is supported."));
  }
  if (input.taxYear !== 2025) {
    issues.push(issue("UNSUPPORTED_TAX_YEAR", "error", "taxYear", "Only the explicit 2025 tax-year ruleset is supported."));
  }
  if (input.province !== "ON" || input.residency.provinceAtYearEnd !== "ON") {
    issues.push(issue("UNSUPPORTED_PROVINCE", "error", "province", "This ruleset supports Ontario returns only."));
  }
  if (!input.residency.residentInOntarioAtYearEnd) {
    issues.push(
      issue(
        "ONTARIO_RESIDENCY_REQUIRED",
        "error",
        "residency.residentInOntarioAtYearEnd",
        "The ordinary Ontario calculation requires Ontario residence at the end of 2025.",
        ["cra-2025-ontario-tax-information"],
      ),
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.taxpayer.dateOfBirth)) {
    issues.push(issue("INVALID_DATE", "error", "taxpayer.dateOfBirth", "Date of birth must use YYYY-MM-DD."));
  }
  if (input.taxpayer.socialInsuranceNumber !== undefined && !/^\d{9}$/.test(input.taxpayer.socialInsuranceNumber.replace(/[ -]/g, ""))) {
    issues.push(issue("INVALID_SIN_FORMAT", "error", "taxpayer.socialInsuranceNumber", "Social Insurance Number must contain exactly nine digits."));
  }
  if (input.unsupportedSituations.length > 0) {
    for (const situation of input.unsupportedSituations) {
      issues.push(
        issue(
          "UNSUPPORTED_TAX_SITUATION",
          "error",
          "unsupportedSituations",
          `The 2025 ordinary Ontario ruleset does not calculate ${situation}. Use the applicable official form or qualified assistance.`,
          ["cra-2025-ontario-package"],
        ),
      );
    }
  }

  validateUniqueIds(input.t4Slips, "t4Slips", issues);
  validateUniqueIds(input.t4aSlips, "t4aSlips", issues);
  validateUniqueIds(input.t5Slips, "t5Slips", issues);
  validateUniqueIds(input.otherIncome, "otherIncome", issues);
  validateUniqueIds(input.deductions, "deductions", issues);
  validateUniqueIds(input.credits.federalClaims, "credits.federalClaims", issues);
  validateUniqueIds(input.credits.ontarioClaims, "credits.ontarioClaims", issues);

  for (const [index, slip] of input.t4Slips.entries()) {
    validateMoney(slip.box14EmploymentIncome, `t4Slips.${index}.box14EmploymentIncome`, issues);
    validateMoney(slip.box16CppContributions, `t4Slips.${index}.box16CppContributions`, issues);
    validateMoney(slip.box16aCpp2Contributions, `t4Slips.${index}.box16aCpp2Contributions`, issues);
    validateMoney(slip.box18EiPremiums, `t4Slips.${index}.box18EiPremiums`, issues);
    validateMoney(slip.box22IncomeTaxDeducted, `t4Slips.${index}.box22IncomeTaxDeducted`, issues);
    validateMoney(slip.box44UnionDues, `t4Slips.${index}.box44UnionDues`, issues);
    validateMoney(slip.cppBaseContributionCredit, `t4Slips.${index}.cppBaseContributionCredit`, issues);
    validateMoney(slip.cppEnhancedContributionDeduction, `t4Slips.${index}.cppEnhancedContributionDeduction`, issues);
    const reportedCpp = (slip.box16CppContributions ?? 0) + (slip.box16aCpp2Contributions ?? 0);
    const allocatedCpp = (slip.cppBaseContributionCredit ?? 0) + (slip.cppEnhancedContributionDeduction ?? 0);
    if (allocatedCpp > reportedCpp) {
      issues.push(
        issue(
          "CPP_ALLOCATION_EXCEEDS_SLIP",
          "error",
          `t4Slips.${index}`,
          "CPP credit and enhanced-deduction portions cannot exceed the CPP amounts reported on the slip.",
        ),
      );
    }
  }

  for (const [index, slip] of input.t4aSlips.entries()) {
    validateMoney(slip.box22IncomeTaxDeducted, `t4aSlips.${index}.box22IncomeTaxDeducted`, issues);
    for (const [incomeIndex, income] of slip.income.entries()) {
      validateMoney(income.amount, `t4aSlips.${index}.income.${incomeIndex}.amount`, issues);
    }
  }
  for (const [index, slip] of input.t5Slips.entries()) {
    validateMoney(slip.box13Interest, `t5Slips.${index}.box13Interest`, issues);
    validateMoney(slip.box25TaxableEligibleDividends, `t5Slips.${index}.box25TaxableEligibleDividends`, issues);
    validateMoney(slip.box26EligibleDividendTaxCredit, `t5Slips.${index}.box26EligibleDividendTaxCredit`, issues);
    validateMoney(slip.box15TaxableOtherThanEligibleDividends, `t5Slips.${index}.box15TaxableOtherThanEligibleDividends`, issues);
    validateMoney(slip.box16OtherThanEligibleDividendTaxCredit, `t5Slips.${index}.box16OtherThanEligibleDividendTaxCredit`, issues);
  }
  for (const [index, entry] of input.otherIncome.entries()) {
    validateMoney(entry.amount, `otherIncome.${index}.amount`, issues);
  }
  for (const [index, entry] of input.deductions.entries()) {
    validateMoney(entry.amount, `deductions.${index}.amount`, issues);
    if (!entry.verifiedAgainstOfficialWorksheet) {
      issues.push(
        issue(
          "DEDUCTION_REQUIRES_REVIEW",
          "review",
          `deductions.${index}`,
          `Line ${entry.line} has not been acknowledged as checked against its official form or worksheet.`,
        ),
      );
    }
  }
  for (const [index, claim] of input.credits.federalClaims.entries()) {
    validateMoney(claim.amount, `credits.federalClaims.${index}.amount`, issues);
    if (!claim.verifiedAgainstOfficialWorksheet) {
      issues.push(issue("FEDERAL_CLAIM_REQUIRES_REVIEW", "review", `credits.federalClaims.${index}`, `Federal line ${claim.line} requires manual review.`));
    }
  }
  for (const [index, claim] of input.credits.ontarioClaims.entries()) {
    validateMoney(claim.amount, `credits.ontarioClaims.${index}.amount`, issues);
    if (!claim.verifiedAgainstOfficialWorksheet) {
      issues.push(issue("ONTARIO_CLAIM_REQUIRES_REVIEW", "review", `credits.ontarioClaims.${index}`, `Ontario line ${claim.line} requires manual review.`));
    }
  }

  const automaticUnionDues = input.t4Slips.reduce((sum, slip) => sum + (slip.box44UnionDues ?? 0), 0);
  if (automaticUnionDues > 0 && input.deductions.some((entry) => entry.line === "21200")) {
    issues.push(issue("POSSIBLE_DUPLICATE_UNION_DUES", "warning", "deductions", "T4 box 44 union dues and a separate line 21200 deduction are both present. Confirm they are not duplicated."));
  }
  const automaticEnhancedCpp = input.t4Slips.reduce((sum, slip) => sum + (slip.cppEnhancedContributionDeduction ?? 0), 0);
  if (automaticEnhancedCpp > 0 && input.deductions.some((entry) => entry.line === "22215")) {
    issues.push(issue("POSSIBLE_DUPLICATE_CPP_DEDUCTION", "warning", "deductions", "A T4 CPP enhanced-contribution deduction and a separate line 22215 deduction are both present."));
  }

  if (input.credits.donations !== undefined) {
    validateMoney(input.credits.donations.eligibleAmount, "credits.donations.eligibleAmount", issues);
    validateMoney(input.credits.donations.amountEligibleFor33PercentRate, "credits.donations.amountEligibleFor33PercentRate", issues);
    if ((input.credits.donations.amountEligibleFor33PercentRate ?? 0) > input.credits.donations.eligibleAmount) {
      issues.push(issue("INVALID_DONATION_RATE_ALLOCATION", "error", "credits.donations.amountEligibleFor33PercentRate", "The amount assigned to the 33% rate cannot exceed eligible donations."));
    }
  }
  if (input.credits.medical !== undefined) {
    validateMoney(input.credits.medical.eligibleExpensesForSelfSpouseAndMinorChildren, "credits.medical.eligibleExpensesForSelfSpouseAndMinorChildren", issues);
    validateMoney(input.credits.medical.thresholdOverride, "credits.medical.thresholdOverride", issues);
    if (!/^2025-\d{2}-\d{2}$/.test(input.credits.medical.chosenPeriodEnding)) {
      issues.push(issue("INVALID_MEDICAL_PERIOD", "error", "credits.medical.chosenPeriodEnding", "The chosen medical-expense period must end in 2025 and use YYYY-MM-DD."));
    }
    if (input.credits.federalClaims.some((claim) => claim.line === "33099")) {
      issues.push(issue("DUPLICATE_MEDICAL_INPUT", "error", "credits.medical", "Use either guided medical expenses or a federal line 33099 claim, not both."));
    }
  }

  for (const [key, value] of Object.entries(input.carryForwards)) {
    validateMoney(value, `carryForwards.${key}`, issues);
  }
  for (const [key, value] of Object.entries(input.credits)) {
    if (typeof value === "number") validateMoney(value, `credits.${key}`, issues);
  }
  if (!Number.isSafeInteger(input.ontarioTaxReduction.dependentChildrenUnder18) || input.ontarioTaxReduction.dependentChildrenUnder18 < 0) {
    issues.push(issue("INVALID_DEPENDANT_COUNT", "error", "ontarioTaxReduction.dependentChildrenUnder18", "Dependant count must be a non-negative integer."));
  }
  if (!Number.isSafeInteger(input.ontarioTaxReduction.dependantsWithDisability) || input.ontarioTaxReduction.dependantsWithDisability < 0) {
    issues.push(issue("INVALID_DEPENDANT_COUNT", "error", "ontarioTaxReduction.dependantsWithDisability", "Dependant count must be a non-negative integer."));
  }

  issues.push(
    issue(
      "MANDATORY_MANUAL_REVIEW",
      "review",
      "return",
      "Every calculation, populated form, attachment, mailing destination, and signature field must be manually inspected and explicitly acknowledged before a mail-in PDF package can be exported or printed.",
      ["cra-paper-filing"],
    ),
  );

  return issues;
}
