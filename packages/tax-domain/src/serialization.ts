import type { TaxReturnInput } from "./model.js";
import { validateTaxReturn } from "./validation.js";

const MAX_IMPORT_BYTES = 1_048_576;
const MAX_DEPTH = 24;
const MAX_NODES = 50_000;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export interface TaxReturnImportResult {
  readonly value?: TaxReturnInput;
  readonly errors: readonly string[];
}

export interface PortableTaxReturnExport {
  readonly schemaVersion: "canada-annual-personal-tax-portable/1";
  readonly exportedAt: string;
  readonly taxReturn: Omit<TaxReturnInput, "taxpayer"> & {
    readonly taxpayer: Omit<TaxReturnInput["taxpayer"], "socialInsuranceNumber">;
  };
  readonly redactions: readonly string[];
  readonly notices: readonly string[];
}

function inspectValue(value: unknown): readonly string[] {
  const errors: string[] = [];
  let nodes = 0;
  const visit = (candidate: unknown, depth: number, path: string): void => {
    nodes += 1;
    if (nodes > MAX_NODES) {
      errors.push(`Import exceeds ${MAX_NODES} values.`);
      return;
    }
    if (depth > MAX_DEPTH) {
      errors.push(`Import exceeds nesting depth ${MAX_DEPTH} at ${path}.`);
      return;
    }
    if (Array.isArray(candidate)) {
      for (const [index, item] of candidate.entries()) visit(item, depth + 1, `${path}[${index}]`);
      return;
    }
    if (candidate !== null && typeof candidate === "object") {
      for (const [key, item] of Object.entries(candidate)) {
        if (FORBIDDEN_KEYS.has(key)) errors.push(`Unsafe object key at ${path}.${key}.`);
        if (key.length > 100) errors.push(`Object key exceeds 100 characters at ${path}.`);
        visit(item, depth + 1, `${path}.${key}`);
      }
      return;
    }
    if (typeof candidate === "string" && candidate.length > 20_000) {
      errors.push(`String exceeds 20,000 characters at ${path}.`);
    }
  };
  visit(value, 0, "$input");
  return errors;
}

export function parseTaxReturnJson(json: string): TaxReturnImportResult {
  if (new TextEncoder().encode(json).byteLength > MAX_IMPORT_BYTES) {
    return { errors: [`Import exceeds ${MAX_IMPORT_BYTES} bytes.`] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    return { errors: ["Import is not valid JSON."] };
  }
  const structuralErrors = inspectValue(parsed);
  if (structuralErrors.length > 0) return { errors: structuralErrors };
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { errors: ["Import root must be an object."] };
  }
  const candidate = parsed as TaxReturnInput;
  if (candidate.schemaVersion !== "canada-annual-personal-tax/1") {
    return { errors: ["Unsupported or missing tax-return schema version."] };
  }
  const validationErrors = validateTaxReturn(candidate)
    .filter((entry) => entry.severity === "error")
    .map((entry) => `${entry.path}: ${entry.message}`);
  return validationErrors.length > 0 ? { errors: validationErrors } : { value: candidate, errors: [] };
}

export function createPortableTaxReturnExport(
  input: TaxReturnInput,
  exportedAt = new Date().toISOString(),
): PortableTaxReturnExport {
  const { socialInsuranceNumber: _omitted, ...taxpayer } = input.taxpayer;
  return {
    schemaVersion: "canada-annual-personal-tax-portable/1",
    exportedAt,
    taxReturn: { ...input, taxpayer },
    redactions: ["taxpayer.socialInsuranceNumber"],
    notices: [
      "This export contains sensitive tax information even though the Social Insurance Number is omitted.",
      "Keep it local, protect access to it, and review it before sharing.",
      "This export cannot file or transmit a return to the Canada Revenue Agency.",
    ],
  };
}

export function serializePortableTaxReturn(exportValue: PortableTaxReturnExport): string {
  return `${JSON.stringify(exportValue, null, 2)}\n`;
}
