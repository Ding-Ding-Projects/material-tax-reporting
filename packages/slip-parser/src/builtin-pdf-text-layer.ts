import type {
  AdmittedDocument,
  AdapterExtractionResult,
  BoundingBox,
  ParserLimits,
  TextEvidence,
  TextExtractionAdapter,
} from "./types.js";

interface PdfObject {
  readonly id: number;
  readonly body: string;
  readonly start: number;
}

type PdfLexeme =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "array"; readonly value: readonly string[] }
  | { readonly kind: "operator"; readonly value: string };

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function parseObjects(source: string, maxObjects: number): readonly PdfObject[] {
  const starts: { id: number; bodyStart: number; start: number }[] = [];
  const pattern = /\b(\d+)\s+\d+\s+obj\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null && starts.length < maxObjects) {
    starts.push({
      id: Number.parseInt(match[1] ?? "", 10),
      bodyStart: pattern.lastIndex,
      start: match.index,
    });
  }
  return starts.flatMap((entry) => {
    const end = source.indexOf("endobj", entry.bodyStart);
    if (end < 0) return [];
    return [{ id: entry.id, body: source.slice(entry.bodyStart, end), start: entry.start }];
  });
}

function contentObjectPages(objects: readonly PdfObject[]): ReadonlyMap<number, number> {
  const mapping = new Map<number, number>();
  let page = 0;
  for (const object of objects) {
    if (!/\/Type\s*\/Page\b/.test(object.body)) continue;
    page += 1;
    const contentsIndex = object.body.indexOf("/Contents");
    if (contentsIndex < 0) continue;
    const contentSlice = object.body.slice(contentsIndex, contentsIndex + 2_048);
    const referencePattern = /\b(\d+)\s+\d+\s+R\b/g;
    let reference: RegExpExecArray | null;
    while ((reference = referencePattern.exec(contentSlice)) !== null) {
      const objectId = Number.parseInt(reference[1] ?? "", 10);
      if (Number.isSafeInteger(objectId)) mapping.set(objectId, page);
    }
  }
  return mapping;
}

function decodeLiteral(source: string, start: number): { value: string; end: number } | null {
  let depth = 1;
  let cursor = start + 1;
  let value = "";
  while (cursor < source.length) {
    const character = source[cursor] ?? "";
    if (character === "\\") {
      const next = source[cursor + 1] ?? "";
      const escapes: Record<string, string> = {
        n: "\n",
        r: "\r",
        t: "\t",
        b: "\b",
        f: "\f",
        "(": "(",
        ")": ")",
        "\\": "\\",
      };
      if (next in escapes) {
        value += escapes[next] ?? "";
        cursor += 2;
        continue;
      }
      if (/[0-7]/.test(next)) {
        let octal = next;
        let width = 1;
        while (width < 3 && /[0-7]/.test(source[cursor + 1 + width] ?? "")) {
          octal += source[cursor + 1 + width];
          width += 1;
        }
        value += String.fromCharCode(Number.parseInt(octal, 8));
        cursor += width + 1;
        continue;
      }
      if (next === "\r" || next === "\n") {
        cursor += next === "\r" && source[cursor + 2] === "\n" ? 3 : 2;
        continue;
      }
      value += next;
      cursor += 2;
      continue;
    }
    if (character === "(") {
      depth += 1;
      value += character;
      cursor += 1;
      continue;
    }
    if (character === ")") {
      depth -= 1;
      cursor += 1;
      if (depth === 0) return { value, end: cursor };
      value += character;
      continue;
    }
    value += character;
    cursor += 1;
  }
  return null;
}

function decodeHex(source: string, start: number): { value: string; end: number } | null {
  const end = source.indexOf(">", start + 1);
  if (end < 0) return null;
  let hex = source.slice(start + 1, end).replace(/\s+/g, "");
  if (!/^[0-9a-f]*$/i.test(hex)) return null;
  if (hex.length % 2 === 1) hex += "0";
  let value = "";
  for (let index = 0; index < hex.length; index += 2) {
    value += String.fromCharCode(Number.parseInt(hex.slice(index, index + 2), 16));
  }
  return { value, end: end + 1 };
}

