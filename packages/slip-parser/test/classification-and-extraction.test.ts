/**
 * Recognising which slip a document is, and pulling box values off it.
 *
 * Both stages are allowed to fail, and failing loudly is the point: a slip the
 * parser cannot identify must produce nothing rather than a confident guess,
 * and a value it is unsure of must be flagged for correction rather than
 * quietly entered on a return. Several of the assertions below are therefore
 * about refusals and flags rather than about extracted numbers.
 *
 * Every fixture is synthetic. None is a real tax slip.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { useTypeScriptSources } from "./typescript-source-resolver.ts";

useTypeScriptSources();

const { classifySlip, detectTaxYear } = await import("../src/classification.ts");
const { extractBoxCandidates } = await import("../src/extraction.ts");
const { getSlipDefinition } = await import("../src/official-mappings.ts");
const { DEFAULT_PARSER_LIMITS } = await import("../src/types.ts");

/** One recognised piece of text with a position on a page. */
const token = (text: string, x: number, y: number, page = 1) => ({
  text,
  page,
  bounds: { x, y, width: 40, height: 10 },
  coordinateSpace: "pdf-points-bottom-left" as const,
  confidence: 0.99,
  adapterId: "synthetic-test-adapter",
  sourceDigest: "synthetic-source",
  pageDigest: "synthetic-page",
  evidenceDigest: "synthetic-evidence",
});

const documentOf = (tokens: ReturnType<typeof token>[]) => ({
  pageCount: 1,
  tokens,
  warnings: [],
  evidenceDigest: "synthetic-evidence",
});

const words = (...text: string[]) => documentOf(text.map((entry, index) => token(entry, 0, 700 - index * 20)));

test("a document carrying its slip code and title is classified", () => {
  const result = classifySlip(words("T4", "Statement of Remuneration Paid"));

  assert.equal(result.ambiguous, false);
  assert.equal(result.classification?.slipType, "T4");
  assert.ok(result.classification.confidence >= 0.55);
  assert.ok(result.classification.confidence <= 0.99, "confidence is capped rather than unbounded");
});

test("each supported slip type is recognised from its own code and title", () => {
  const cases: readonly [string, string][] = [
    ["T4A", "Statement of Pension, Retirement, Annuity, and Other Income"],
    ["T4E", "Statement of Employment Insurance and Other Benefits"],
    ["T5", "Statement of Investment Income"],
    ["T3", "Statement of Trust Income Allocations and Designations"],
    ["T5008", "Statement of Securities Transactions"],
    ["T2202", "Tuition and Enrolment Certificate"],
  ];

  for (const [code, title] of cases) {
    const result = classifySlip(words(code, title));
    assert.equal(result.classification?.slipType, code, `${code} must be recognised`);
  }
});

test("a longer slip code wins over the shorter one it contains", () => {
  // "T4" is a substring of "T4A" and "T5" of "T5008", so a naive match would
  // classify a pension slip as an employment slip and file the income wrongly.
  assert.equal(classifySlip(words("T4A", "Statement of Pension")).classification?.slipType, "T4A");
  assert.equal(
    classifySlip(words("T5008", "Statement of Securities Transactions")).classification?.slipType,
    "T5008",
  );
});

test("a document that looks equally like two slips is refused as ambiguous", () => {
  const result = classifySlip(words("T4", "T4A"));

  assert.equal(result.ambiguous, true);
  assert.equal(result.classification, null, "an ambiguous document yields no classification at all");
  assert.ok(result.candidates.length >= 2);
});

test("a document that is not a supported slip is refused rather than guessed", () => {
  const result = classifySlip(words("Grocery receipt", "Total 12.40", "Thank you"));

  assert.equal(result.classification, null);
  assert.equal(result.ambiguous, false, "unrecognised is not the same as ambiguous");
});

test("classification survives accents and punctuation in the French title", () => {
  const result = classifySlip(words("T4", "État de la rémunération payée"));
  assert.equal(result.classification?.slipType, "T4");
});

test("an explicitly labelled tax year is detected with high confidence", () => {
  const detection = detectTaxYear(words("T4", "Tax year 2025", "Employment income"));

  assert.equal(detection.value, 2025);
  assert.ok(detection.confidence >= 0.9, "an explicit label is stronger evidence than a bare number");
  assert.ok(detection.candidates.includes(2025));
});

test("a bare year is detected with lower confidence than a labelled one", () => {
  const bare = detectTaxYear(words("T4", "2025", "Employment income"));
  const labelled = detectTaxYear(words("T4", "Tax year 2025", "Employment income"));

  assert.equal(bare.value, 2025);
  assert.ok(bare.confidence < labelled.confidence);
});

