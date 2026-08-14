/**
 * File conversion for this site's own records.
 *
 * The registry is a kernel object and is fail-closed: a pair nothing is
 * registered for produces a named refusal instead of a partial result.
 *
 * Scope is deliberately narrow. The registered adapters handle the personal
 * vocabulary map, the documentation index, the changelog view and the
 * notification history. Tax slips and return data are not accepted here and no
 * adapter for them exists.
 */

import {
  type AbortSignalLike,
  type ConversionAdapter,
  type ConversionResult,
  ConverterRegistry,
  neutralizeCsvCell,
  validateVocabularyDocument,
} from "@material-tax-reporting/surface-kernel";

/** The honest boundary statement rendered on the converter panel. */
export const CONVERTER_SCOPE_NOTE =
  "This converter accepts the records this site produces. It does not accept tax slips or return data, and no adapter for them exists.";

export type ConverterCategory = "Personal vocabulary" | "Documentation index" | "Changelog" | "Notifications";

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        current += character;
      }
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ",") {
      cells.push(current);
      current = "";
    } else current += character;
  }
  cells.push(current);
  return cells;
}

function dataLines(input: string): string[] {
  return input
    .replaceAll("\r\n", "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0 && !line.startsWith("#"));
}

/** Restores an apostrophe-guarded CSV cell to its original text. */
function unguard(value: string): string {
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
}

function vocabularyFromPairs(pairs: [string, string][]): string {
  return `${JSON.stringify({ version: 1, replacements: Object.fromEntries(pairs) }, null, 2)}\n`;
}

function readVocabularyJson(input: string): { ok: true; pairs: [string, string][] } | { ok: false; reason: string } {
  const verdict = validateVocabularyDocument(input);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };
  return { ok: true, pairs: Object.entries(verdict.replacements) };
}

function readDelimited(
  input: string,
  delimiter: "," | "\t",
): { ok: true; pairs: [string, string][] } | { ok: false; reason: string } {
  const lines = dataLines(input);
  if (lines.length === 0) return { ok: false, reason: "The file contains no data rows." };
  const pairs: [string, string][] = [];
  const rejected: string[] = [];
  const start = /^(key|term)\b/i.test(lines[0] ?? "") ? 1 : 0;
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const cells = delimiter === "," ? splitCsvLine(line) : line.split("\t");
    const key = unguard((cells[0] ?? "").trim());
    const value = unguard((cells[1] ?? "").trim());
    if (cells.length !== 2 || key.length === 0) {
      rejected.push(`Row ${index + 1}: a row must hold exactly two columns and a non-empty first column.`);
      continue;
    }
    pairs.push([key, value]);
  }
  if (pairs.length === 0) {
    return { ok: false, reason: rejected[0] ?? "No row could be read as a two-column pair." };
  }
  return { ok: true, pairs };
}

function jsonRows(input: string): { ok: true; rows: Record<string, unknown>[] } | { ok: false; reason: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input) as unknown;
  } catch {
    return { ok: false, reason: "The input is not valid JSON." };
  }
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { rows?: unknown }).rows)
      ? ((parsed as { rows: unknown[] }).rows)
      : null;
  if (rows === null) return { ok: false, reason: "Provide an array, or an object with a rows array." };
  const accepted: Record<string, unknown>[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return { ok: false, reason: "Every row must be an object." };
    }
    accepted.push(row as Record<string, unknown>);
  }
  return { ok: true, rows: accepted };
}