function lexContent(source: string, maxTokens: number): readonly PdfLexeme[] {
  const lexemes: PdfLexeme[] = [];
  let cursor = 0;
  while (cursor < source.length && lexemes.length < maxTokens) {
    const character = source[cursor] ?? "";
    if (/\s/.test(character)) {
      cursor += 1;
      continue;
    }
    if (character === "%") {
      const newline = source.indexOf("\n", cursor + 1);
      cursor = newline < 0 ? source.length : newline + 1;
      continue;
    }
    if (character === "(") {
      const literal = decodeLiteral(source, cursor);
      if (!literal) break;
      lexemes.push({ kind: "string", value: literal.value });
      cursor = literal.end;
      continue;
    }
    if (character === "<" && source[cursor + 1] !== "<") {
      const hex = decodeHex(source, cursor);
      if (!hex) break;
      lexemes.push({ kind: "string", value: hex.value });
      cursor = hex.end;
      continue;
    }
    if (character === "[") {
      const strings: string[] = [];
      cursor += 1;
      while (cursor < source.length && source[cursor] !== "]") {
        const arrayCharacter = source[cursor] ?? "";
        if (/\s/.test(arrayCharacter)) {
          cursor += 1;
          continue;
        }
        if (arrayCharacter === "(") {
          const literal = decodeLiteral(source, cursor);
          if (!literal) break;
          strings.push(literal.value);
          cursor = literal.end;
          continue;
        }
        if (arrayCharacter === "<") {
          const hex = decodeHex(source, cursor);
          if (!hex) break;
          strings.push(hex.value);
          cursor = hex.end;
          continue;
        }
        cursor += 1;
      }
      if (source[cursor] === "]") cursor += 1;
      lexemes.push({ kind: "array", value: strings });
      continue;
    }
    const endPattern = /[\s\[\]()<>/%]/;
    let end = cursor + 1;
    while (end < source.length && !endPattern.test(source[end] ?? "")) end += 1;
    const token = source.slice(cursor, end);
    const numeric = Number(token);
    lexemes.push(
      token !== "" && Number.isFinite(numeric)
        ? { kind: "number", value: numeric }
        : { kind: "operator", value: token },
    );
    cursor = end;
  }
  return lexemes;
}

function printableText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function textTokensFromStream(
  stream: string,
  page: number,
  adapterId: string,
  tokenBudget: number,
): readonly TextEvidence[] {
  const lexemes = lexContent(stream, tokenBudget * 8);
  const operands: PdfLexeme[] = [];
  const evidence: TextEvidence[] = [];
  let inText = false;
  let x = 0;
  let y = 0;
  let fontSize = 10;
  let leading = 12;

  const numbers = (count: number): number[] =>
    operands
      .filter((operand): operand is Extract<PdfLexeme, { kind: "number" }> => operand.kind === "number")
      .slice(-count)
      .map((operand) => operand.value);

  const emit = (raw: string): void => {
    const text = printableText(raw);
    if (!inText || text.length === 0 || evidence.length >= tokenBudget) return;
    const safeFontSize = Math.max(4, Math.min(96, Math.abs(fontSize)));
    const bounds: BoundingBox = {
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
      width: Math.max(safeFontSize * 0.5, text.length * safeFontSize * 0.52),
      height: safeFontSize,
    };
    evidence.push({
      text,
      page,
      bounds,
      coordinateSpace: "pdf-points-bottom-left",
      confidence: clampConfidence(0.91 - (text.includes("�") ? 0.25 : 0)),
      adapterId,
    });
    x += bounds.width;
  };

  for (const lexeme of lexemes) {
    if (lexeme.kind !== "operator") {
      operands.push(lexeme);
      if (operands.length > 32) operands.shift();
      continue;
    }
    switch (lexeme.value) {
      case "BT":
        inText = true;
        x = 0;
        y = 0;
        operands.length = 0;
        break;
      case "ET":
        inText = false;
        operands.length = 0;
        break;
      case "Tm": {
        const values = numbers(6);
        if (values.length === 6) {
          x = values[4] ?? x;
          y = values[5] ?? y;
        }
        operands.length = 0;
        break;
      }
      case "Td":
      case "TD": {
        const values = numbers(2);
        if (values.length === 2) {
          x += values[0] ?? 0;
          y += values[1] ?? 0;
          if (lexeme.value === "TD") leading = Math.abs(values[1] ?? leading);
        }
        operands.length = 0;
        break;
      }
      case "T*":
        y -= leading;
        x = 0;
        operands.length = 0;
        break;
      case "Tf": {
        const values = numbers(1);
        if (values.length === 1) fontSize = values[0] ?? fontSize;
        operands.length = 0;
        break;
      }
      case "TL": {
        const values = numbers(1);
        if (values.length === 1) leading = Math.abs(values[0] ?? leading);
        operands.length = 0;
        break;
      }
      case "Tj": {
        const text = [...operands].reverse().find((operand) => operand.kind === "string");
        if (text?.kind === "string") emit(text.value);
        operands.length = 0;
        break;
      }
      case "TJ": {
        const array = [...operands].reverse().find((operand) => operand.kind === "array");
        if (array?.kind === "array") emit(array.value.join(""));
        operands.length = 0;
        break;
      }
      case "'":
      case "\"": {
        y -= leading;
        x = 0;
        const text = [...operands].reverse().find((operand) => operand.kind === "string");
        if (text?.kind === "string") emit(text.value);
        operands.length = 0;
        break;
      }
      default:
        if (/^[A-Za-z*]+$/.test(lexeme.value)) operands.length = 0;
        break;
    }
  }
  return evidence;
}

