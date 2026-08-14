import { sha256Hex } from "./digest.js";
import {
  DEFAULT_PARSER_LIMITS,
  type AdmittedDocument,
  type DocumentAdmissionResult,
  type ImageAdmissionMetadata,
  type ParserIssue,
  type ParserLimits,
  type SupportedDocumentKind,
} from "./types.js";

function issue(code: ParserIssue["code"], message: string): ParserIssue {
  return {
    id: `admission:${code}`,
    code,
    severity: "error",
    message,
  };
}

function beginsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

function endsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  const offset = bytes.length - signature.length;
  return signature.every((value, index) => bytes[offset + index] === value);
}

function readUint32BigEndian(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return (
    ((bytes[offset] ?? 0) * 0x1000000) +
    ((bytes[offset + 1] ?? 0) << 16) +
    ((bytes[offset + 2] ?? 0) << 8) +
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

function readUint16BigEndian(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function readUint16LittleEndian(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readUint32LittleEndian(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return (
    (bytes[offset] ?? 0) +
    ((bytes[offset + 1] ?? 0) << 8) +
    ((bytes[offset + 2] ?? 0) << 16) +
    ((bytes[offset + 3] ?? 0) * 0x1000000)
  ) >>> 0;
}

function imageMetadata(
  width: number,
  height: number,
  limits: Readonly<ParserLimits>,
): ImageAdmissionMetadata | null {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    return null;
  }
  const pixels = width * height;
  if (
    !Number.isSafeInteger(pixels) ||
    width > limits.maxImageDimension ||
    height > limits.maxImageDimension ||
    pixels > limits.maxImagePixels
  ) {
    return null;
  }
  return { width, height, pixels };
}

function inspectPng(bytes: Uint8Array, limits: Readonly<ParserLimits>): ImageAdmissionMetadata | null {
  if (!beginsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return null;
  if (bytes.length < 33) return null;
  const ihdrLength = readUint32BigEndian(bytes, 8);
  const ihdr = new TextDecoder("ascii").decode(bytes.subarray(12, 16));
  if (ihdrLength !== 13 || ihdr !== "IHDR") return null;
  const width = readUint32BigEndian(bytes, 16);
  const height = readUint32BigEndian(bytes, 20);
  if (width === null || height === null) return null;
  const tailStart = Math.max(0, bytes.length - 32);
  const tail = new TextDecoder("ascii").decode(bytes.subarray(tailStart));
  if (!tail.includes("IEND")) return null;
  return imageMetadata(width, height, limits);
}

function inspectJpeg(bytes: Uint8Array, limits: Readonly<ParserLimits>): ImageAdmissionMetadata | null {
  if (!beginsWith(bytes, [0xff, 0xd8, 0xff]) || !endsWith(bytes, [0xff, 0xd9])) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    const segmentLength = readUint16BigEndian(bytes, offset);
    if (segmentLength === null || segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame) {
      const height = readUint16BigEndian(bytes, offset + 3);
      const width = readUint16BigEndian(bytes, offset + 5);
      if (width === null || height === null) return null;
      return imageMetadata(width, height, limits);
    }
    offset += segmentLength;
  }
  return null;
}

function inspectWebp(bytes: Uint8Array, limits: Readonly<ParserLimits>): ImageAdmissionMetadata | null {
  if (bytes.length < 30) return null;
  const decoder = new TextDecoder("ascii");
  if (decoder.decode(bytes.subarray(0, 4)) !== "RIFF" || decoder.decode(bytes.subarray(8, 12)) !== "WEBP") return null;
  const declaredSize = readUint32LittleEndian(bytes, 4);
  if (declaredSize === null || declaredSize + 8 > bytes.length) return null;
  const chunk = decoder.decode(bytes.subarray(12, 16));
  if (chunk === "VP8X") {
    const width = 1 + ((bytes[24] ?? 0) | ((bytes[25] ?? 0) << 8) | ((bytes[26] ?? 0) << 16));
    const height = 1 + ((bytes[27] ?? 0) | ((bytes[28] ?? 0) << 8) | ((bytes[29] ?? 0) << 16));
    return imageMetadata(width, height, limits);
  }
  if (chunk === "VP8L" && bytes[20] === 0x2f) {
    const bits = readUint32LittleEndian(bytes, 21);
    if (bits === null) return null;
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >>> 14) & 0x3fff) + 1;
    return imageMetadata(width, height, limits);
  }
  return null;
}

function inspectTiff(bytes: Uint8Array, limits: Readonly<ParserLimits>): ImageAdmissionMetadata | null {
  const littleEndian = beginsWith(bytes, [0x49, 0x49, 0x2a, 0x00]);
  const bigEndian = beginsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a]);
  if (!littleEndian && !bigEndian) return null;
  const read16 = littleEndian ? readUint16LittleEndian : readUint16BigEndian;
  const read32 = littleEndian ? readUint32LittleEndian : readUint32BigEndian;
  const ifdOffset = read32(bytes, 4);
  if (ifdOffset === null || ifdOffset + 2 > bytes.length) return null;
  const count = read16(bytes, ifdOffset);
  if (count === null || count > 4_096 || ifdOffset + 2 + count * 12 > bytes.length) return null;
  let width: number | null = null;
  let height: number | null = null;
  for (let index = 0; index < count; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12;
    const tag = read16(bytes, entryOffset);
    const type = read16(bytes, entryOffset + 2);
    const valueCount = read32(bytes, entryOffset + 4);
    if (tag !== 256 && tag !== 257) continue;
    if (valueCount !== 1 || (type !== 3 && type !== 4)) return null;
    const value = type === 3 ? read16(bytes, entryOffset + 8) : read32(bytes, entryOffset + 8);
    if (value === null) return null;
    if (tag === 256) width = value;
    if (tag === 257) height = value;
  }
  if (width === null || height === null) return null;
  return imageMetadata(width, height, limits);
}

