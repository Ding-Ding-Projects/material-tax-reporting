import { AdapterRegistry } from "./adapters.js";
import { admitDocument } from "./admission.js";
import { BUILTIN_PDF_TEXT_LAYER_ADAPTER } from "./builtin-pdf-text-layer.js";
import { classifySlip, detectTaxYear } from "./classification.js";
import { sha256Hex, stableJson } from "./digest.js";
import { extractBoxCandidates } from "./extraction.js";
import { getSlipDefinition } from "./official-mappings.js";
import { BUNDLED_OFFLINE_OCR_ADAPTER } from "./offline-ocr.js";
import {
  DEFAULT_PARSER_LIMITS,
  type ExtractedBoxCandidate,
  type OfficialLineMapping,
  type ParserIssue,
  type ParserLimits,
  type SlipParserDraft,
  type SlipParserResult,
} from "./types.js";

export const CURRENT_OFFICIAL_MAPPING_TAX_YEAR = 2025;

export interface ParseSlipOptions {
  readonly limits?: Readonly<ParserLimits>;
  readonly adapterRegistry?: AdapterRegistry;
  readonly signal?: AbortSignal;
}

export function createDefaultAdapterRegistry(): AdapterRegistry {
  return new AdapterRegistry([
    BUILTIN_PDF_TEXT_LAYER_ADAPTER,
    BUNDLED_OFFLINE_OCR_ADAPTER,
  ]);
}

function reject(
  issue: ParserIssue,
  sourceDigest?: string,
): SlipParserResult {
  return sourceDigest === undefined
    ? { state: "rejected", issue }
    : { state: "rejected", sourceDigest, issue };
}

function yearSafeMappings(
  candidate: ExtractedBoxCandidate,
  taxYear: number | null,
): ExtractedBoxCandidate {
  if (taxYear === CURRENT_OFFICIAL_MAPPING_TAX_YEAR) return candidate;
  const mappings: OfficialLineMapping[] = candidate.mappings.map((mapping) => ({
    kind: "review-only",
    target: null,
    explanation: `${mapping.explanation} This parser's cited mapping set is for tax year ${CURRENT_OFFICIAL_MAPPING_TAX_YEAR}; revalidate the relationship against the official package for the confirmed tax year before entry.`,
    citation: mapping.citation,
  }));
  const flags = candidate.flags.includes("review-only-mapping")
    ? candidate.flags
    : [...candidate.flags, "review-only-mapping" as const];
  return { ...candidate, mappings: Object.freeze(mappings), flags: Object.freeze(flags) };
}

function draftDigestPayload(draft: Omit<SlipParserDraft, "resultDigest">): unknown {
  return {
    schemaVersion: draft.schemaVersion,
    sourceDigest: draft.sourceDigest,
    documentKind: draft.documentKind,
    pageCount: draft.pageCount,
    adapterId: draft.adapterId,
    adapterArtifact: draft.adapterArtifact,
    extractionEvidenceDigest: draft.extractionEvidenceDigest,
    classification: draft.classification,
    taxYear: draft.taxYear,
    candidates: draft.candidates,
    missingRequiredBoxes: draft.missingRequiredBoxes,
    issues: draft.issues,
    deliveryBoundary: draft.deliveryBoundary,
  };
}

