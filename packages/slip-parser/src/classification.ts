import { SLIP_DEFINITIONS } from "./official-mappings.js";
import type {
  ClassificationCandidate,
  ExtractedTextDocument,
  SlipClassification,
  TaxYearDetection,
} from "./types.js";

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifySlip(document: ExtractedTextDocument): {
  readonly classification: SlipClassification | null;
  readonly ambiguous: boolean;
  readonly candidates: readonly ClassificationCandidate[];
} {
  const corpus = normalize(document.tokens.map((token) => token.text).join(" "));
  const candidates = SLIP_DEFINITIONS.map((definition): ClassificationCandidate => {
    const evidence: string[] = [];
    let score = 0;
    for (const term of definition.classificationTerms) {
      const normalizedTerm = normalize(term);
      if (normalizedTerm.length > 0 && corpus.includes(normalizedTerm)) {
        evidence.push(term);
        score += normalizedTerm === definition.slipType ? 0.56 : 0.28;
      }
    }
    const explicitCode = new RegExp(`(?:^|\\s)${definition.slipType.replace("_", " ")}(?:\\s|$)`).test(corpus);
    if (explicitCode) score += 0.3;
    return {
      slipType: definition.slipType,
      confidence: Math.min(0.99, score),
      evidence: Object.freeze(evidence),
    };
  })
    .filter((candidate) => candidate.confidence > 0)
    .sort((left, right) => right.confidence - left.confidence);

  const first = candidates[0];
  const second = candidates[1];
  if (!first || first.confidence < 0.55) {
    return { classification: null, ambiguous: false, candidates };
  }
  const ambiguous = Boolean(second && first.confidence - second.confidence < 0.18);
  if (ambiguous) {
    return { classification: null, ambiguous: true, candidates };
  }
  return {
    classification: {
      slipType: first.slipType,
      confidence: first.confidence,
      candidates,
    },
    ambiguous: false,
    candidates,
  };
}

export function detectTaxYear(document: ExtractedTextDocument): TaxYearDetection {
  const counts = new Map<number, number>();
  const explicitCounts = new Map<number, number>();
  for (const token of document.tokens) {
    const text = normalize(token.text);
    const yearPattern = /(?:^|\s)(20\d{2})(?:\s|$)/g;
    let yearMatch: RegExpExecArray | null;
    while ((yearMatch = yearPattern.exec(text)) !== null) {
      const year = Number.parseInt(yearMatch[1] ?? "", 10);
      if (year >= 2000 && year <= 2099) counts.set(year, (counts.get(year) ?? 0) + 1);
    }
    const explicitPattern = /(?:TAX YEAR|YEAR|ANNEE D IMPOSITION|ANNEE)\s*[: -]?\s*(20\d{2})/g;
    let explicitMatch: RegExpExecArray | null;
    while ((explicitMatch = explicitPattern.exec(text)) !== null) {
      const year = Number.parseInt(explicitMatch[1] ?? "", 10);
      if (year >= 2000 && year <= 2099) explicitCounts.set(year, (explicitCounts.get(year) ?? 0) + 1);
    }
  }
  const candidates = [...new Set([...explicitCounts.keys(), ...counts.keys()])].sort((left, right) => {
    const leftScore = (explicitCounts.get(left) ?? 0) * 4 + (counts.get(left) ?? 0);
    const rightScore = (explicitCounts.get(right) ?? 0) * 4 + (counts.get(right) ?? 0);
    return rightScore - leftScore;
  });
  const selected = candidates[0] ?? null;
  if (selected === null) return { value: null, confidence: 0, candidates: [] };
  const selectedScore = (explicitCounts.get(selected) ?? 0) * 4 + (counts.get(selected) ?? 0);
  const runnerUp = candidates[1];
  const runnerUpScore = runnerUp === undefined ? 0 : (explicitCounts.get(runnerUp) ?? 0) * 4 + (counts.get(runnerUp) ?? 0);
  const confidence = Math.min(0.98, explicitCounts.has(selected) ? 0.9 : 0.62);
  return {
    value: selectedScore === runnerUpScore ? null : selected,
    confidence: selectedScore === runnerUpScore ? 0.35 : confidence,
    candidates,
  };
}
