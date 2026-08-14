export { AdapterRegistry } from "./adapters.js";
export { admitDocument } from "./admission.js";
export {
  BUILTIN_PDF_TEXT_LAYER_ADAPTER,
  DECLARED_IMAGE_OCR_ADAPTERS,
} from "./builtin-pdf-text-layer.js";
export { classifySlip, detectTaxYear } from "./classification.js";
export { confirmSlipDraft } from "./confirmation.js";
export { extractBoxCandidates } from "./extraction.js";
export {
  OFFICIAL_CITATIONS,
  SLIP_DEFINITIONS,
  getSlipDefinition,
} from "./official-mappings.js";
export {
  CURRENT_OFFICIAL_MAPPING_TAX_YEAR,
  createDefaultAdapterRegistry,
  parseSlipDocument,
  type ParseSlipOptions,
} from "./parser.js";
export {
  DEFAULT_PARSER_LIMITS,
  type AdapterExtractionResult,
  type AdmittedDocument,
  type BoundingBox,
  type BundledAdapterProof,
  type ClassificationCandidate,
  type ConfirmationResult,
  type ConfirmedReturnSuggestion,
  type ConfirmedSlipProjection,
  type DocumentAdmissionResult,
  type ExtractedBoxCandidate,
  type ExtractedTextDocument,
  type ManualFieldDecision,
  type ManualReviewChecklist,
  type ManualReviewSubmission,
  type MappingKind,
  type NormalizedFieldValue,
  type OfficialCitation,
  type OfficialLineMapping,
  type ParserIssue,
  type ParserLimits,
  type PdfAdmissionMetadata,
  type RejectedDocument,
  type SlipBoxDefinition,
  type SlipClassification,
  type SlipDefinition,
  type SlipParserDraft,
  type SlipParserResult,
  type SupportedDocumentKind,
  type SupportedSlipType,
  type TaxYearDetection,
  type TextEvidence,
  type TextExtractionAdapter,
} from "./types.js";
