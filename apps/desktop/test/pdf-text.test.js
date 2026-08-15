/**
 * The dependency-free document text extractor.
 *
 * This module reads a portable document with nothing but Node's own zlib, so
 * every fixture below is a hand-built byte string rather than a file on disk.
 * That is the point: the extractor is pure, and a test that hands it exact
 * bytes can pin exactly which structures it understands and exactly what it
 * says when it meets one it does not.
 *
 * The refusals matter more than the successes here. A converter that returns
 * empty text for a document it could not decode looks identical to one reading
 * a genuinely blank page, so each refusal carries its own sentence and each
 * sentence is asserted.
 */

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const zlib = require('node:zlib');

const { extractPdfText } = require('../src/main/pdf-text.js');

/** Assembles a document around a content stream, with a correct byte length. */
function documentWith(content, { filter = null, extraObjects = '', pages = 1 } = {}) {
  const body = Buffer.isBuffer(content) ? content : Buffer.from(content, 'latin1');
  const filterEntry = filter === null ? '' : ` /Filter /${filter}`;

  const kids = Array.from({ length: pages }, (_, index) => `${3 + index * 2} 0 R`).join(' ');
  let objects = '';
  for (let index = 0; index < pages; index += 1) {
    const pageNumber = 3 + index * 2;
    const contentNumber = pageNumber + 1;
    objects +=
      `${pageNumber} 0 obj << /Type /Page /Parent 2 0 R /Contents ${contentNumber} 0 R >> endobj\n` +
      `${contentNumber} 0 obj << /Length ${body.length}${filterEntry} >>\nstream\n${body.toString('latin1')}\nendstream\nendobj\n`;
  }

  return Buffer.from(
    '%PDF-1.4\n' +
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
      `2 0 obj << /Type /Pages /Kids [${kids}] /Count ${pages} >> endobj\n` +
      objects +
      extraObjects +
      'trailer << /Root 1 0 R >>\n%%EOF\n',
    'latin1',
  );
}

const textOf = (content, options) => extractPdfText(documentWith(content, options));

test('a simple text run is extracted', () => {
  const result = textOf('BT /F1 12 Tf 72 720 Td (Hello World) Tj ET');

  assert.equal(result.ok, true);
  assert.equal(result.body, 'Hello World\n');
  assert.equal(result.pages, 1);
  assert.equal(result.pagesWithText, 1);
});

test('the extracted body always ends in exactly one newline', () => {
  for (const content of [
    'BT (One) Tj ET',
    'BT (One) Tj (Two) Tj ET',
    'BT 1 0 0 1 10 700 Tm (Line) Tj ET',
  ]) {
    const result = textOf(content);
    assert.equal(result.ok, true);
    assert.ok(result.body.endsWith('\n'), `${content} must end in a newline`);
    assert.ok(!result.body.endsWith('\n\n'), `${content} must not end in a blank line`);
  }
});

test('a hexadecimal string is decoded', () => {
  const result = textOf('BT /F1 12 Tf 72 720 Td <48656C6C6F> Tj ET');
  assert.equal(result.ok, true);
  assert.equal(result.body, 'Hello\n');
});

test('a wide negative adjustment inside an array becomes a space', () => {
  // This is how a portable document encodes a word gap without a space glyph.
  const spaced = textOf('BT /F1 12 Tf 72 720 Td [(Hel)-200(lo)] TJ ET');
  assert.equal(spaced.body, 'Hel lo\n');

  const tight = textOf('BT /F1 12 Tf 72 720 Td [(Hel)-10(lo)] TJ ET');
  assert.equal(tight.body, 'Hello\n', 'a small kern is not a word break');
});

test('the line-showing operators move down by the leading', () => {
  const result = textOf("BT /F1 12 Tf 14 TL 10 700 Td (one) Tj (two) ' (three) \" ET");
  assert.equal(result.ok, true);
  assert.equal(result.body, 'one\ntwo\nthree\n');
});

test('a new text position on another line produces a line break', () => {
  const result = textOf('BT /F1 12 Tf 72 720 Td (first) Tj 0 -20 Td (second) Tj ET');
  assert.equal(result.body, 'first\nsecond\n');
});

test('a compressed content stream is inflated and read', () => {
  const compressed = zlib.deflateSync(Buffer.from('BT /F1 12 Tf 72 720 Td (Compressed) Tj ET', 'latin1'));
  const result = extractPdfText(documentWith(compressed, { filter: 'FlateDecode' }));

  assert.equal(result.ok, true);
  assert.equal(result.body, 'Compressed\n');
});

test('every page is visited and counted', () => {
  const result = textOf('BT /F1 12 Tf 72 720 Td (Page text) Tj ET', { pages: 3 });

  assert.equal(result.ok, true);
  assert.equal(result.pages, 3);
  assert.equal(result.pagesWithText, 3);
  assert.equal(result.body.split('Page text').length - 1, 3);
});

test('a page with no text is counted as a page but not as text', () => {
  const result = extractPdfText(
    Buffer.from(
      '%PDF-1.4\n' +
        '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
        '2 0 obj << /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >> endobj\n' +
        '3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj\n' +
        '4 0 obj << /Length 41 >>\nstream\nBT /F1 12 Tf 72 720 Td (Only here) Tj ET\nendstream\nendobj\n' +
        '5 0 obj << /Type /Page /Parent 2 0 R /Contents 6 0 R >> endobj\n' +
        '6 0 obj << /Length 22 >>\nstream\nq 1 0 0 1 0 0 cm Q\nendstream\nendobj\n' +
        'trailer << /Root 1 0 R >>\n%%EOF\n',
      'latin1',
    ),
  );

  assert.equal(result.ok, true);
  assert.equal(result.pages, 2);
  assert.equal(result.pagesWithText, 1);
  assert.ok(result.body.includes('Only here'));
});

