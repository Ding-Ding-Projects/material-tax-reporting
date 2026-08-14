export type SupportedDocumentKind =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/tiff"
  | "image/webp";

export type SupportedSlipType =
  | "T4"
  | "T4A"
  | "T4E"
  | "T5"
  | "T3"
  | "T5008"
  | "T2202"
  | "RRSP_RECEIPT";

export interface ParserLimits {
  readonly maxInputBytes: number;
  readonly maxPdfObjects: number;
  readonly maxPdfPages: number;
  readonly maxPdfStreamBytes: number;
  readonly maxImagePixels: number;
  readonly maxImageDimension: number;
  readonly maxExtractedTokens: number;
  readonly maxExtractedCharacters: number;
  readonly maxCandidateCount: number;
  readonly maxOcrPages: number;
  readonly maxOcrPagePixels: number;
  readonly maxOcrTotalPixels: number;
  readonly maxOcrRasterScale: number;
  readonly maxOcrDurationMs: number;
  readonly maxOcrMemoryBytes: number;
  readonly maxOcrConcurrency: number;
}

export const DEFAULT_PARSER_LIMITS: Readonly<ParserLimits> = Object.freeze({
  maxInputBytes: 20 * 1024 * 1024,
  maxPdfObjects: 25_000,
  maxPdfPages: 100,
  maxPdfStreamBytes: 8 * 1024 * 1024,
  maxImagePixels: 40_000_000,
  maxImageDimension: 16_384,
  maxExtractedTokens: 100_000,
  maxExtractedCharacters: 2_000_000,
  maxCandidateCount: 1_000,
  maxOcrPages: 25,
  maxOcrPagePixels: 12_000_000,
  maxOcrTotalPixels: 40_000_000,
  maxOcrRasterScale: 2.5,
  maxOcrDurationMs: 120_000,
  maxOcrMemoryBytes: 512 * 1024 * 1024,
  maxOcrConcurrency: 1,
});

export type ParserIssueSeverity = "info" | "warning" | "error";

export interface ParserIssue {
  readonly id: string;
  readonly code:
    | "input-empty"
    | "input-too-large"
    | "signature-mismatch"
    | "malformed-document"
    | "encrypted-document"
    | "unsupported-document"
    | "unsupported-adapter"
    | "adapter-runtime-unproven"
    | "adapter-failed"
    | "cancelled"
    | "processing-timeout"
    | "resource-limit"
    | "unclassified-slip"
    | "ambiguous-slip-type"
    | "missing-tax-year"
    | "ambiguous-tax-year"
    | "missing-field"
    | "ambiguous-field"
    | "low-confidence-field"
    | "review-only-mapping"
    | "stale-confirmation"
    | "incomplete-confirmation";
  readonly severity: ParserIssueSeverity;
  readonly message: string;
  readonly fieldId?: string;
}

export interface BoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TextEvidence {
  readonly text: string;
  readonly page: number;
  readonly bounds: BoundingBox;
  readonly coordinateSpace: "pdf-points-bottom-left" | "image-pixels-top-left";
  readonly confidence: number;
  readonly adapterId: string;
  readonly sourceDigest: string;
  readonly pageDigest: string;
  readonly evidenceDigest: string;
}

export interface ExtractedTextDocument {
  readonly pageCount: number;
  readonly tokens: readonly TextEvidence[];
  readonly warnings: readonly ParserIssue[];
  readonly evidenceDigest: string;
}

export interface BundledAdapterProof {
  readonly bundled: true;
  readonly declared: true;
  readonly declaredInPackage: `packages/slip-parser/${string}`;
  readonly artifactId: string;
  readonly artifactVersion: string;
  readonly runtimeId: string;
  readonly offline: true;
  readonly networkAccess: "forbidden";
  readonly telemetry: "none";
}