function columnsOf(rows: Record<string, unknown>[]): string[] {
  const columns = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) columns.add(key);
  return [...columns];
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  const columns = columnsOf(rows);
  const lines = [columns.map(neutralizeCsvCell).join(",")];
  for (const row of rows) lines.push(columns.map((column) => neutralizeCsvCell(cell(row[column]))).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

function rowsToMarkdown(rows: Record<string, unknown>[]): string {
  const columns = columnsOf(rows);
  const escape = (value: string) => value.replaceAll("|", "\\|").replaceAll("\n", " ");
  const lines = [
    `| ${columns.map(escape).join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
  ];
  for (const row of rows) lines.push(`| ${columns.map((column) => escape(cell(row[column]))).join(" | ")} |`);
  return `${lines.join("\n")}\n`;
}

function adapter(
  input: Omit<ConversionAdapter, "bundled" | "convert"> & {
    run: (body: string) => ConversionResult;
  },
): ConversionAdapter {
  return {
    id: input.id,
    category: input.category,
    sourceType: input.sourceType,
    targetType: input.targetType,
    bundled: true,
    validate: input.validate,
    convert: async (body: string, signal: AbortSignalLike): Promise<ConversionResult> => {
      if (signal.aborted) return { ok: false, reason: "The conversion was cancelled." };
      return input.run(body);
    },
  };
}

function vocabularyAdapters(): ConversionAdapter[] {
  const toDelimited = (pairs: [string, string][], delimiter: "," | "\t"): string => {
    const header = delimiter === "," ? "key,value" : "key\tvalue";
    const body = pairs.map(([key, value]) =>
      delimiter === ","
        ? `${neutralizeCsvCell(key)},${neutralizeCsvCell(value)}`
        : `${key.replaceAll("\t", " ")}\t${value.replaceAll("\t", " ")}`,
    );
    return `${[header, ...body].join(delimiter === "," ? "\r\n" : "\n")}\n`;
  };

  const fromJson = (target: "," | "\t") =>
    adapter({
      id: `vocabulary-json-to-${target === "," ? "csv" : "tsv"}`,
      category: "Personal vocabulary",
      sourceType: "vocabulary-json",
      targetType: target === "," ? "vocabulary-csv" : "vocabulary-tsv",
      validate: (body) => {
        const read = readVocabularyJson(body);
        return read.ok ? { ok: true } : { ok: false, reason: read.reason };
      },
      run: (body) => {
        const read = readVocabularyJson(body);
        if (!read.ok) return { ok: false, reason: read.reason };
        return { ok: true, body: toDelimited(read.pairs, target) };
      },
    });

  const toJson = (source: "," | "\t") =>
    adapter({
      id: `vocabulary-${source === "," ? "csv" : "tsv"}-to-json`,
      category: "Personal vocabulary",
      sourceType: source === "," ? "vocabulary-csv" : "vocabulary-tsv",
      targetType: "vocabulary-json",
      validate: (body) => {
        const read = readDelimited(body, source);
        return read.ok ? { ok: true } : { ok: false, reason: read.reason };
      },
      run: (body) => {
        const read = readDelimited(body, source);
        if (!read.ok) return { ok: false, reason: read.reason };
        const document = vocabularyFromPairs(read.pairs);
        const verdict = validateVocabularyDocument(document);
        if (!verdict.ok) return { ok: false, reason: verdict.reason };
        return { ok: true, body: document };
      },
    });

  const between = (source: "," | "\t", target: "," | "\t") =>
    adapter({
      id: `vocabulary-${source === "," ? "csv" : "tsv"}-to-${target === "," ? "csv" : "tsv"}`,
      category: "Personal vocabulary",
      sourceType: source === "," ? "vocabulary-csv" : "vocabulary-tsv",
      targetType: target === "," ? "vocabulary-csv" : "vocabulary-tsv",
      validate: (body) => {
        const read = readDelimited(body, source);
        return read.ok ? { ok: true } : { ok: false, reason: read.reason };
      },
      run: (body) => {
        const read = readDelimited(body, source);
        if (!read.ok) return { ok: false, reason: read.reason };
        return { ok: true, body: toDelimited(read.pairs, target) };
      },
    });

  return [fromJson(","), fromJson("\t"), toJson(","), toJson("\t"), between(",", "\t"), between("\t", ",")];
}

function tableAdapters(category: ConverterCategory, sourceType: string): ConversionAdapter[] {
  const validate = (body: string) => {
    const read = jsonRows(body);
    return read.ok ? { ok: true } : { ok: false, reason: read.reason };
  };
  return [
    adapter({
      id: `${sourceType}-to-csv`,
      category,
      sourceType,
      targetType: `${sourceType.replace(/-json$/, "")}-csv`,
      validate,
      run: (body) => {
        const read = jsonRows(body);
        if (!read.ok) return { ok: false, reason: read.reason };
        return { ok: true, body: rowsToCsv(read.rows) };
      },
    }),
    adapter({
      id: `${sourceType}-to-markdown`,
      category,
      sourceType,
      targetType: `${sourceType.replace(/-json$/, "")}-markdown`,
      validate,
      run: (body) => {
        const read = jsonRows(body);
        if (!read.ok) return { ok: false, reason: read.reason };
        return { ok: true, body: rowsToMarkdown(read.rows) };
      },
    }),
  ];
}

/** Builds the registry the converter panel renders. */
export function createConverterRegistry(): ConverterRegistry {
  const registry = new ConverterRegistry();
  for (const entry of vocabularyAdapters()) registry.register(entry);
  for (const entry of tableAdapters("Documentation index", "documentation-index-json")) registry.register(entry);
  for (const entry of tableAdapters("Changelog", "changelog-json")) registry.register(entry);
  for (const entry of tableAdapters("Notifications", "notification-history-json")) registry.register(entry);
  return registry;
}

/** Searchable text for one adapter. */
export function adapterHaystack(entry: ConversionAdapter): string {
  return `${entry.id} ${entry.category} ${entry.sourceType} ${entry.targetType}`;
}

/** The first `count` converted rows, for the preview shown before committing. */
export function previewRows(body: string, count: number): string[] {
  return body.replaceAll("\r\n", "\n").split("\n").filter((line) => line.length > 0).slice(0, count);
}