test('bytes that are too small to be a document are refused', () => {
  for (const input of [Buffer.alloc(0), Buffer.from('%PDF'), Buffer.from('abc')]) {
    const result = extractPdfText(input);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'This file is too small to be a portable document.');
  }
});

test('input that is not a buffer at all is refused rather than throwing', () => {
  // The extractor is handed whatever the surrounding application read, so a
  // wrong type must come back as a refusal, not an exception.
  for (const input of [null, undefined, 'a string', new Uint8Array(4096), 42, {}]) {
    const result = extractPdfText(input);
    assert.equal(result.ok, false, `${String(input)} must be refused`);
    assert.equal(typeof result.reason, 'string');
    assert.ok(result.reason.length > 0);
  }
});

test('a file without a document header is refused', () => {
  const result = extractPdfText(Buffer.from('x'.repeat(2048), 'latin1'));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'This file does not begin with a portable-document header.');
});

test('an encrypted document is refused with a route back to a readable copy', () => {
  const result = extractPdfText(
    Buffer.from(
      '%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Encrypt 9 0 R >>\n%%EOF\n',
      'latin1',
    ),
  );

  assert.equal(result.ok, false);
  assert.ok(result.reason.includes('encrypted'));
  assert.ok(
    result.reason.includes('save an unencrypted copy'),
    'a refusal must say what the reader can do about it',
  );
});

test('a document with no objects is refused', () => {
  const result = extractPdfText(Buffer.from('%PDF-1.4\ntrailer\n%%EOF\n', 'latin1'));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'The document contains no readable objects.');
});

test('a document with no pages is refused', () => {
  const result = extractPdfText(
    Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer\n%%EOF\n', 'latin1'),
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'No pages could be located in this document.');
});

test('a compression this build cannot decode is named as the reason', () => {
  // The distinction that matters: this is not "there is no text", it is "there
  // is text and we could not get at it", and the two need different answers.
  const result = textOf('any bytes at all', { filter: 'LZWDecode' });

  assert.equal(result.ok, false);
  assert.ok(result.reason.includes('compression this build does not decode'));
});

test('a page with no text layer is distinguished from one that failed to decode', () => {
  const result = textOf('q 1 0 0 1 0 0 cm Q');

  assert.equal(result.ok, false);
  assert.ok(result.reason.includes('no text layer'));
  assert.ok(
    result.reason.includes('optical character recognition'),
    'a scanned page needs a different tool, and the refusal should say so',
  );
});

test('a corrupt stream is refused rather than yielding garbled text', () => {
  const notActuallyCompressed = Buffer.from('this is not deflate data at all', 'latin1');
  const result = extractPdfText(documentWith(notActuallyCompressed, { filter: 'FlateDecode' }));

  assert.equal(result.ok, false);
  assert.ok(result.reason.includes('compression this build does not decode'));
});

test('every refusal is a sentence a reader can act on', () => {
  const refusals = [
    extractPdfText(Buffer.alloc(0)),
    extractPdfText(Buffer.from('x'.repeat(2048), 'latin1')),
    extractPdfText(Buffer.from('%PDF-1.4\ntrailer\n%%EOF\n', 'latin1')),
    textOf('q Q'),
    textOf('bytes', { filter: 'LZWDecode' }),
  ];

  for (const result of refusals) {
    assert.equal(result.ok, false);
    assert.equal(typeof result.reason, 'string');
    assert.ok(result.reason.endsWith('.'), `"${result.reason}" should read as a sentence`);
    assert.ok(result.reason.length > 20, `"${result.reason}" is too terse to act on`);
    assert.equal(result.body, undefined, 'a refusal must not also return text');
  }
});

test('a refusal never throws, whatever the bytes look like', () => {
  const nonsense = [
    Buffer.from('%PDF-1.4\n' + ' '.repeat(500), 'latin1'),
    Buffer.from('%PDF-1.4\n1 0 obj << /Type /Page /Contents 99 0 R >> endobj\n%%EOF\n', 'latin1'),
    Buffer.from('%PDF-1.4\nstream\nendstream\n%%EOF\n', 'latin1'),
    Buffer.from('%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n'.repeat(50), 'latin1'),
  ];

  for (const bytes of nonsense) {
    const result = extractPdfText(bytes);
    assert.equal(typeof result.ok, 'boolean');
    if (!result.ok) assert.equal(typeof result.reason, 'string');
  }
});

test('trailing whitespace is trimmed and runs of blank lines are collapsed', () => {
  const result = textOf('BT /F1 12 Tf 10 700 Td (top) Tj 0 -400 Td (bottom) Tj ET');

  assert.equal(result.ok, true);
  assert.ok(!/[ \t]+\n/.test(result.body), 'no line may end in trailing whitespace');
  assert.ok(!/\n{3,}/.test(result.body), 'no run of three or more newlines may survive');
});

test('the extractor reads bytes and never touches the filesystem', () => {
  // A converter that quietly read a path would be a very different security
  // proposition. The module requires only zlib, so this is a structural check.
  const source = require('node:fs').readFileSync(require.resolve('../src/main/pdf-text.js'), 'utf8');

  for (const forbidden of ["require('node:fs')", 'require("node:fs")', "require('fs')", 'require("fs")']) {
    assert.ok(!source.includes(forbidden), `the extractor must not ${forbidden}`);
  }
  for (const forbidden of ['child_process', 'node:http', 'fetch(']) {
    assert.ok(!source.includes(forbidden), `the extractor must not reach for ${forbidden}`);
  }
});