export async function parseSlipDocument(
  sourceBytes: Uint8Array,
  options: Readonly<ParseSlipOptions> = {},
): Promise<SlipParserResult> {
  const limits = options.limits ?? DEFAULT_PARSER_LIMITS;
  const admission = admitDocument(sourceBytes, limits);
  if (admission.state === "rejected") return reject(admission.issue);

  const registry = options.adapterRegistry ?? createDefaultAdapterRegistry();
  const adapters = registry.selectAll(admission);
  if (adapters.length === 0) {
    const runtimeIssue = registry.registrationIssues[0];
    return reject(
      runtimeIssue ?? {
        id: `adapter:none:${admission.kind}`,
        code: "unsupported-adapter",
        severity: "error",
        message:
          admission.kind.startsWith("image/")
            ? "No package-declared bundled offline OCR adapter is enabled for this image. Cloud OCR and telemetry are not permitted, and no partial data was returned."
            : "No package-declared bundled offline text extraction adapter is enabled for this document.",
      },
      admission.sourceDigest,
    );
  }

  try {
    let selectedAdapter = adapters[0]!;
    let extraction = await selectedAdapter.extract(admission, limits, {
      ...(options.signal ? { signal: options.signal } : {}),
    });
    for (
      let index = 1;
      extraction.state === "rejected" &&
      extraction.issue.code === "unsupported-adapter" &&
      index < adapters.length;
      index += 1
    ) {
      selectedAdapter = adapters[index]!;
      extraction = await selectedAdapter.extract(admission, limits, {
        ...(options.signal ? { signal: options.signal } : {}),
      });
    }
    if (extraction.state === "rejected") {
      return reject(extraction.issue, admission.sourceDigest);
    }

    const classified = classifySlip(extraction.document);
    if (!classified.classification) {
      return reject(
        {
          id: classified.ambiguous ? "classification:ambiguous" : "classification:unknown",
          code: classified.ambiguous ? "ambiguous-slip-type" : "unclassified-slip",
          severity: "error",
          message: classified.ambiguous
            ? "The slip type is ambiguous. Select the correct slip type beside the source and parse it again; no partial fields were returned."
            : "The document is not one of the supported Canadian slip or receipt types. No partial fields were returned.",
        },
        admission.sourceDigest,
      );
    }

    const taxYear = detectTaxYear(extraction.document);
    const definition = getSlipDefinition(classified.classification.slipType);
    const extracted = extractBoxCandidates(
      extraction.document,
      definition,
      admission.sourceDigest,
      limits,
    );
    if (extracted.issues.some((candidateIssue) => candidateIssue.severity === "error")) {
      return reject(
        extracted.issues.find((candidateIssue) => candidateIssue.severity === "error")!,
        admission.sourceDigest,
      );
    }

    const issues: ParserIssue[] = [
      ...extraction.document.warnings,
      ...extracted.issues,
    ];
    if (taxYear.value === null) {
      issues.push({
        id: "tax-year:missing-or-ambiguous",
        code: taxYear.candidates.length > 1 ? "ambiguous-tax-year" : "missing-tax-year",
        severity: "warning",
        message: "The tax year could not be determined uniquely. It must be confirmed beside the source before any field can enter a return.",
      });
    } else if (taxYear.value !== CURRENT_OFFICIAL_MAPPING_TAX_YEAR) {
      issues.push({
        id: `tax-year:mapping-review:${taxYear.value}`,
        code: "review-only-mapping",
        severity: "warning",
        message: `The detected tax year is ${taxYear.value}, while the bundled cited mapping set is ${CURRENT_OFFICIAL_MAPPING_TAX_YEAR}. All line relationships are review-only until revalidated against that year's official CRA package.`,
      });
    }
    const candidates = extracted.candidates.map((candidate) => yearSafeMappings(candidate, taxYear.value));
    const withoutDigest: Omit<SlipParserDraft, "resultDigest"> = {
      state: "requires-manual-confirmation",
      schemaVersion: 1,
      sourceDigest: admission.sourceDigest,
      documentKind: admission.kind,
      pageCount: extraction.document.pageCount,
      adapterId: selectedAdapter.id,
      adapterArtifact: {
        artifactId: selectedAdapter.proof.artifactId,
        artifactVersion: selectedAdapter.proof.artifactVersion,
        runtimeId: selectedAdapter.proof.runtimeId,
      },
      extractionEvidenceDigest: extraction.document.evidenceDigest,
      classification: classified.classification,
      taxYear,
      candidates: Object.freeze(candidates),
      missingRequiredBoxes: extracted.missingRequiredBoxes,
      issues: Object.freeze(issues),
      privacy: {
        localOnly: true,
        networkUsed: false,
        telemetryUsed: false,
        sourceDocumentRetained: false,
      },
      deliveryBoundary: {
        method: "cra-mail-in-pdf-only",
        electronicSubmissionSupported: false,
        automaticFilingSupported: false,
      },
    };
    const resultDigest = sha256Hex(stableJson(draftDigestPayload(withoutDigest)));
    return Object.freeze({ ...withoutDigest, resultDigest });
  } catch {
    return reject(
      {
        id: "adapter:unexpected-failure",
        code: "adapter-failed",
        severity: "error",
        message: "Local document extraction failed. No source content was logged and no partial data was returned.",
      },
      admission.sourceDigest,
    );
  }
}
