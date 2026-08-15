import type {
  CraDocumentId,
  DocumentFillPlan,
  PrintAuthorization,
  SemanticFieldAssignment,
  SupportedTaxYear,
} from "./types.ts";

export interface LocalPdfAdapterCapabilities {
  readonly networkAccess: "disabled";
  readonly storage: "local-only";
  readonly atomicWrites: true;
  readonly supportedOperations: readonly ["inspect", "fill", "overlay", "merge", "preview", "export", "print"];
  readonly prohibitedOperations: readonly [
    "NETFILE",
    "EFILE",
    "electronic submission",
    "direct CRA transmission",
    "simulated filing",
    "automatic filing"
  ];
}

export interface LocalPdfReference {
  readonly localHandle: string;
  readonly displayName: string;
}

export interface LocalTemplateSelection extends LocalPdfReference {
  readonly documentId: CraDocumentId;
  readonly taxYear: SupportedTaxYear;
  readonly officialSourceUrl: string;
}

export interface PdfFieldProfile {
  readonly schemaVersion: "cra-pdf-field-profile.v1";
  readonly documentId: CraDocumentId;
  readonly taxYear: SupportedTaxYear;
  readonly officialSourceUrl: string;
  readonly templateSha256: string;
  readonly verification: "host-pinned-official-sha256";
  readonly semanticToPhysicalField: Readonly<Record<string, string>>;
}

export interface PdfInspection {
  readonly validPdf: boolean;
  readonly pageCount: number;
  readonly sha256: string;
  readonly encrypted: boolean;
  readonly activeContentDetected: boolean;
  readonly embeddedFilesDetected: boolean;
  readonly physicalFields: readonly string[];
}

export interface PreparedPdfArtifact extends LocalPdfReference {
  readonly pageCount: number;
  readonly sha256: string;
}

export interface LocalPdfAdapter {
  readonly capabilities: LocalPdfAdapterCapabilities;
  inspect(input: LocalPdfReference): Promise<PdfInspection>;
  fillOfficialTemplate(
    template: LocalTemplateSelection,
    assignments: readonly Readonly<{ physicalField: string; value: string | boolean }>[]
  ): Promise<PreparedPdfArtifact>;
  overlayOfficialPrintTemplate(
    template: LocalTemplateSelection,
    assignments: readonly SemanticFieldAssignment[]
  ): Promise<PreparedPdfArtifact>;
  merge(inputs: readonly PreparedPdfArtifact[]): Promise<PreparedPdfArtifact>;
  preview(input: PreparedPdfArtifact): Promise<LocalPdfReference>;
  exportAtomically(input: PreparedPdfArtifact, destinationLocalHandle: string, authorization: PrintAuthorization): Promise<void>;
  printLocally(input: PreparedPdfArtifact, authorization: PrintAuthorization): Promise<void>;
}

export function assertLocalOnlyAdapter(adapter: LocalPdfAdapter): void {
  const capabilities = adapter.capabilities;
  if (capabilities.networkAccess !== "disabled" || capabilities.storage !== "local-only" || capabilities.atomicWrites !== true) {
    throw new Error("The PDF adapter must disable network access, use local-only storage, and perform atomic writes.");
  }
  const requiredProhibitions = [
    "NETFILE",
    "EFILE",
    "electronic submission",
    "direct CRA transmission",
    "simulated filing",
    "automatic filing",
  ] as const;
  for (const prohibition of requiredProhibitions) {
    if (!capabilities.prohibitedOperations.includes(prohibition)) {
      throw new Error(`The PDF adapter does not declare the required prohibition: ${prohibition}.`);
    }
  }
}

export function mapSemanticFields(
  plan: DocumentFillPlan,
  profile: PdfFieldProfile,
  inspection: PdfInspection,
): readonly Readonly<{ physicalField: string; value: string | boolean }>[] {
  if (profile.schemaVersion !== "cra-pdf-field-profile.v1" || profile.taxYear !== plan.taxYear || profile.documentId !== plan.documentId) {
    throw new Error(`Field profile does not match ${plan.documentId} for tax year ${plan.taxYear}.`);
  }
  if (profile.officialSourceUrl !== plan.officialTemplateUrl || profile.templateSha256.toLowerCase() !== inspection.sha256.toLowerCase()) {
    throw new Error(`Field profile source or pinned template digest does not match ${plan.documentId}.`);
  }
  if (profile.verification !== "host-pinned-official-sha256") {
    throw new Error(`Field profile for ${plan.documentId} is not pinned to a host-verified official template digest.`);
  }
  const available = new Set(inspection.physicalFields);
  return plan.fields.map((assignment) => {
    const physicalField = profile.semanticToPhysicalField[assignment.semanticField];
    if (physicalField === undefined || !available.has(physicalField)) {
      throw new Error(`No verified physical PDF field maps semantic field ${assignment.semanticField}.`);
    }
    return { physicalField, value: assignment.value };
  });
}

export function assertSafePdf(inspection: PdfInspection, label: string): void {
  if (!inspection.validPdf || inspection.pageCount < 1) throw new Error(`${label} is not a valid non-empty PDF.`);
  if (!/^[a-f0-9]{64}$/i.test(inspection.sha256)) throw new Error(`${label} has no valid SHA-256 digest.`);
  if (inspection.encrypted) throw new Error(`${label} is encrypted and cannot be processed safely.`);
  if (inspection.activeContentDetected) throw new Error(`${label} contains active PDF content and was rejected.`);
  if (inspection.embeddedFilesDetected) throw new Error(`${label} contains embedded files and was rejected.`);
}