test("a labelled year outranks a bare year mentioned elsewhere", () => {
  const detection = detectTaxYear(words("Tax year 2025", "Printed 2026", "Employment income"));
  assert.equal(detection.value, 2025);
});

test("a document with no year yields nothing rather than a default", () => {
  const detection = detectTaxYear(words("T4", "Employment income"));

  assert.equal(detection.value, null);
  assert.equal(detection.confidence, 0);
  assert.deepEqual([...detection.candidates], []);
});

test("two equally supported years are reported as undecided", () => {
  // Guessing between them would silently apply one year's mapping set to a slip
  // from another, so the parser must decline and let a person choose.
  const detection = detectTaxYear(words("Tax year 2024", "Tax year 2025"));

  assert.equal(detection.value, null);
  assert.ok(detection.confidence < 0.5);
  assert.equal(detection.candidates.length, 2);
});

/**
 * KNOWN DEFECT, pinned deliberately.
 *
 * The bare-year pattern requires the trailing separator and consumes it, so in
 * a single token reading "2024 2025" the shared space is eaten by the first
 * match and the second year is never seen. Two years printed in one recognised
 * run therefore read as one. Pinned rather than fixed because the repair is a
 * change to a matching rule that classification confidence also depends on.
 */
test("two years inside one token: only the first is currently seen", () => {
  const detection = detectTaxYear(documentOf([token("2024 2025", 0, 700)]));

  assert.deepEqual([...detection.candidates], [2024]);
  assert.equal(detection.value, 2024, "if this becomes 2025 or null, the matching rule was fixed");
});

const T4 = getSlipDefinition("T4");

const extractT4 = (tokens: ReturnType<typeof token>[]) =>
  extractBoxCandidates(documentOf(tokens), T4, "synthetic-source-digest", DEFAULT_PARSER_LIMITS);

test("a labelled box value beside its label is extracted", () => {
  const result = extractT4([token("Box 14", 0, 700), token("52,000.00", 45, 700)]);
  const candidate = result.candidates.find((entry) => entry.box === "14");

  assert.ok(candidate, "box 14 must be found");
  assert.equal(candidate.rawValue, "52,000.00");
  assert.deepEqual(candidate.normalizedValue, { kind: "money", currency: "CAD", decimal: "52000" });
  assert.ok(candidate.confidence > 0.9);
});

test("every extracted value stays a candidate awaiting manual confirmation", () => {
  // Nothing this parser produces is ever automatically entered on a return.
  const result = extractT4([token("Box 14", 0, 700), token("52,000.00", 45, 700)]);

  assert.ok(result.candidates.length > 0);
  for (const candidate of result.candidates) {
    assert.equal(candidate.status, "requires-manual-confirmation");
    assert.match(candidate.id, /^candidate:[a-f0-9]{24}$/);
    assert.ok(candidate.mappings.length > 0, `box ${candidate.box} must carry its official mapping`);
    assert.ok(candidate.source.page >= 1, "a candidate must point back at where it was read");
  }
});

test("money is normalised out of its printed form", () => {
  const cases: readonly [string, string][] = [
    ["1,234.50", "1234.5"],
    ["$1,000.00", "1000"],
    ["CAD 250.25", "250.25"],
    ["(100.00)", "-100"],
    ["0.01", "0.01"],
  ];

  for (const [printed, decimal] of cases) {
    const result = extractT4([token("Box 14", 0, 700), token(printed, 45, 700)]);
    const candidate = result.candidates.find((entry) => entry.box === "14");
    assert.equal(candidate?.normalizedValue.kind, "money", `${printed} must parse as money`);
    assert.equal(candidate.normalizedValue.decimal, decimal, `${printed}`);
    assert.equal(candidate.normalizedValue.currency, "CAD");
  }
});

test("bracketed amounts are read as negative rather than as a stray character", () => {
  const result = extractT4([token("Box 14", 0, 700), token("(2,500.00)", 45, 700)]);
  const candidate = result.candidates.find((entry) => entry.box === "14");
  assert.equal(candidate?.normalizedValue.decimal, "-2500");
});

test("text that is not an amount is not accepted as one", () => {
  const result = extractT4([token("Box 14", 0, 700), token("see attached", 45, 700)]);
  const candidate = result.candidates.find((entry) => entry.box === "14");
  assert.notEqual(candidate?.normalizedValue.kind, "money", "prose must not become a dollar figure");
});