function inspectPdf(bytes: Uint8Array, limits: Readonly<ParserLimits>): DocumentAdmissionResult {
  const head = new TextDecoder("ascii").decode(bytes.subarray(0, Math.min(bytes.length, 16)));
  const versionMatch = /^%PDF-(1\.[0-7]|2\.0)/.exec(head);
  if (!versionMatch) {
    return { state: "rejected", issue: issue("signature-mismatch", "The PDF header is missing or unsupported.") };
  }
  const source = new TextDecoder("latin1").decode(bytes);
  const tail = source.slice(Math.max(0, source.length - 4_096));
  if (!tail.includes("%%EOF")) {
    return { state: "rejected", issue: issue("malformed-document", "The PDF end marker is missing.") };
  }
  if (/\/Encrypt\b/.test(source)) {
    return {
      state: "rejected",
      issue: issue(
        "encrypted-document",
        "Encrypted PDFs require a package-declared bundled adapter that can use user-supplied access. No such adapter is enabled, and no partial data was returned.",
      ),
    };
  }
  const objectCount = (source.match(/\b\d+\s+\d+\s+obj\b/g) ?? []).length;
  const pageCount = (source.match(/\/Type\s*\/Page\b/g) ?? []).length;
  if (objectCount === 0 || objectCount > limits.maxPdfObjects) {
    return { state: "rejected", issue: issue("resource-limit", "The PDF object count is missing or exceeds the configured limit.") };
  }
  if (pageCount === 0 || pageCount > limits.maxPdfPages) {
    return { state: "rejected", issue: issue("resource-limit", "The PDF page count is missing or exceeds the configured limit.") };
  }
  const admitted: AdmittedDocument = {
    state: "admitted",
    kind: "application/pdf",
    sourceDigest: sha256Hex(bytes),
    bytes: bytes.slice(),
    pdf: {
      version: versionMatch[1] ?? "unknown",
      objectCount,
      pageCount,
      encrypted: false,
    },
  };
  return admitted;
}

export function admitDocument(
  bytes: Uint8Array,
  limits: Readonly<ParserLimits> = DEFAULT_PARSER_LIMITS,
): DocumentAdmissionResult {
  if (bytes.length === 0) {
    return { state: "rejected", issue: issue("input-empty", "The document is empty.") };
  }
  if (bytes.length > limits.maxInputBytes) {
    return { state: "rejected", issue: issue("input-too-large", "The document exceeds the configured byte limit.") };
  }
  if (beginsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return inspectPdf(bytes, limits);
  }

  const candidates: readonly [SupportedDocumentKind, ImageAdmissionMetadata | null][] = [
    ["image/png", inspectPng(bytes, limits)],
    ["image/jpeg", inspectJpeg(bytes, limits)],
    ["image/webp", inspectWebp(bytes, limits)],
    ["image/tiff", inspectTiff(bytes, limits)],
  ];
  const matched = candidates.find((candidate) => candidate[1] !== null);
  if (!matched || !matched[1]) {
    return {
      state: "rejected",
      issue: issue(
        "unsupported-document",
        "The bytes are not a bounded, structurally valid PDF, PNG, JPEG, WebP, or TIFF document.",
      ),
    };
  }
  return {
    state: "admitted",
    kind: matched[0],
    sourceDigest: sha256Hex(bytes),
    bytes: bytes.slice(),
    image: matched[1],
  };
}
