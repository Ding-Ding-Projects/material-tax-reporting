import { sha256Hex } from "./digest.js";
import type {
  ExtractedBoxCandidate,
  ExtractedTextDocument,
  NormalizedFieldValue,
  ParserIssue,
  ParserLimits,
  SlipDefinition,
  SlipBoxDefinition,
  TextEvidence,
} from "./types.js";

function normalizeLabel(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeValue(raw: string, definition: SlipBoxDefinition): NormalizedFieldValue | null {
  const trimmed = raw.trim();
  if (definition.valueKind === "money") {
    const negative = /^\(.*\)$/.test(trimmed);
    const cleaned = trimmed
      .replace(/[()]/g, "")
      .replace(/(?:CAD|CAN|\$)/gi, "")
      .replace(/[\s,]/g, "");
    if (!/^[+-]?\d{1,12}(?:\.\d{1,2})?$/.test(cleaned)) return null;
    const numeric = Number(cleaned);
    if (!Number.isFinite(numeric) || Math.abs(numeric) > 999_999_999_999.99) return null;
    const decimal = `${negative ? -Math.abs(numeric) : numeric}`;
    return { kind: "money", currency: "CAD", decimal };
  }
  if (definition.valueKind === "integer") {
    const cleaned = trimmed.replace(/\s+/g, "");
    if (!/^\d{1,4}$/.test(cleaned)) return null;
    return { kind: "integer", value: Number.parseInt(cleaned, 10) };
  }
  if (definition.valueKind === "date") {
    if (!/^\d{2,4}[-/]\d{1,2}(?:[-/]\d{1,2})?$/.test(trimmed)) return null;
    return { kind: "date", value: trimmed };
  }
  if (trimmed.length === 0 || trimmed.length > 256) return null;
  return { kind: "text", value: trimmed };
}

function tokenMatchesLabel(token: TextEvidence, definition: SlipBoxDefinition): number {
  const text = normalizeLabel(token.text);
  const box = normalizeLabel(definition.box);
  if (text === box || text === `BOX ${box}` || text === `CASE ${box}`) return 0.94;
  if (new RegExp(`(?:^| )BOX ${box}(?: |$)`).test(text)) return 0.92;
  const aliases = [definition.label, ...definition.aliases].map(normalizeLabel);
  if (aliases.some((alias) => alias.length >= 5 && text.includes(alias))) return 0.88;
  return 0;
}

function distanceScore(label: TextEvidence, value: TextEvidence, orderDistance: number): number {
  if (label.page !== value.page) return 0;
  const labelCenterY = label.bounds.y + label.bounds.height / 2;
  const valueCenterY = value.bounds.y + value.bounds.height / 2;
  const vertical = Math.abs(labelCenterY - valueCenterY);
  const horizontal = Math.abs(value.bounds.x - (label.bounds.x + label.bounds.width));
  const geometry = Math.max(0, 1 - (vertical / 180 + horizontal / 720));
  const order = Math.max(0, 1 - orderDistance / 14);
  return geometry * 0.55 + order * 0.45;
}

function findValueCandidates(
  document: ExtractedTextDocument,
  definition: SlipBoxDefinition,
): readonly {
  rawValue: string;
  normalizedValue: NormalizedFieldValue;
  source: TextEvidence;
  confidence: number;
}[] {
  const found: {
    rawValue: string;
    normalizedValue: NormalizedFieldValue;
    source: TextEvidence;
    confidence: number;
  }[] = [];
  for (let labelIndex = 0; labelIndex < document.tokens.length; labelIndex += 1) {
    const labelToken = document.tokens[labelIndex];
    if (!labelToken) continue;
    const labelConfidence = tokenMatchesLabel(labelToken, definition);
    if (labelConfidence === 0) continue;
    const end = Math.min(document.tokens.length, labelIndex + 15);
    for (let valueIndex = labelIndex + 1; valueIndex < end; valueIndex += 1) {
      const valueToken = document.tokens[valueIndex];
      if (!valueToken || valueToken.page !== labelToken.page) continue;
      const normalizedValue = normalizeValue(valueToken.text, definition);
      if (!normalizedValue) continue;
      const proximity = distanceScore(labelToken, valueToken, valueIndex - labelIndex);
      if (proximity < 0.2) continue;
      found.push({
        rawValue: valueToken.text,
        normalizedValue,
        source: valueToken,
        confidence: Math.min(0.99, labelConfidence * 0.55 + proximity * 0.25 + valueToken.confidence * 0.2),
      });
    }
  }
  const unique = new Map<string, (typeof found)[number]>();
  for (const candidate of found) {
    const key = `${candidate.source.page}:${candidate.source.bounds.x}:${candidate.source.bounds.y}:${candidate.rawValue}`;
    const prior = unique.get(key);
    if (!prior || candidate.confidence > prior.confidence) unique.set(key, candidate);
  }
  return [...unique.values()].sort((left, right) => right.confidence - left.confidence);
}

export function extractBoxCandidates(
  document: ExtractedTextDocument,
  definition: SlipDefinition,
  sourceDigest: string,
  limits: Readonly<ParserLimits>,
): {
  readonly candidates: readonly ExtractedBoxCandidate[];
  readonly missingRequiredBoxes: readonly string[];
  readonly issues: readonly ParserIssue[];
} {
  const candidates: ExtractedBoxCandidate[] = [];
  const missingRequiredBoxes: string[] = [];
  const issues: ParserIssue[] = [];

  for (const boxDefinition of definition.boxes) {
    const values = findValueCandidates(document, boxDefinition);
    const best = values[0];
    if (!best) {
      if (boxDefinition.requiredForReview) {
        missingRequiredBoxes.push(boxDefinition.box);
        issues.push({
          id: `field:${definition.slipType}:${boxDefinition.box}:missing`,
          code: "missing-field",
          severity: "warning",
          message: `${definition.slipType} box ${boxDefinition.box} was not extracted and must be checked manually.`,
        });
      }
      continue;
    }
    if (candidates.length >= limits.maxCandidateCount) {
      issues.push({
        id: "field:candidate-limit",
        code: "resource-limit",
        severity: "error",
        message: "The extracted field candidate count exceeds the configured limit.",
      });
      break;
    }
    const competing = values.filter((candidate) => best.confidence - candidate.confidence < 0.08).slice(1, 6);
    const flags: ("ambiguous" | "low-confidence" | "review-only-mapping")[] = [];
    if (competing.length > 0) flags.push("ambiguous");
    if (best.confidence < 0.82) flags.push("low-confidence");
    if (boxDefinition.mappings.some((mapping) => mapping.kind !== "direct")) flags.push("review-only-mapping");
    const id = `candidate:${sha256Hex(`${sourceDigest}:${definition.slipType}:${boxDefinition.box}:${best.source.page}:${best.source.bounds.x}:${best.source.bounds.y}:${best.rawValue}`).slice(0, 24)}`;
    candidates.push({
      id,
      box: boxDefinition.box,
      label: boxDefinition.label,
      rawValue: best.rawValue,
      normalizedValue: best.normalizedValue,
      source: best.source,
      confidence: best.confidence,
      alternatives: competing,
      mappings: boxDefinition.mappings,
      status: "requires-manual-confirmation",
      flags,
    });
    if (flags.includes("ambiguous")) {
      issues.push({ id: `${id}:ambiguous`, code: "ambiguous-field", severity: "warning", fieldId: id, message: `${definition.slipType} box ${boxDefinition.box} has multiple plausible values and requires correction or exclusion.` });
    }
    if (flags.includes("low-confidence")) {
      issues.push({ id: `${id}:low-confidence`, code: "low-confidence-field", severity: "warning", fieldId: id, message: `${definition.slipType} box ${boxDefinition.box} is below the automatic-confidence threshold and requires side-by-side review.` });
    }
    if (flags.includes("review-only-mapping")) {
      issues.push({ id: `${id}:review-only`, code: "review-only-mapping", severity: "info", fieldId: id, message: `${definition.slipType} box ${boxDefinition.box} has a formula or contextual mapping that is never applied automatically.` });
    }
  }
  return {
    candidates: Object.freeze(candidates),
    missingRequiredBoxes: Object.freeze(missingRequiredBoxes),
    issues: Object.freeze(issues),
  };
}
