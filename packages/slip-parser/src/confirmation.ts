import type {
  ConfirmationResult,
  ConfirmedReturnSuggestion,
  ManualReviewChecklist,
  ManualReviewSubmission,
  ParserIssue,
  SlipParserDraft,
} from "./types.js";

const REQUIRED_CHECKLIST_KEYS: readonly (keyof ManualReviewChecklist)[] = Object.freeze([
  "sourceShownSideBySide",
  "slipTypeConfirmed",
  "taxYearConfirmed",
  "everyCandidateReviewed",
  "extractionEvidenceReviewed",
  "everyAmbiguityResolved",
  "missingFieldsReviewed",
  "officialMappingsReviewed",
  "calculationsRequireFinalReview",
  "attachmentsRequireFinalReview",
  "mailingAddressRequiresFinalReview",
  "signatureFieldsRequireFinalReview",
  "everyPopulatedFormRequiresFinalReview",
]);

function rejection(id: string, code: ParserIssue["code"], message: string): ParserIssue {
  return { id, code, severity: "error", message };
}

export function confirmSlipDraft(
  draft: Readonly<SlipParserDraft>,
  submission: Readonly<ManualReviewSubmission>,
): ConfirmationResult {
  const issues: ParserIssue[] = [];
  if (submission.sourceDigest !== draft.sourceDigest || submission.resultDigest !== draft.resultDigest) {
    issues.push(rejection("confirmation:stale", "stale-confirmation", "The manual confirmation does not match this source document and parser result."));
  }
  if (submission.confirmedSlipType !== draft.classification.slipType) {
    issues.push(rejection("confirmation:slip-type", "stale-confirmation", "Changing the slip type requires parsing the source again with the corrected classification."));
  }
  if (draft.taxYear.value !== null && submission.confirmedTaxYear !== draft.taxYear.value) {
    issues.push(rejection("confirmation:tax-year", "stale-confirmation", "Changing a detected tax year requires parsing the source again against that year's official mapping set."));
  }
  if (!Number.isInteger(submission.confirmedTaxYear) || submission.confirmedTaxYear < 2000 || submission.confirmedTaxYear > 2099) {
    issues.push(rejection("confirmation:invalid-tax-year", "incomplete-confirmation", "The confirmed tax year is invalid."));
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(submission.reviewedAt)) {
    issues.push(rejection("confirmation:review-time", "incomplete-confirmation", "The review time must be a UTC ISO-8601 timestamp."));
  }
  for (const key of REQUIRED_CHECKLIST_KEYS) {
    if (submission.checklist[key] !== true) {
      issues.push(rejection(`confirmation:checklist:${key}`, "incomplete-confirmation", `Required manual review item ${key} was not confirmed.`));
    }
  }

  const decisions = new Map<string, (typeof submission.fieldDecisions)[number]>();
  for (const decision of submission.fieldDecisions) {
    if (decisions.has(decision.candidateId)) {
      issues.push(rejection(`confirmation:duplicate:${decision.candidateId}`, "incomplete-confirmation", "A field candidate has more than one decision."));
      continue;
    }
    decisions.set(decision.candidateId, decision);
  }
  const candidateIds = new Set(draft.candidates.map((candidate) => candidate.id));
  for (const decisionId of decisions.keys()) {
    if (!candidateIds.has(decisionId)) {
      issues.push(rejection(`confirmation:unknown:${decisionId}`, "stale-confirmation", "A field decision refers to a candidate that is not in this parser result."));
    }
  }
  for (const candidate of draft.candidates) {
    const decision = decisions.get(candidate.id);
    if (!decision) {
      issues.push(rejection(`confirmation:missing:${candidate.id}`, "incomplete-confirmation", `No decision was supplied for ${candidate.label}.`));
      continue;
    }
    if (decision.decision === "correct" && decision.correctedValue === undefined) {
      issues.push(rejection(`confirmation:correction:${candidate.id}`, "incomplete-confirmation", `A corrected value is required for ${candidate.label}.`));
    }
    if (decision.decision !== "correct" && decision.correctedValue !== undefined) {
      issues.push(rejection(`confirmation:unexpected-correction:${candidate.id}`, "incomplete-confirmation", `A corrected value may only accompany a correct decision for ${candidate.label}.`));
    }
    if (candidate.flags.includes("ambiguous") && decision.decision === "accept") {
      issues.push(rejection(`confirmation:ambiguous:${candidate.id}`, "incomplete-confirmation", `The ambiguous value for ${candidate.label} must be corrected or excluded.`));
    }
  }
  const acknowledged = new Set(submission.acknowledgedIssueIds);
  for (const parserIssue of draft.issues) {
    if (!acknowledged.has(parserIssue.id)) {
      issues.push(rejection(`confirmation:issue:${parserIssue.id}`, "incomplete-confirmation", "Every parser warning and contextual mapping notice must be acknowledged."));
    }
  }
  if (issues.length > 0) return { state: "rejected", issues: Object.freeze(issues) };

  const suggestions: ConfirmedReturnSuggestion[] = [];
  const excludedCandidateIds: string[] = [];
  for (const candidate of draft.candidates) {
    const decision = decisions.get(candidate.id);
    if (!decision) continue;
    if (decision.decision === "exclude") {
      excludedCandidateIds.push(candidate.id);
      continue;
    }
    suggestions.push({
      candidateId: candidate.id,
      slipType: submission.confirmedSlipType,
      taxYear: submission.confirmedTaxYear,
      box: candidate.box,
      value: decision.decision === "correct" ? decision.correctedValue! : candidate.normalizedValue,
      mappings: candidate.mappings,
      source: candidate.source,
      confirmedAt: submission.reviewedAt,
    });
  }
  return {
    state: "confirmed",
    projection: {
      state: "confirmed-for-return-entry",
      schemaVersion: 1,
      sourceDigest: draft.sourceDigest,
      resultDigest: draft.resultDigest,
      slipType: submission.confirmedSlipType,
      taxYear: submission.confirmedTaxYear,
      suggestions: Object.freeze(suggestions),
      excludedCandidateIds: Object.freeze(excludedCandidateIds),
      acknowledgedIssueIds: Object.freeze([...acknowledged]),
      finalMailInReview: {
        required: true,
        items: [
          "every populated form",
          "every calculation",
          "every attachment",
          "the CRA mailing address",
          "every signature field",
        ],
      },
      deliveryBoundary: {
        method: "cra-mail-in-pdf-only",
        electronicSubmissionSupported: false,
        automaticFilingSupported: false,
      },
    },
  };
}
