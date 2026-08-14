import { CRA_DOCUMENT_2025_BY_ID, OFFICIAL_SOURCES_2025 } from "./catalog/2025.js";
import { parseCalculationLineKey } from "./mapping/2025.js";
import type {
  CraDocumentDefinition,
  CraPdfCaseFileV1,
  EligibilityAssessment,
  EligibilityFinding,
  FormInclusionFlags,
  PortableCarryForwardExportV1,
} from "./types.js";

const OFFICIAL_SOURCE_IDS = new Set(OFFICIAL_SOURCES_2025.map((source) => source.id));

const UNSUPPORTED_SITUATIONS = [
  ["nonResidentOrDeemedResident", "unsupported.non-resident", "Non-resident and deemed-resident returns use a different package and are not prepared.", "cra-ontario-package-2025"],
  ["enteredOrLeftCanadaDuringYear", "unsupported.part-year-resident", "Immigrant and emigrant returns require manual tax treatment outside this package.", "cra-federal-guide-2025"],
  ["deceasedReturn", "unsupported.deceased", "Returns for deceased persons are not prepared.", "cra-federal-guide-2025"],
  ["bankruptcyReturn", "unsupported.bankruptcy", "Pre- and post-bankruptcy returns are not prepared.", "cra-ontario-information-2025"],
  ["businessPermanentEstablishmentOutsideOntario", "unsupported.multiple-jurisdictions", "Business income allocated outside Ontario requires Form T2203 instead of ON428.", "cra-ontario-package-2025"],
  ["farmingOrFishingIncome", "unsupported.farming-fishing", "Farming and fishing statements are outside the supported form set.", "cra-additional-forms"],
  ["trustIncomeOrTrustReturn", "unsupported.trust", "Trust and estate reporting is outside the supported form set.", "cra-federal-guide-2025"],
  ["alternativeMinimumTax", "unsupported.minimum-tax", "Alternative minimum tax requires Form T691 and is not calculated by this package.", "cra-additional-forms"],
  ["splitIncome", "unsupported.split-income", "Tax on split income requires Form T1206 and is not calculated by this package.", "cra-additional-forms"],
  ["foreignTaxCredit", "unsupported.foreign-tax-credit", "Federal or provincial foreign tax credit forms are not prepared.", "cra-additional-forms"],
  ["specifiedForeignPropertyOverThreshold", "unsupported.t1135", "A possible T1135 obligation is separate and blocks automated package preparation until handled outside this package.", "cra-t1135"],
  ["complexCapitalTransaction", "unsupported.complex-capital", "Capital transactions requiring elections, reserves, special reporting, or adjusted-cost-base analysis are not prepared.", "cra-federal-guide-2025"],
] as const;

function isIncluded(definition: CraDocumentDefinition, flags: FormInclusionFlags): boolean {
  return definition.inclusion === "always" ||
    (definition.inclusionFlag !== undefined && flags[definition.inclusionFlag]);
}

export function assessEligibility(caseFile: CraPdfCaseFileV1): EligibilityAssessment {
  const findings: EligibilityFinding[] = [];
  for (const [key, code, message, sourceId] of UNSUPPORTED_SITUATIONS) {
    if (caseFile.unsupportedSituations[key]) {
      findings.push({ code, severity: "blocker", message, sourceId });
    }
  }

  for (const warning of caseFile.calculation.warnings) {
    findings.push({
      code: "calculation.manual-review",
      severity: "manual-review",
      message: warning,
      sourceId: "cra-federal-guide-2025",
    });
  }

  findings.push({
    code: "scope.mail-only",
    severity: "information",
    message: "The package prepares local PDFs for review, printing, signature, and mailing only. It does not file a return.",
    sourceId: "cra-paper-filing",
  });

  return {
    eligibleForAutomatedPreparation: !findings.some((finding) => finding.severity === "blocker"),
    findings,
  };
}

