import { CRA_DOCUMENTS_2025 } from "../catalog/2025.ts";
import type {
  CalculationSnapshot,
  CraDocumentDefinition,
  CraDocumentId,
  DocumentFillPlan,
  SemanticFieldAssignment,
  TaxpayerIdentity,
} from "../types.ts";

const SUPPORTED_DOCUMENT_IDS = new Set<CraDocumentId>(CRA_DOCUMENTS_2025.map((entry) => entry.id));

export interface ParsedCalculationLine {
  readonly documentId: CraDocumentId;
  readonly line: string;
}

export function parseCalculationLineKey(key: string): ParsedCalculationLine | undefined {
  const separator = key.indexOf(":");
  if (separator < 1 || separator === key.length - 1) {
    return undefined;
  }

  const documentId = key.slice(0, separator) as CraDocumentId;
  const line = key.slice(separator + 1);
  if (!SUPPORTED_DOCUMENT_IDS.has(documentId) || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(line)) {
    return undefined;
  }

  return { documentId, line };
}

export function formatCentsForCraField(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new Error("CRA field amounts must be safe integer cents.");
  }
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

function identityAssignments(identity: TaxpayerIdentity): readonly SemanticFieldAssignment[] {
  return [
    { semanticField: "T1.identity.givenName", value: identity.givenName, source: { kind: "identity", path: "identity.givenName" } },
    { semanticField: "T1.identity.familyName", value: identity.familyName, source: { kind: "identity", path: "identity.familyName" } },
    { semanticField: "T1.identity.address.line1", value: identity.mailingAddress.line1, source: { kind: "identity", path: "identity.mailingAddress.line1" } },
    ...(identity.mailingAddress.line2 === undefined
      ? []
      : [{ semanticField: "T1.identity.address.line2", value: identity.mailingAddress.line2, source: { kind: "identity" as const, path: "identity.mailingAddress.line2" } }]),
    { semanticField: "T1.identity.address.city", value: identity.mailingAddress.city, source: { kind: "identity", path: "identity.mailingAddress.city" } },
    { semanticField: "T1.identity.address.province", value: identity.mailingAddress.province, source: { kind: "identity", path: "identity.mailingAddress.province" } },
    { semanticField: "T1.identity.address.postalCode", value: identity.mailingAddress.postalCode, source: { kind: "identity", path: "identity.mailingAddress.postalCode" } },
    { semanticField: "T1.identity.dateOfBirth", value: identity.dateOfBirth, source: { kind: "identity", path: "identity.dateOfBirth" } },
    { semanticField: "T1.identity.sin", value: identity.socialInsuranceNumber, source: { kind: "identity", path: "identity.socialInsuranceNumber" } },
    { semanticField: "T1.identity.maritalStatus", value: identity.maritalStatus, source: { kind: "identity", path: "identity.maritalStatus" } },
    { semanticField: "T1.identity.correspondenceLanguage", value: identity.correspondenceLanguage, source: { kind: "identity", path: "identity.correspondenceLanguage" } },
    { semanticField: "T1.residence.provinceOnDecember31", value: "ON", source: { kind: "constant", description: "Ontario package" } },
  ];
}

function isIncluded(definition: CraDocumentDefinition, calculation: CalculationSnapshot): boolean {
  return definition.inclusion === "always" ||
    (definition.inclusionFlag !== undefined && calculation.inclusionFlags[definition.inclusionFlag]);
}

export function createFillPlans2025(
  identity: TaxpayerIdentity,
  calculation: CalculationSnapshot,
): readonly DocumentFillPlan[] {
  const included = CRA_DOCUMENTS_2025.filter((definition) => isIncluded(definition, calculation));
  const fieldsByDocument = new Map<CraDocumentId, SemanticFieldAssignment[]>();
  const linesByDocument = new Map<CraDocumentId, string[]>();

  for (const definition of included) {
    fieldsByDocument.set(definition.id, definition.id === "T1" ? [...identityAssignments(identity)] : []);
    linesByDocument.set(definition.id, []);
  }

  for (const [key, cents] of Object.entries(calculation.federalLines)) {
    const parsed = parseCalculationLineKey(key);
    if (parsed === undefined || !fieldsByDocument.has(parsed.documentId)) {
      continue;
    }
    fieldsByDocument.get(parsed.documentId)?.push({
      semanticField: `${parsed.documentId}.line.${parsed.line}`,
      value: formatCentsForCraField(cents),
      source: { kind: "federal-line", line: key },
    });
    linesByDocument.get(parsed.documentId)?.push(key);
  }

  for (const [key, cents] of Object.entries(calculation.ontarioLines)) {
    const parsed = parseCalculationLineKey(key);
    if (parsed === undefined || !fieldsByDocument.has(parsed.documentId)) {
      continue;
    }
    fieldsByDocument.get(parsed.documentId)?.push({
      semanticField: `${parsed.documentId}.line.${parsed.line}`,
      value: formatCentsForCraField(cents),
      source: { kind: "ontario-line", line: key },
    });
    linesByDocument.get(parsed.documentId)?.push(key);
  }

  return included.map((definition) => ({
    documentId: definition.id,
    taxYear: 2025,
    officialTemplateUrl: definition.officialFillablePdfUrl,
    outputMode: definition.outputMode,
    fields: fieldsByDocument.get(definition.id) ?? [],
    calculationLines: linesByDocument.get(definition.id) ?? [],
    manualFields: definition.id === "T1"
      ? ["Taxpayer signature", "Signature date", "Telephone number if required by the current form"]
      : [],
  }));
}