export interface TextExtractionAdapter {
  readonly id: string;
  readonly supportedKinds: readonly SupportedDocumentKind[];
  readonly proof: BundledAdapterProof;
  canExtract(document: AdmittedDocument): boolean;
  extract(
    document: AdmittedDocument,
    limits: Readonly<ParserLimits>,
    context?: Readonly<ExtractionContext>,
  ): Promise<AdapterExtractionResult>;
}

export interface ExtractionContext {
  readonly signal?: AbortSignal;
}

export type AdapterExtractionResult =
  | {
      readonly state: "extracted";
      readonly document: ExtractedTextDocument;
    }
  | {
      readonly state: "rejected";
      readonly issue: ParserIssue;
    };

export interface PdfAdmissionMetadata {
  readonly version: string;
  readonly objectCount: number;
  readonly pageCount: number | null;
  readonly encrypted: false;
}

export interface ImageAdmissionMetadata {
  readonly width: number;
  readonly height: number;
  readonly pixels: number;
}

export interface AdmittedDocument {
  readonly state: "admitted";
  readonly kind: SupportedDocumentKind;
  readonly sourceDigest: string;
  readonly bytes: Uint8Array;
  readonly pdf?: PdfAdmissionMetadata;
  readonly image?: ImageAdmissionMetadata;
}

export interface RejectedDocument {
  readonly state: "rejected";
  readonly issue: ParserIssue;
}

export type DocumentAdmissionResult = AdmittedDocument | RejectedDocument;

export interface ClassificationCandidate {
  readonly slipType: SupportedSlipType;
  readonly confidence: number;
  readonly evidence: readonly string[];
}

export interface SlipClassification {
  readonly slipType: SupportedSlipType;
  readonly confidence: number;
  readonly candidates: readonly ClassificationCandidate[];
}

export interface TaxYearDetection {
  readonly value: number | null;
  readonly confidence: number;
  readonly candidates: readonly number[];
}

export interface OfficialCitation {
  readonly title: string;
  readonly url: `https://www.canada.ca/${string}`;
  readonly retrievedOn: "2026-08-14";
}

export type MappingKind = "direct" | "formula" | "review-only";

export interface OfficialLineMapping {
  readonly kind: MappingKind;
  readonly target: string | null;
  readonly formula?: string;
  readonly explanation: string;
  readonly citation: OfficialCitation;
}

export interface SlipBoxDefinition {
  readonly box: string;
  readonly label: string;
  readonly aliases: readonly string[];
  readonly valueKind: "money" | "integer" | "date" | "text";
  readonly requiredForReview: boolean;
  readonly mappings: readonly OfficialLineMapping[];
}

export interface SlipDefinition {
  readonly slipType: SupportedSlipType;
  readonly title: string;
  readonly classificationTerms: readonly string[];
  readonly boxes: readonly SlipBoxDefinition[];
  readonly citation: OfficialCitation;
}

export interface NormalizedMoney {
  readonly kind: "money";
  readonly currency: "CAD";
  readonly decimal: string;
}

export interface NormalizedInteger {
  readonly kind: "integer";
  readonly value: number;
}

export interface NormalizedText {
  readonly kind: "text" | "date";
  readonly value: string;
}

export type NormalizedFieldValue =
  | NormalizedMoney
  | NormalizedInteger
  | NormalizedText;

export interface ExtractedBoxCandidate {
  readonly id: string;
  readonly box: string;
  readonly label: string;
  readonly rawValue: string;
  readonly normalizedValue: NormalizedFieldValue;
  readonly source: TextEvidence;
  readonly confidence: number;
  readonly alternatives: readonly {
    readonly rawValue: string;
    readonly normalizedValue: NormalizedFieldValue;
    readonly source: TextEvidence;
    readonly confidence: number;
  }[];
  readonly mappings: readonly OfficialLineMapping[];
  readonly status: "requires-manual-confirmation";
  readonly flags: readonly (
    | "ambiguous"
    | "low-confidence"
    | "review-only-mapping"
  )[];
}

