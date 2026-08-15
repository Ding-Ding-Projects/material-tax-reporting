/**
 * What the parser will and will not accept off disk, and the digest it takes.
 *
 * Admission is the security boundary of this package: it is the code that meets
 * a file the product did not write. Everything downstream assumes the bytes
 * were bounded, structurally checked and never decrypted, so the tests below
 * are mostly refusals — an admission stage nobody has watched reject something
 * is indistinguishable from one that waves everything through.
 *
 * These suites import the pure modules directly rather than the package index,
 * because the index re-exports the offline OCR surface, which loads a native
 * canvas addon and the whole PDF and OCR stack at module-evaluation time.
 *
 * Every fixture is a hand-built synthetic document. None is a real tax slip.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { useTypeScriptSources } from "./typescript-source-resolver.ts";

useTypeScriptSources();

const { admitDocument } = await import("../src/admission.ts");
const { DEFAULT_PARSER_LIMITS } = await import("../src/types.ts");
const { sha256Hex, stableJson } = await import("../src/digest.ts");

const ascii = (text: string): Uint8Array => new TextEncoder().encode(text);

/** A structurally minimal PDF: header, one object, one page, and an end marker. */
const syntheticPdf = (body = "1 0 obj\n<< /Type /Page >>\nendobj\n"): Uint8Array =>
  ascii(`%PDF-1.7\n${body}trailer\n<< /Root 1 0 R >>\n%%EOF\n`);

const u32 = (value: number): number[] => [
  (value >>> 24) & 255,
  (value >>> 16) & 255,
  (value >>> 8) & 255,
  value & 255,
];
const u16 = (value: number): number[] => [(value >>> 8) & 255, value & 255];

/** A structurally valid PNG header and trailer around the declared dimensions. */
function syntheticPng(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...u32(13), 0x49, 0x48, 0x44, 0x52,
    ...u32(width), ...u32(height),
    8, 6, 0, 0, 0,
    ...u32(0),
    ...u32(0), 0x49, 0x45, 0x4e, 0x44, ...u32(0),
  ]);
}

/** A JPEG carrying a single baseline start-of-frame marker. */
function syntheticJpeg(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xc0, ...u16(17), 8, ...u16(height), ...u16(width),
    3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1,
    0xff, 0xd9,
  ]);
}

test("an empty document is refused", () => {
  const result = admitDocument(new Uint8Array(0));
  assert.equal(result.state, "rejected");
  assert.equal(result.issue.code, "input-empty");
  assert.equal(result.issue.severity, "error");
});

test("a document beyond the byte limit is refused, and the limit itself is admitted", () => {
  const limits = { ...DEFAULT_PARSER_LIMITS, maxInputBytes: 64 };

  const tooLarge = admitDocument(new Uint8Array(65), limits);
  assert.equal(tooLarge.state, "rejected");
  assert.equal(tooLarge.issue.code, "input-too-large");

  // Exactly at the limit is inside it. The refusal is for exceeding, not reaching.
  const atLimit = admitDocument(new Uint8Array(64), limits);
  assert.equal(atLimit.issue?.code, "unsupported-document", "a 64-byte blob is refused on shape, not size");
});

test("bytes that are not a supported document are refused without guessing", () => {
  const result = admitDocument(ascii("this is just some text, not a document at all"));
  assert.equal(result.state, "rejected");
  assert.equal(result.issue.code, "unsupported-document");
  assert.ok(result.issue.message.includes("PDF"));
});

test("a structurally valid PDF is admitted with its version, object and page counts", () => {
  const result = admitDocument(syntheticPdf());

  assert.equal(result.state, "admitted");
  assert.equal(result.kind, "application/pdf");
  assert.equal(result.pdf?.version, "1.7");
  assert.equal(result.pdf?.objectCount, 1);
  assert.equal(result.pdf?.pageCount, 1);
  assert.equal(result.pdf?.encrypted, false);
  assert.equal(result.image, undefined, "a PDF carries no image metadata");
});

test("a PDF header that is not a supported version is refused", () => {
  for (const header of ["%PDF-3.0", "%PDF-", "%PDX-1.4"]) {
    const bytes = ascii(`${header}\n1 0 obj\nendobj\ntrailer\n%%EOF\n`);
    const result = admitDocument(bytes);
    assert.equal(result.state, "rejected", `${header} must be refused`);
  }
  for (const version of ["1.0", "1.4", "1.7", "2.0"]) {
    const bytes = ascii(`%PDF-${version}\n1 0 obj\nendobj\ntrailer\n%%EOF\n`);
    assert.equal(admitDocument(bytes).state, "admitted", `${version} must be admitted`);
  }
});

test("a PDF missing its end marker is refused as malformed", () => {
  const result = admitDocument(ascii("%PDF-1.7\n1 0 obj\nendobj\ntrailer\n"));
  assert.equal(result.state, "rejected");
  assert.equal(result.issue.code, "malformed-document");
  assert.ok(result.issue.message.includes("end marker"));
});

test("an encrypted PDF is refused whole, with no partial extraction", () => {
  // The important half of this refusal is the second sentence: an encrypted
  // document must not yield "whatever we could read anyway".
  const result = admitDocument(syntheticPdf("1 0 obj\n<< /Encrypt 2 0 R /Type /Page >>\nendobj\n"));

  assert.equal(result.state, "rejected");
  assert.equal(result.issue.code, "encrypted-document");
  assert.ok(result.issue.message.includes("no partial data was returned"));
});