function streamBody(object: PdfObject, maxBytes: number): string | null {
  const marker = object.body.indexOf("stream");
  if (marker < 0) return null;
  const dictionary = object.body.slice(0, marker);
  if (/\/Filter\b/.test(dictionary)) return null;
  let start = marker + "stream".length;
  if (object.body[start] === "\r" && object.body[start + 1] === "\n") start += 2;
  else if (object.body[start] === "\r" || object.body[start] === "\n") start += 1;
  const end = object.body.indexOf("endstream", start);
  if (end < 0 || end - start > maxBytes) return null;
  return object.body.slice(start, end);
}

export const BUILTIN_PDF_TEXT_LAYER_ADAPTER: TextExtractionAdapter = Object.freeze({
  id: "builtin-pdf-text-layer-v1",
  supportedKinds: ["application/pdf"],
  proof: {
    bundled: true,
    declared: true,
    declaredInPackage: "packages/slip-parser/src/builtin-pdf-text-layer.ts",
    artifactId: "@material-tax-reporting/slip-parser:builtin-pdf-text-layer",
    artifactVersion: "1",
    runtimeId: "ecmascript-es2022",
    offline: true,
    networkAccess: "forbidden",
    telemetry: "none",
  },
  canExtract(document: AdmittedDocument): boolean {
    return document.kind === "application/pdf" && document.pdf?.encrypted === false;
  },
  async extract(
    document: AdmittedDocument,
    limits: Readonly<ParserLimits>,
  ): Promise<AdapterExtractionResult> {
    if (document.kind !== "application/pdf" || !document.pdf) {
      return {
        state: "rejected",
        issue: {
          id: "adapter:builtin-pdf:wrong-kind",
          code: "unsupported-adapter",
          severity: "error",
          message: "The bundled PDF text-layer adapter cannot process this document kind.",
        },
      };
    }
    const source = new TextDecoder("latin1").decode(document.bytes);
    const objects = parseObjects(source, limits.maxPdfObjects);
    const pages = contentObjectPages(objects);
    const tokens: TextEvidence[] = [];
    let filteredStreams = 0;
    let unfilteredStreams = 0;
    let fallbackPage = 1;
    for (const object of objects) {
      if (!object.body.includes("stream")) continue;
      const stream = streamBody(object, limits.maxPdfStreamBytes);
      if (stream === null) {
        filteredStreams += 1;
        continue;
      }
      unfilteredStreams += 1;
      const page = pages.get(object.id) ?? Math.min(fallbackPage, document.pdf.pageCount);
      fallbackPage = Math.min(document.pdf.pageCount, fallbackPage + 1);
      const remaining = limits.maxExtractedTokens - tokens.length;
      if (remaining <= 0) break;
      tokens.push(...textTokensFromStream(stream, page, this.id, remaining));
    }
    const characters = tokens.reduce((total, token) => total + token.text.length, 0);
    if (tokens.length > limits.maxExtractedTokens || characters > limits.maxExtractedCharacters) {
      return {
        state: "rejected",
        issue: {
          id: "adapter:builtin-pdf:resource-limit",
          code: "resource-limit",
          severity: "error",
          message: "The extracted PDF text exceeds the configured token or character limit.",
        },
      };
    }
    if (tokens.length === 0) {
      return {
        state: "rejected",
        issue: {
          id: "adapter:builtin-pdf:no-text-layer",
          code: "unsupported-adapter",
          severity: "error",
          message:
            filteredStreams > 0 && unfilteredStreams === 0
              ? "The PDF has no bounded unfiltered text layer supported by the bundled adapter. No partial data was returned."
              : "The PDF contains no usable text layer. Image OCR is unavailable because no bundled OCR runtime is declared.",
        },
      };
    }
    return {
      state: "extracted",
      document: {
        pageCount: document.pdf.pageCount,
        tokens: Object.freeze(tokens.slice()),
        warnings:
          filteredStreams > 0
            ? [
                {
                  id: "adapter:builtin-pdf:filtered-streams-skipped",
                  code: "unsupported-adapter",
                  severity: "warning",
                  message: "Some compressed or filtered PDF streams were not inspected; every extracted value requires manual comparison with the source document.",
                },
              ]
            : [],
      },
    };
  },
});

export const DECLARED_IMAGE_OCR_ADAPTERS: readonly never[] = Object.freeze([]);