export interface SlipParserDraft {
  readonly state: "requires-manual-confirmation";
  readonly schemaVersion: 1;
  readonly sourceDigest: string;
  readonly resultDigest: string;
  readonly documentKind: SupportedDocumentKind;
  readonly pageCount: number;
  readonly adapterId: string;
  readonly adapterArtifact: {
    readonly artifactId: string;
    readonly artifactVersion: string;
    readonly runtimeId: string;
  };
  readonly extractionEvidenceDigest: string;
  readonly classification: SlipClassification;
  readonly taxYear: TaxYearDetection;
  readonly candidates: readonly ExtractedBoxCandidate[];
  readonly missingRequiredBoxes: readonly string[];
  readonly issues: readonly ParserIssue[];
  readonly privacy: {
    readonly localOnly: true;
    readonly networkUsed: false;
    readonly telemetryUsed: false;
    readonly sourceDocumentRetained: false;
  };
  readonly deliveryBoundary: {
    readonly method: "cra-mail-in-pdf-only";
    readonly electronicSubmissionSupported: false;
    readonly automaticFilingSupported: false;
  };
}

export interface ManualFieldDecision {
  readonly candidateId: string;
  readonly decision: "accept" | "correct" | "exclude";
  readonly correctedValue?: NormalizedFieldValue;
}

export interface ManualReviewChecklist {
  readonly sourceShownSideBySide: true;
  readonly slipTypeConfirmed: true;
  readonly taxYearConfirmed: true;
  readonly everyCandidateReviewed: true;
  readonly extractionEvidenceReviewed: true;
  readonly everyAmbiguityResolved: true;
  readonly missingFieldsReviewed: true;
  readonly officialMappingsReviewed: true;
  readonly calculationsRequireFinalReview: true;
  readonly attachmentsRequireFinalReview: true;
  readonly mailingAddressRequiresFinalReview: true;
  readonly signatureFieldsRequireFinalReview: true;
  readonly everyPopulatedFormRequiresFinalReview: true;
}

export interface ManualReviewSubmission {
  readonly sourceDigest: string;
  readonly resultDigest: string;
  readonly reviewedAt: string;
  readonly confirmedSlipType: SupportedSlipType;
  readonly confirmedTaxYear: number;
  readonly fieldDecisions: readonly ManualFieldDecision[];
  readonly acknowledgedIssueIds: readonly string[];
  readonly checklist: ManualReviewChecklist;
}

export interface ConfirmedReturnSuggestion {
  readonly candidateId: string;
  readonly slipType: SupportedSlipType;
  readonly taxYear: number;
  readonly box: string;
  readonly value: NormalizedFieldValue;
  readonly mappings: readonly OfficialLineMapping[];
  readonly source: TextEvidence;
  readonly confirmedAt: string;
}

export interface ConfirmedSlipProjection {
  readonly state: "confirmed-for-return-entry";
  readonly schemaVersion: 1;
  readonly sourceDigest: string;
  readonly resultDigest: string;
  readonly slipType: SupportedSlipType;
  readonly taxYear: number;
  readonly suggestions: readonly ConfirmedReturnSuggestion[];
  readonly excludedCandidateIds: readonly string[];
  readonly acknowledgedIssueIds: readonly string[];
  readonly finalMailInReview: {
    readonly required: true;
    readonly items: readonly [
      "every populated form",
      "every calculation",
      "every attachment",
      "the CRA mailing address",
      "every signature field",
    ];
  };
  readonly deliveryBoundary: {
    readonly method: "cra-mail-in-pdf-only";
    readonly electronicSubmissionSupported: false;
    readonly automaticFilingSupported: false;
  };
}

export type ConfirmationResult =
  | {
      readonly state: "confirmed";
      readonly projection: ConfirmedSlipProjection;
    }
  | {
      readonly state: "rejected";
      readonly issues: readonly ParserIssue[];
    };

export type SlipParserResult =
  | SlipParserDraft
  | {
      readonly state: "rejected";
      readonly sourceDigest?: string;
      readonly issue: ParserIssue;
    };