test("a PDF with no objects, or too many, is refused on resource grounds", () => {
  const empty = admitDocument(ascii("%PDF-1.7\ntrailer\n%%EOF\n"));
  assert.equal(empty.issue?.code, "resource-limit");

  const many = syntheticPdf(
    Array.from({ length: 6 }, (_, index) => `${index + 1} 0 obj\nendobj\n`).join(""),
  );
  const result = admitDocument(many, { ...DEFAULT_PARSER_LIMITS, maxPdfObjects: 5 });
  assert.equal(result.issue?.code, "resource-limit");
  assert.ok(result.issue.message.includes("object count"));
});

test("a PDF with more pages than the limit allows is refused", () => {
  const body = Array.from(
    { length: 4 },
    (_, index) => `${index + 1} 0 obj\n<< /Type /Page >>\nendobj\n`,
  ).join("");
  const result = admitDocument(syntheticPdf(body), { ...DEFAULT_PARSER_LIMITS, maxPdfPages: 3 });

  assert.equal(result.issue?.code, "resource-limit");
  assert.ok(result.issue.message.includes("page count"));
});

test("a PNG and a JPEG are admitted with their real dimensions", () => {
  const png = admitDocument(syntheticPng(100, 50));
  assert.equal(png.state, "admitted");
  assert.equal(png.kind, "image/png");
  assert.deepEqual(png.image, { width: 100, height: 50, pixels: 5_000 });

  const jpeg = admitDocument(syntheticJpeg(120, 60));
  assert.equal(jpeg.state, "admitted");
  assert.equal(jpeg.kind, "image/jpeg");
  assert.deepEqual(jpeg.image, { width: 120, height: 60, pixels: 7_200 });
});

test("an image beyond the pixel or dimension bound is not admitted", () => {
  // A decompression bomb declares enormous dimensions in a tiny header, so the
  // bound has to be enforced from the declaration rather than after decoding.
  const enormous = admitDocument(syntheticPng(30_000, 30_000));
  assert.equal(enormous.state, "rejected");

  const overPixelLimit = admitDocument(syntheticPng(100, 100), {
    ...DEFAULT_PARSER_LIMITS,
    maxImagePixels: 9_999,
  });
  assert.equal(overPixelLimit.state, "rejected");

  const overDimension = admitDocument(syntheticPng(100, 100), {
    ...DEFAULT_PARSER_LIMITS,
    maxImageDimension: 99,
  });
  assert.equal(overDimension.state, "rejected");
});

test("a truncated or corrupted image is refused rather than half-read", () => {
  const png = syntheticPng(100, 50);
  assert.equal(admitDocument(png.subarray(0, 20)).state, "rejected", "a truncated PNG must be refused");

  const noTrailer = new Uint8Array(png);
  noTrailer.set(ascii("XXXX"), noTrailer.length - 8);
  assert.equal(admitDocument(noTrailer).state, "rejected", "a PNG with no end chunk must be refused");

  const jpeg = syntheticJpeg(120, 60);
  assert.equal(admitDocument(jpeg.subarray(0, jpeg.length - 2)).state, "rejected");
});

test("an admitted document carries a copy of its bytes, not the caller's array", () => {
  // The caller may reuse or zero its buffer; the admitted document must not
  // change underneath the parser when it does.
  const source = syntheticPdf();
  const result = admitDocument(source);

  assert.equal(result.state, "admitted");
  assert.notEqual(result.bytes, source, "the admitted bytes must be a copy");
  assert.deepEqual(Array.from(result.bytes), Array.from(source));

  source.fill(0);
  assert.notDeepEqual(Array.from(result.bytes), Array.from(source), "the copy is unaffected");
});

test("the source digest is the SHA-256 of the exact bytes supplied", () => {
  const source = syntheticPdf();
  const result = admitDocument(source);

  assert.equal(result.state, "admitted");
  assert.equal(result.sourceDigest, sha256Hex(source), "computed over the input, not the copy");
  assert.match(result.sourceDigest, /^[a-f0-9]{64}$/);
});

test("two different documents receive different digests", () => {
  const first = admitDocument(syntheticPdf("1 0 obj\n<< /Type /Page >>\nendobj\n"));
  const second = admitDocument(syntheticPdf("2 0 obj\n<< /Type /Page >>\nendobj\n"));
  assert.notEqual(first.sourceDigest, second.sourceDigest);
});

test("the hand-written SHA-256 matches the published test vectors", () => {
  // The digest is implemented in plain JavaScript rather than through the
  // platform's crypto, so it needs known-answer checks: an implementation that
  // is subtly wrong still produces confident, stable, useless hex.
  assert.equal(sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(
    sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
    "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
  );
});

test("the digest accepts bytes and text alike, and agrees between them", () => {
  assert.equal(sha256Hex(ascii("abc")), sha256Hex("abc"));
  assert.equal(sha256Hex("a".repeat(1_000)).length, 64);
  assert.notEqual(sha256Hex("a"), sha256Hex("b"));
});

test("stable JSON orders object keys so a digest does not depend on insertion order", () => {
  // Two records that are equal must hash equal, whatever order their keys were
  // built in, or a result digest becomes a record of how the object was made.
  assert.equal(stableJson({ b: 1, a: 2 }), stableJson({ a: 2, b: 1 }));
  assert.equal(stableJson({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.equal(stableJson([3, { z: 1, y: 2 }]), '[3,{"y":2,"z":1}]');
  assert.equal(stableJson({ nested: { d: 1, c: [2, 1] } }), '{"nested":{"c":[2,1],"d":1}}');
  assert.equal(sha256Hex(stableJson({ b: 1, a: 2 })), sha256Hex(stableJson({ a: 2, b: 1 })));
});

test("stable JSON still distinguishes genuinely different records", () => {
  assert.notEqual(stableJson({ a: 1 }), stableJson({ a: 2 }));
  assert.notEqual(stableJson({ a: [1, 2] }), stableJson({ a: [2, 1] }), "array order is meaningful");
});