export function validateCaseFile(caseFile: CraPdfCaseFileV1): readonly string[] {
  const errors: string[] = [];
  if (caseFile.schemaVersion !== "cra-pdf-case.v1") errors.push("Unsupported case-file schema version.");
  if (caseFile.taxYear !== 2025 || caseFile.calculation.taxYear !== 2025) errors.push("Only the explicit 2025 tax-year package is supported.");
  if (caseFile.province !== "ON" || caseFile.calculation.province !== "ON") errors.push("Only the Ontario package is supported.");
  if (caseFile.calculation.schemaVersion !== "tax-calculation-snapshot.v1") errors.push("Unsupported calculation snapshot schema version.");
  if (!caseFile.consent.localProcessingOnly || !caseFile.consent.understandsNotTaxAdvice ||
      !caseFile.consent.understandsNotCraCertified || !caseFile.consent.understandsMailOnlyOutput) {
    errors.push("All scope and local-processing acknowledgements are required.");
  }

  if (!/^\d{9}$/.test(caseFile.identity.socialInsuranceNumber)) {
    errors.push("The social insurance number must contain exactly nine digits; its value is never logged.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(caseFile.identity.dateOfBirth)) errors.push("Date of birth must use YYYY-MM-DD.");
  if (!/^[A-Z]\d[A-Z][ -]?\d[A-Z]\d$/i.test(caseFile.identity.mailingAddress.postalCode)) errors.push("The Canadian postal code format is invalid.");
  if (caseFile.identity.mailingAddress.province !== "ON" || caseFile.identity.mailingAddress.country !== "Canada") {
    errors.push("The 2025 Ontario package requires a Canadian Ontario mailing address in this bounded implementation.");
  }

  const allLines = [
    ...Object.entries(caseFile.calculation.federalLines),
    ...Object.entries(caseFile.calculation.ontarioLines),
  ];
  for (const [key, amount] of allLines) {
    if (!Number.isSafeInteger(amount)) errors.push(`Calculation line ${key} is not safe integer cents.`);
    const parsed = parseCalculationLineKey(key);
    if (parsed === undefined) {
      errors.push(`Calculation line key ${key} must identify a supported document and line.`);
      continue;
    }
    const definition = CRA_DOCUMENT_2025_BY_ID.get(parsed.documentId);
    if (definition === undefined || !isIncluded(definition, caseFile.calculation.inclusionFlags)) {
      errors.push(`Calculation line ${key} targets a form that is not included by the case flags.`);
    }
  }

  const attachmentIds = new Set<string>();
  for (const attachment of caseFile.attachments) {
    if (attachmentIds.has(attachment.id)) errors.push(`Duplicate attachment id: ${attachment.id}.`);
    attachmentIds.add(attachment.id);
    if (attachment.id.length < 1 || attachment.id.length > 100) errors.push("Attachment ids must contain 1 to 100 characters.");
    if (attachment.displayName.length < 1 || attachment.displayName.length > 200) errors.push(`Attachment ${attachment.id} has an invalid display name.`);
    if (attachment.localHandle.length < 1 || attachment.localHandle.length > 500) errors.push(`Attachment ${attachment.id} has an invalid local handle.`);
    if (attachment.sha256 !== undefined && !/^[a-f0-9]{64}$/i.test(attachment.sha256)) errors.push(`Attachment ${attachment.id} has an invalid SHA-256 value.`);
  }

  for (const carryForward of caseFile.carryForwards) {
    if (!Number.isSafeInteger(carryForward.amountCents) || carryForward.amountCents < 0) {
      errors.push(`Carry-forward ${carryForward.type} must be non-negative safe integer cents.`);
    }
    if (!Number.isInteger(carryForward.originTaxYear) || carryForward.originTaxYear < 1900 || carryForward.originTaxYear > 2025) {
      errors.push(`Carry-forward ${carryForward.type} has an invalid origin tax year.`);
    }
  }

  if (!OFFICIAL_SOURCE_IDS.has("cra-paper-filing")) errors.push("The required official paper-filing citation is unavailable.");
  return errors;
}

export function assertCaseFileCanBePrepared(caseFile: CraPdfCaseFileV1): EligibilityAssessment {
  const validationErrors = validateCaseFile(caseFile);
  if (validationErrors.length > 0) {
    throw new Error(`CRA PDF case file is invalid: ${validationErrors.join(" ")}`);
  }
  const assessment = assessEligibility(caseFile);
  if (!assessment.eligibleForAutomatedPreparation) {
    throw new Error(`CRA PDF preparation is blocked: ${assessment.findings.filter((finding) => finding.severity === "blocker").map((finding) => finding.message).join(" ")}`);
  }
  return assessment;
}

export function createPortableCarryForwardExport(
  caseFile: CraPdfCaseFileV1,
  exportedAt: string,
): PortableCarryForwardExportV1 {
  assertCaseFileCanBePrepared(caseFile);
  return {
    schemaVersion: "cra-carry-forward.v1",
    exportedAt,
    sourceTaxYear: caseFile.taxYear,
    province: caseFile.province,
    carryForwards: caseFile.carryForwards,
    exclusions: [
      "taxpayer identity",
      "social insurance number",
      "addresses",
      "attachments",
      "signatures",
      "PDF content",
    ],
  };
}

export function importPortableCarryForwards(value: PortableCarryForwardExportV1): PortableCarryForwardExportV1 {
  if (value.schemaVersion !== "cra-carry-forward.v1" || value.sourceTaxYear !== 2025 || value.province !== "ON") {
    throw new Error("Unsupported carry-forward export schema, tax year, or province.");
  }
  for (const entry of value.carryForwards) {
    if (!Number.isSafeInteger(entry.amountCents) || entry.amountCents < 0) {
      throw new Error(`Carry-forward ${entry.type} must be non-negative safe integer cents.`);
    }
  }
  return value;
}