test("a required box that was not found is reported rather than silently absent", () => {
  const result = extractT4([token("Box 44", 0, 700), token("500.00", 45, 700)]);

  assert.ok(result.missingRequiredBoxes.includes("14"), "employment income is required on a T4");
  const issue = result.issues.find((entry) => entry.code === "missing-field");
  assert.ok(issue);
  assert.equal(issue.severity, "warning");
  assert.ok(issue.message.includes("checked manually"));
});

test("competing values for one box are flagged as ambiguous", () => {
  // Two plausible readings must never be resolved by picking one.
  const result = extractT4([
    token("Box 14", 0, 700),
    token("52,000.00", 45, 700),
    token("52,000.01", 90, 700),
  ]);
  const candidate = result.candidates.find((entry) => entry.box === "14");

  assert.ok(candidate);
  assert.ok(candidate.flags.includes("ambiguous"), "two near-equal readings must be flagged");
  assert.ok(candidate.alternatives.length > 0, "the rejected reading must remain visible");
  assert.ok(result.issues.some((entry) => entry.code === "ambiguous-field"));
});

test("a box whose official mapping is not a direct transfer is flagged as review-only", () => {
  // T4 box 16 feeds Schedule 8 rather than a return line, so it must never be
  // applied automatically however confidently it was read.
  const result = extractT4([token("Box 16", 0, 700), token("4,034.10", 45, 700)]);
  const candidate = result.candidates.find((entry) => entry.box === "16");

  assert.ok(candidate);
  assert.ok(candidate.flags.includes("review-only-mapping"));
  const issue = result.issues.find((entry) => entry.code === "review-only-mapping");
  assert.ok(issue);
  assert.equal(issue.severity, "info");
  assert.ok(issue.message.includes("never applied automatically"));
});

test("a value on a different page from its label is not paired with it", () => {
  const result = extractT4([token("Box 14", 0, 700, 1), token("52,000.00", 45, 700, 2)]);
  assert.ok(
    !result.candidates.some((entry) => entry.box === "14"),
    "a label and a value on different pages are not evidence of each other",
  );
});

test("a value far across the page from its label is paired only weakly", () => {
  // Reading order still counts for something, so a distant value is not
  // discarded outright — but the geometry drags its confidence under the
  // automatic threshold, which is what puts it in front of a person.
  const near = extractT4([token("Box 14", 0, 700), token("52,000.00", 45, 700)]);
  const far = extractT4([
    token("Box 14", 0, 700),
    { ...token("52,000.00", 700, 40), bounds: { x: 700, y: 40, width: 40, height: 10 } },
  ]);

  const nearCandidate = near.candidates.find((entry) => entry.box === "14");
  const farCandidate = far.candidates.find((entry) => entry.box === "14");

  assert.ok(nearCandidate && farCandidate);
  assert.ok(farCandidate.confidence < nearCandidate.confidence, "distance must cost confidence");
  assert.ok(farCandidate.flags.includes("low-confidence"));
  assert.ok(!nearCandidate.flags.includes("low-confidence"));
  assert.ok(far.issues.some((entry) => entry.code === "low-confidence-field"));
});

test("a value beyond the scan window after its label is not paired with it", () => {
  const filler = Array.from({ length: 20 }, (_, index) => token(`note ${index}`, 45 + index, 700));
  const result = extractT4([token("Box 14", 0, 700), ...filler, token("52,000.00", 90, 700)]);

  const candidate = result.candidates.find((entry) => entry.box === "14");
  assert.notEqual(
    candidate?.rawValue,
    "52,000.00",
    "a value twenty tokens later is not evidence for this label",
  );
});

test("the candidate count limit stops extraction rather than truncating silently", () => {
  const result = extractBoxCandidates(
    documentOf([token("Box 14", 0, 700), token("52,000.00", 45, 700)]),
    T4,
    "synthetic-source-digest",
    { ...DEFAULT_PARSER_LIMITS, maxCandidateCount: 0 },
  );

  const issue = result.issues.find((entry) => entry.code === "resource-limit");
  assert.ok(issue, "hitting the bound must be reported");
  assert.equal(issue.severity, "error");
});

test("a candidate identifier is stable for the same reading and differs for another", () => {
  const first = extractT4([token("Box 14", 0, 700), token("52,000.00", 45, 700)]);
  const same = extractT4([token("Box 14", 0, 700), token("52,000.00", 45, 700)]);
  const different = extractT4([token("Box 14", 0, 700), token("52,000.01", 45, 700)]);

  const idOf = (result: typeof first) => result.candidates.find((entry) => entry.box === "14")?.id;
  assert.equal(idOf(first), idOf(same), "the same reading must identify the same candidate");
  assert.notEqual(idOf(first), idOf(different));
});
