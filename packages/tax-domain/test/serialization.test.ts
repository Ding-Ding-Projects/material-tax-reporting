/**
 * Import bounds and export redaction.
 *
 * A tax return is the most sensitive document most people own, and this is the
 * boundary it crosses on its way in and out of the product. The import side is
 * a parser fed by a file the product did not write, so the tests below push on
 * the bounds rather than the happy path; the export side must drop the Social
 * Insurance Number and say plainly that it did.
 *
 * Tax year: 2025. All fixtures are synthetic.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { CALCULATED_AT, dollars, syntheticReturn } from "./synthetic-return.ts";
import { useTypeScriptSources } from "./typescript-source-resolver.ts";

useTypeScriptSources();

const { parseTaxReturnJson, createPortableTaxReturnExport, serializePortableTaxReturn } =
  await import("../src/serialization.ts");

const MAX_IMPORT_BYTES = 1_048_576;

test("a valid document round-trips through the parser", () => {
  const input = syntheticReturn();
  const result = parseTaxReturnJson(JSON.stringify(input));

  assert.deepEqual(result.errors, []);
  assert.ok(result.value);
  assert.equal(result.value.schemaVersion, "canada-annual-personal-tax/1");
  assert.equal(result.value.t4Slips[0]?.box14EmploymentIncome, dollars(80_000));
});

test("input that is not JSON at all is refused without throwing", () => {
  for (const malformed of ["", "{", "not json", "{\"a\":}", "undefined"]) {
    const result = parseTaxReturnJson(malformed);
    assert.deepEqual(result.errors, ["Import is not valid JSON."], `${malformed || "(empty)"} must be refused`);
    assert.equal(result.value, undefined);
  }
});

test("a JSON document that is not an object is refused", () => {
  for (const scalar of ["null", "42", "\"text\"", "true", "[]"]) {
    const result = parseTaxReturnJson(scalar);
    assert.deepEqual(result.errors, ["Import root must be an object."], `${scalar} must be refused`);
  }
});

test("an oversized import is refused before it is parsed", () => {
  // Measured in bytes rather than characters, so the padding below is ASCII and
  // the two counts agree. The point is that the refusal happens on size alone.
  const oversized = JSON.stringify({ padding: "a".repeat(MAX_IMPORT_BYTES) });
  assert.ok(new TextEncoder().encode(oversized).byteLength > MAX_IMPORT_BYTES);

  const result = parseTaxReturnJson(oversized);
  assert.deepEqual(result.errors, [`Import exceeds ${MAX_IMPORT_BYTES} bytes.`]);
  assert.equal(result.value, undefined);
});

test("an unsafe object key is refused rather than assigned", () => {
  // A prototype-polluting key must never reach an assignment. It is rejected on
  // structure, before the schema version is even looked at.
  for (const key of ["__proto__", "prototype", "constructor"]) {
    const document = `{"schemaVersion":"canada-annual-personal-tax/1","nested":{"${key}":{"polluted":true}}}`;
    const result = parseTaxReturnJson(document);

    assert.ok(
      result.errors.some((message) => message.startsWith("Unsafe object key")),
      `${key} must be refused`,
    );
    assert.equal(result.value, undefined);
  }
  assert.equal(({} as Record<string, unknown>).polluted, undefined, "nothing was polluted");
});

test("excessive nesting is refused", () => {
  let nested = "1";
  for (let depth = 0; depth < 40; depth += 1) nested = `{"a":${nested}}`;

  const result = parseTaxReturnJson(nested);
  assert.ok(result.errors.some((message) => message.includes("nesting depth")));
});

test("an over-long object key or string value is refused", () => {
  const longKey = parseTaxReturnJson(`{"${"k".repeat(101)}":1}`);
  assert.ok(longKey.errors.some((message) => message.includes("key exceeds 100 characters")));

  const longString = parseTaxReturnJson(JSON.stringify({ value: "v".repeat(20_001) }));
  assert.ok(longString.errors.some((message) => message.includes("exceeds 20,000 characters")));
});

test("a document with too many values is refused", () => {
  const result = parseTaxReturnJson(JSON.stringify({ many: new Array(60_000).fill(0) }));
  assert.ok(result.errors.some((message) => message.includes("exceeds 50000 values")));
});

test("a missing or wrong schema version is refused before validation runs", () => {
  for (const document of ["{}", '{"schemaVersion":"canada-annual-personal-tax/2"}']) {
    const result = parseTaxReturnJson(document);
    assert.deepEqual(result.errors, ["Unsupported or missing tax-return schema version."]);
  }
});

test("a structurally valid document that fails validation reports the field and reason", () => {
  const invalid = syntheticReturn({
    overrides: { unsupportedSituations: ["non-resident"], province: "BC" as never },
  });
  const result = parseTaxReturnJson(JSON.stringify(invalid));

  assert.equal(result.value, undefined);
  assert.ok(result.errors.length > 0);
  assert.ok(
    result.errors.every((message) => message.includes(": ")),
    "each error must name the path it belongs to",
  );
  assert.ok(result.errors.some((message) => message.startsWith("province:")));
  assert.ok(result.errors.some((message) => message.includes("non-resident")));
});

test("only errors block an import; review notices do not", () => {
  // The baseline fixture always raises the mandatory-review notice. If review
  // severity were treated as failure, nothing could ever be imported at all.
  const result = parseTaxReturnJson(JSON.stringify(syntheticReturn()));
  assert.ok(result.value, "a return carrying only review notices must import");
});

test("a portable export omits the Social Insurance Number and says so", () => {
  const input = syntheticReturn({
    overrides: {
      taxpayer: {
        givenName: "Sample",
        familyName: "Synthetic-Fixture",
        dateOfBirth: "1985-03-14",
        // An obviously fake placeholder, not an issued number.
        socialInsuranceNumber: "000000000",
      },
    },
  });

  const exported = createPortableTaxReturnExport(input, CALCULATED_AT);

  assert.equal(exported.schemaVersion, "canada-annual-personal-tax-portable/1");
  assert.equal(exported.exportedAt, CALCULATED_AT);
  assert.deepEqual(exported.redactions, ["taxpayer.socialInsuranceNumber"]);
  assert.ok(
    !("socialInsuranceNumber" in exported.taxReturn.taxpayer),
    "the key itself must be gone, not merely emptied",
  );
  assert.equal(exported.taxReturn.taxpayer.givenName, "Sample", "the rest of the identity survives");

  // The strongest form of the check: the digits must not appear anywhere in the
  // serialized bytes, however they were reached.
  assert.ok(!serializePortableTaxReturn(exported).includes("000000000"));
});

test("the export never claims it can file anything", () => {
  const exported = createPortableTaxReturnExport(syntheticReturn(), CALCULATED_AT);
  const notices = exported.notices.join(" ");

  assert.ok(notices.includes("cannot file or transmit"));
  assert.ok(notices.includes("Canada Revenue Agency"));
  assert.ok(
    notices.includes("sensitive"),
    "the export must warn that it still carries sensitive information",
  );
});

test("the input is not mutated by exporting it", () => {
  const input = syntheticReturn({
    overrides: {
      taxpayer: {
        givenName: "Sample",
        familyName: "Synthetic-Fixture",
        dateOfBirth: "1985-03-14",
        socialInsuranceNumber: "000000000",
      },
    },
  });

  createPortableTaxReturnExport(input, CALCULATED_AT);
  assert.equal(input.taxpayer.socialInsuranceNumber, "000000000", "redaction must not reach the caller's object");
});

test("the serialized export is indented JSON ending in a single newline", () => {
  const text = serializePortableTaxReturn(createPortableTaxReturnExport(syntheticReturn(), CALCULATED_AT));

  assert.ok(text.endsWith("}\n"));
  assert.ok(!text.endsWith("}\n\n"));
  assert.ok(text.includes("\n  "), "the export is indented for a human reader");
  assert.equal(JSON.parse(text).schemaVersion, "canada-annual-personal-tax-portable/1");
});

test("an exported return can be read back as a valid return", () => {
  // The export drops the Social Insurance Number, which the validator treats as
  // optional, so the remaining document must still import cleanly.
  const exported = createPortableTaxReturnExport(syntheticReturn(), CALCULATED_AT);
  const reimported = parseTaxReturnJson(JSON.stringify(exported.taxReturn));

  assert.deepEqual(reimported.errors, []);
  assert.ok(reimported.value);
  assert.equal(reimported.value.t4Slips[0]?.box14EmploymentIncome, dollars(80_000));
});
