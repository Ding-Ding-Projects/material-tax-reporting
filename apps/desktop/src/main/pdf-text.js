'use strict';

/**
 * Bundled portable-document text-layer extraction.
 *
 * This reads the text a document already carries and nothing else. It is not
 * optical character recognition: a page that holds only a scanned picture has
 * no text layer, and this refuses that page by name rather than returning an
 * empty file that reads as a successful conversion.
 *
 * Everything it needs ships with the application. Inflation uses the runtime's
 * own zlib, so no document runtime is downloaded, discovered on the machine, or
 * required at packaging time. Nothing here reaches the network.
 *
 * Extracted text is never confirmed tax data. Anything that later feeds a
 * report still has to pass the manual parser-confirmation step, exactly as an
 * attachment does.
 */

const zlib = require('node:zlib');

const MAX_OBJECTS = 60_000;
const MAX_STREAM_BYTES = 64 * 1024 * 1024;
const MAX_PAGES = 5_000;
const MAX_OUTPUT_CHARS = 8 * 1024 * 1024;
const MAX_TREE_DEPTH = 64;
/** A negative adjustment at least this wide inside a TJ array reads as a space. */
const SPACE_ADJUSTMENT = -150;
/**
 * How far past a run's estimated advance the next run must start before a space
 * is inserted. Measured across real documents: at 0.4 em the rule recovers word
 * breaks a document lays out as separate positioned runs while leaving a
 * document that positions every glyph individually unsplit. Tightening it much
 * below this starts inserting a space between letters.
 */
const SPACE_MARGIN_EM = 0.4;

/** Windows-1252 differs from Latin-1 only across 0x80-0x9F. */
const WIN_ANSI_HIGH = [
  0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008d, 0x017d, 0x008f,
  0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178,
];

function isWhitespaceCode(code) {
  return code === 0x00 || code === 0x09 || code === 0x0a || code === 0x0c || code === 0x0d || code === 0x20;
}

function isDelimiter(character) {
  return character === '(' || character === ')' || character === '<' || character === '>'
    || character === '[' || character === ']' || character === '{' || character === '}'
    || character === '/' || character === '%';
}

/** A parsed name, kept distinct from a plain string so `/Page` never collides with `(Page)`. */
function nameOf(value) {
  return { pdfName: value };
}

function isName(value, expected) {
  return Boolean(value) && typeof value === 'object' && value.pdfName === expected;
}

/**
 * A lexer over the document's bytes held as a latin1 string, which maps one
 * byte to one code unit and therefore round-trips binary content exactly.
 */
class PdfLexer {
  constructor(source, position = 0) {
    this.source = source;
    this.position = position;
  }

  skipBlanks() {
    while (this.position < this.source.length) {
      const code = this.source.charCodeAt(this.position);
      if (isWhitespaceCode(code)) { this.position += 1; continue; }
      if (this.source[this.position] === '%') {
        while (this.position < this.source.length && this.source.charCodeAt(this.position) !== 0x0a && this.source.charCodeAt(this.position) !== 0x0d) this.position += 1;
        continue;
      }
      return;
    }
  }

  readRegular() {
    const start = this.position;
    while (this.position < this.source.length) {
      const character = this.source[this.position];
      if (isWhitespaceCode(character.charCodeAt(0)) || isDelimiter(character)) break;
      this.position += 1;
    }
    return this.source.slice(start, this.position);
  }

  readName() {
    this.position += 1;
    const raw = this.readRegular();
    return nameOf(raw.replace(/#([0-9A-Fa-f]{2})/g, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16))));
  }

  /** A literal string. Returns raw bytes, because the encoding is the font's business. */
  readLiteralString() {
    this.position += 1;
    let depth = 1;
    let out = '';
    while (this.position < this.source.length) {
      const character = this.source[this.position];
      this.position += 1;
      if (character === '\\') {
        const escaped = this.source[this.position];
        this.position += 1;
        if (escaped === 'n') out += '\n';
        else if (escaped === 'r') out += '\r';
        else if (escaped === 't') out += '\t';
        else if (escaped === 'b') out += '\b';
        else if (escaped === 'f') out += '\f';
        else if (escaped === '\n') { /* a line continuation contributes nothing */ }
        else if (escaped === '\r') { if (this.source[this.position] === '\n') this.position += 1; }
        else if (escaped >= '0' && escaped <= '7') {
          let digits = escaped;
          while (digits.length < 3 && this.source[this.position] >= '0' && this.source[this.position] <= '7') {
            digits += this.source[this.position];
            this.position += 1;
          }
          out += String.fromCharCode(Number.parseInt(digits, 8) & 0xff);
        } else out += escaped ?? '';
        continue;
      }
      if (character === '(') { depth += 1; out += character; continue; }
      if (character === ')') { depth -= 1; if (depth === 0) break; out += character; continue; }
      out += character;
    }
    return { pdfString: out };
  }

  readHexString() {
    this.position += 1;
    let digits = '';
    while (this.position < this.source.length && this.source[this.position] !== '>') {
      const character = this.source[this.position];
      this.position += 1;
      if (/[0-9A-Fa-f]/.test(character)) digits += character;
    }
    this.position += 1;
    if (digits.length % 2 === 1) digits += '0';
    let out = '';
    for (let index = 0; index < digits.length; index += 2) out += String.fromCharCode(Number.parseInt(digits.slice(index, index + 2), 16));
    return { pdfString: out };
  }

  readDictionary() {
    this.position += 2;
    const dictionary = {};
    for (;;) {
      this.skipBlanks();
      if (this.position >= this.source.length) break;
      if (this.source.startsWith('>>', this.position)) { this.position += 2; break; }
      if (this.source[this.position] !== '/') { this.position += 1; continue; }
      const key = this.readName().pdfName;
      const value = this.parseObject();
      dictionary[key] = value;
    }
    return dictionary;
  }

  readArray() {
    this.position += 1;
    const items = [];
    for (;;) {
      this.skipBlanks();
      if (this.position >= this.source.length) break;
      if (this.source[this.position] === ']') { this.position += 1; break; }
      const before = this.position;
      items.push(this.parseObject());
      if (this.position === before) { this.position += 1; }
    }
    return items;
  }

  /** Parses one object. Operators in a content stream come back as `{ operator }`. */
  parseObject() {
    this.skipBlanks();
    if (this.position >= this.source.length) return null;
    const character = this.source[this.position];
    if (character === '/') return this.readName();
    if (character === '(') return this.readLiteralString();
    if (character === '[') return this.readArray();
    if (character === '<') return this.source.startsWith('<<', this.position) ? this.readDictionary() : this.readHexString();
    if (character === ']' || character === '>' || character === ')' || character === '}' || character === '{') { this.position += 1; return null; }
    const token = this.readRegular();
    if (token === '') { this.position += 1; return null; }
    if (token === 'true') return true;
    if (token === 'false') return false;
    if (token === 'null') return null;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(token)) {
      const numeric = Number.parseFloat(token);
      if (/^\d+$/.test(token)) {
        // `12 0 R` is a reference; anything else leaves the integer alone.
        const save = this.position;
        this.skipBlanks();
        const generationStart = this.position;
        const generation = this.readRegular();
        if (/^\d+$/.test(generation)) {
          this.skipBlanks();
          const keyword = this.readRegular();
          if (keyword === 'R') return { ref: numeric, gen: Number.parseInt(generation, 10) };
        }
        this.position = generationStart === this.position ? save : save;
      }
      return numeric;
    }
    return { operator: token };
  }
}

function inflate(bytes) {
  const options = { finishFlush: zlib.constants.Z_SYNC_FLUSH, maxOutputLength: MAX_STREAM_BYTES };
  try {
    return zlib.inflateSync(bytes, options);
  } catch {
    try { return zlib.inflateRawSync(bytes, options); } catch { return null; }
  }
}

function filterNames(dictionary) {
  const filter = dictionary?.Filter;
  if (!filter) return [];
  const list = Array.isArray(filter) ? filter : [filter];
  return list.filter((entry) => entry && typeof entry === 'object' && typeof entry.pdfName === 'string').map((entry) => entry.pdfName);
}

/** True when the stream declares a predictor this build does not un-filter. */
function hasPredictor(dictionary) {
  const parms = dictionary?.DecodeParms;
  const list = Array.isArray(parms) ? parms : [parms];
  return list.some((entry) => entry && typeof entry === 'object' && typeof entry.Predictor === 'number' && entry.Predictor > 1);
}

/**
 * Scans the file for `N G obj ... endobj` bodies. Scanning rather than following
 * the cross-reference table means a document with a cross-reference stream, an
 * incremental update, or a damaged table is still readable.
 */
function scanObjects(source) {
  const objects = new Map();
  const pattern = /(\d{1,10})\s+(\d{1,5})\s+obj\b/g;
  let match;
  let scanned = 0;
  while ((match = pattern.exec(source)) !== null) {
    if (scanned >= MAX_OBJECTS) break;
    scanned += 1;
    const number = Number.parseInt(match[1], 10);
    const bodyStart = match.index + match[0].length;
    const lexer = new PdfLexer(source, bodyStart);
    let value;
    try { value = lexer.parseObject(); } catch { continue; }
    let stream = null;
    lexer.skipBlanks();
    if (source.startsWith('stream', lexer.position)) {
      let dataStart = lexer.position + 'stream'.length;
      if (source[dataStart] === '\r') dataStart += 1;
      if (source[dataStart] === '\n') dataStart += 1;
      let dataEnd = -1;
      const declared = value && typeof value === 'object' && typeof value.Length === 'number' ? value.Length : null;
      if (declared !== null && declared >= 0 && dataStart + declared <= source.length) {
        const tail = source.slice(dataStart + declared, dataStart + declared + 20);
        if (/^\s*endstream/.test(tail)) dataEnd = dataStart + declared;
      }
      if (dataEnd < 0) {
        const found = source.indexOf('endstream', dataStart);
        if (found > dataStart) {
          dataEnd = found;
          while (dataEnd > dataStart && (source.charCodeAt(dataEnd - 1) === 0x0a || source.charCodeAt(dataEnd - 1) === 0x0d)) dataEnd -= 1;
        }
      }
      if (dataEnd > dataStart && dataEnd - dataStart <= MAX_STREAM_BYTES) {
        stream = Buffer.from(source.slice(dataStart, dataEnd), 'latin1');
      }
    }
    // A later incremental update legitimately supersedes an earlier object.
    objects.set(number, { value, stream });
  }
  return objects;
}

/** Returns the decoded bytes of a stream object, or null when it is not text this build reads. */
function decodedStream(entry) {
  if (!entry?.stream) return null;
  const dictionary = entry.value && typeof entry.value === 'object' ? entry.value : {};
  const filters = filterNames(dictionary);
  if (filters.length === 0) return entry.stream;
  if (filters.length === 1 && filters[0] === 'FlateDecode') {
    if (hasPredictor(dictionary)) return null;
    return inflate(entry.stream);
  }
  return null;
}

/**
 * Expands the objects held inside compressed object streams, which is where a
 * modern document keeps its page and font dictionaries.
 */
function expandObjectStreams(objects) {
  for (const entry of [...objects.values()]) {
    if (!isName(entry.value?.Type, 'ObjStm')) continue;
    const bytes = decodedStream(entry);
    if (!bytes) continue;
    const count = typeof entry.value.N === 'number' ? entry.value.N : 0;
    const first = typeof entry.value.First === 'number' ? entry.value.First : -1;
    if (count < 1 || first < 0 || first > bytes.length) continue;
    const source = bytes.toString('latin1');
    const header = new PdfLexer(source, 0);
    const pairs = [];
    for (let index = 0; index < count && index < MAX_OBJECTS; index += 1) {
      header.skipBlanks();
      const number = header.readRegular();
      header.skipBlanks();
      const offset = header.readRegular();
      if (!/^\d+$/.test(number) || !/^\d+$/.test(offset)) break;
      pairs.push({ number: Number.parseInt(number, 10), offset: Number.parseInt(offset, 10) });
    }
    for (const pair of pairs) {
      const start = first + pair.offset;
      if (start < 0 || start >= source.length) continue;
      if (objects.has(pair.number) && objects.get(pair.number).stream) continue;
      try {
        objects.set(pair.number, { value: new PdfLexer(source, start).parseObject(), stream: null });
      } catch { /* an unreadable embedded object is skipped rather than guessed at */ }
    }
  }
  return objects;
}

function makeResolver(objects) {
  return function resolve(value, depth = 0) {
    if (depth > 32) return null;
    if (value && typeof value === 'object' && typeof value.ref === 'number') {
      const entry = objects.get(value.ref);
      return entry ? resolve(entry.value, depth + 1) : null;
    }
    return value;
  };
}

/** Walks the page tree, falling back to document order when there is no catalog. */
function collectPages(objects, resolve) {
  const pages = [];
  const seen = new Set();
  const visit = (node, inherited, depth) => {
    if (pages.length >= MAX_PAGES || depth > MAX_TREE_DEPTH) return;
    const dictionary = resolve(node);
    if (!dictionary || typeof dictionary !== 'object' || Array.isArray(dictionary)) return;
    const resources = dictionary.Resources ?? inherited;
    if (isName(dictionary.Type, 'Page')) { pages.push({ dictionary, resources }); return; }
    const kids = resolve(dictionary.Kids);
    if (!Array.isArray(kids)) return;
    for (const kid of kids) {
      const key = kid && typeof kid === 'object' && typeof kid.ref === 'number' ? kid.ref : null;
      if (key !== null) { if (seen.has(key)) continue; seen.add(key); }
      visit(kid, resources, depth + 1);
    }
  };

  for (const entry of objects.values()) {
    if (!isName(entry.value?.Type, 'Catalog')) continue;
    visit(entry.value.Pages, null, 0);
    if (pages.length > 0) return pages;
  }
  for (const [number, entry] of [...objects.entries()].sort((left, right) => left[0] - right[0])) {
    if (pages.length >= MAX_PAGES) break;
    if (!isName(entry.value?.Type, 'Page') || seen.has(number)) continue;
    pages.push({ dictionary: entry.value, resources: entry.value.Resources });
  }
  return pages;
}

function utf16BeToString(bytes) {
  let out = '';
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    out += String.fromCharCode((bytes.charCodeAt(index) << 8) | bytes.charCodeAt(index + 1));
  }
  if (bytes.length % 2 === 1) out += bytes[bytes.length - 1];
  return out;
}

function codeOf(raw) {
  let value = 0;
  for (let index = 0; index < raw.length; index += 1) value = (value << 8) | (raw.charCodeAt(index) & 0xff);
  return value;
}

/** Parses a ToUnicode CMap into a code-to-text map plus the code width it uses. */
function parseToUnicode(text) {
  const map = new Map();
  let byteWidth = 1;
  const lexer = new PdfLexer(text, 0);
  let pending = [];
  for (;;) {
    const before = lexer.position;
    if (before >= text.length) break;
    let token;
    try { token = lexer.parseObject(); } catch { break; }
    if (lexer.position === before) { lexer.position += 1; continue; }
    if (token && typeof token === 'object' && typeof token.operator === 'string') {
      if (token.operator === 'endbfchar') {
        for (let index = 0; index + 1 < pending.length; index += 2) {
          const source = pending[index];
          const target = pending[index + 1];
          if (!source?.pdfString || !target?.pdfString) continue;
          byteWidth = Math.max(byteWidth, source.pdfString.length);
          map.set(codeOf(source.pdfString), utf16BeToString(target.pdfString));
        }
      } else if (token.operator === 'endbfrange') {
        for (let index = 0; index + 2 < pending.length; index += 3) {
          const low = pending[index];
          const high = pending[index + 1];
          const target = pending[index + 2];
          if (!low?.pdfString || !high?.pdfString) continue;
          byteWidth = Math.max(byteWidth, low.pdfString.length);
          const start = codeOf(low.pdfString);
          const end = codeOf(high.pdfString);
          if (end < start || end - start > 65_535) continue;
          if (Array.isArray(target)) {
            for (let step = 0; step <= end - start && step < target.length; step += 1) {
              if (target[step]?.pdfString) map.set(start + step, utf16BeToString(target[step].pdfString));
            }
          } else if (target?.pdfString) {
            const base = utf16BeToString(target.pdfString);
            const tail = base.charCodeAt(base.length - 1);
            for (let step = 0; step <= end - start; step += 1) {
              map.set(start + step, `${base.slice(0, -1)}${String.fromCharCode(tail + step)}`);
            }
          }
        }
      }
      pending = [];
      continue;
    }
    pending.push(token);
    if (pending.length > 3_000) pending = pending.slice(-3_000);
  }
  return { map, byteWidth: byteWidth >= 2 ? 2 : 1 };
}

/** Builds one decoder per font resource name used by a page. */
function buildFonts(resources, objects, resolve) {
  const fonts = new Map();
  const fontDictionary = resolve(resolve(resources)?.Font);
  if (!fontDictionary || typeof fontDictionary !== 'object') return fonts;
  for (const [resourceName, reference] of Object.entries(fontDictionary)) {
    const font = resolve(reference);
    if (!font || typeof font !== 'object') continue;
    let decoder = null;
    const toUnicodeReference = font.ToUnicode;
    if (toUnicodeReference && typeof toUnicodeReference === 'object' && typeof toUnicodeReference.ref === 'number') {
      const bytes = decodedStream(objects.get(toUnicodeReference.ref));
      if (bytes) decoder = parseToUnicode(bytes.toString('latin1'));
    }
    const composite = isName(font.Subtype, 'Type0');
    fonts.set(resourceName, {
      map: decoder?.map ?? null,
      byteWidth: decoder?.byteWidth ?? (composite ? 2 : 1),
    });
  }
  return fonts;
}

function decodeWithFont(raw, font) {
  if (!font) {
    let out = '';
    for (let index = 0; index < raw.length; index += 1) {
      const code = raw.charCodeAt(index) & 0xff;
      out += code >= 0x80 && code <= 0x9f ? String.fromCharCode(WIN_ANSI_HIGH[code - 0x80]) : String.fromCharCode(code);
    }
    return out;
  }
  const width = font.byteWidth;
  let out = '';
  for (let index = 0; index + width <= raw.length || (width === 1 && index < raw.length); index += width) {
    const code = codeOf(raw.slice(index, index + width));
    const mapped = font.map?.get(code);
    if (mapped !== undefined) { out += mapped; continue; }
    if (width === 1) {
      out += code >= 0x80 && code <= 0x9f ? String.fromCharCode(WIN_ANSI_HIGH[code - 0x80]) : String.fromCharCode(code);
    } else if (code >= 32 && code <= 0x10ffff) {
      out += String.fromCharCode(code);
    }
  }
  return out;
}

/**
 * Reads one page's content stream, emitting a line break where the text moves
 * to a new vertical position and a space where it jumps further along the same
 * line than the previous run could have occupied.
 *
 * Glyph widths are not resolved from the font program, so the advance of a
 * shown run is estimated from its length at an average half-em. The comparison
 * is deliberately generous: a document that positions every glyph individually
 * must not gain a space between every letter, which matters more than
 * recovering every space in a document that positions whole words.
 */
function extractPageText(content, fonts) {
  const lexer = new PdfLexer(content, 0);
  let operands = [];
  let font = null;
  let leading = 0;
  let fontSize = 0;
  let horizontalScale = 1;
  let currentX = 0;
  let currentY = 0;
  let lastX = null;
  let lastY = null;
  let lastRunLength = 0;
  let out = '';
  const append = (text) => {
    if (out.length + text.length > MAX_OUTPUT_CHARS) throw new Error('output-limit');
    out += text;
  };
  const separate = () => {
    if (lastY === null) return;
    if (Math.abs(currentY - lastY) > 0.5) { append('\n'); return; }
    const em = Math.abs(fontSize * horizontalScale);
    if (em <= 0 || out.length === 0 || /\s$/.test(out)) return;
    const advanced = lastRunLength * em * 0.5;
    if (currentX - lastX > advanced + em * SPACE_MARGIN_EM) append(' ');
  };
  const remember = (text) => {
    lastX = currentX;
    lastY = currentY;
    lastRunLength = text.length;
  };
  const show = (raw) => {
    const text = decodeWithFont(raw, font);
    if (text.length === 0) return;
    separate();
    append(text);
    remember(text);
  };

  for (;;) {
    const before = lexer.position;
    if (before >= content.length) break;
    let token;
    try { token = lexer.parseObject(); } catch { break; }
    if (lexer.position === before) { lexer.position += 1; continue; }
    if (!token || typeof token !== 'object' || typeof token.operator !== 'string') {
      operands.push(token);
      if (operands.length > 512) operands = operands.slice(-512);
      continue;
    }
    const operator = token.operator;
    const numeric = (index) => (typeof operands[index] === 'number' ? operands[index] : 0);
    if (operator === 'BT') { currentX = 0; currentY = 0; lastX = null; lastY = null; lastRunLength = 0; horizontalScale = 1; }
    else if (operator === 'Tf') {
      const name = operands[operands.length - 2];
      font = name?.pdfName ? fonts.get(name.pdfName) ?? null : font;
      fontSize = numeric(operands.length - 1);
    }
    else if (operator === 'TL') { leading = numeric(operands.length - 1); }
    else if (operator === 'Td') { currentX += numeric(operands.length - 2); currentY += numeric(operands.length - 1); }
    else if (operator === 'TD') { const ty = numeric(operands.length - 1); leading = -ty; currentX += numeric(operands.length - 2); currentY += ty; }
    else if (operator === 'Tm') {
      // A document commonly carries the type size in the matrix rather than in
      // Tf, so the horizontal scale is what makes an em mean anything here.
      horizontalScale = Math.abs(numeric(operands.length - 6)) || 1;
      currentX = numeric(operands.length - 2);
      currentY = numeric(operands.length - 1);
    }
    else if (operator === 'T*') { currentY -= leading; }
    else if (operator === 'Tj') { const value = operands[operands.length - 1]; if (value?.pdfString !== undefined) show(value.pdfString); }
    else if (operator === "'") { currentY -= leading; const value = operands[operands.length - 1]; if (value?.pdfString !== undefined) show(value.pdfString); }
    else if (operator === '"') { currentY -= leading; const value = operands[operands.length - 1]; if (value?.pdfString !== undefined) show(value.pdfString); }
    else if (operator === 'TJ') {
      const array = operands[operands.length - 1];
      if (Array.isArray(array)) {
        let piece = '';
        for (const part of array) {
          if (part?.pdfString !== undefined) piece += decodeWithFont(part.pdfString, font);
          else if (typeof part === 'number' && part <= SPACE_ADJUSTMENT && piece.length > 0 && !piece.endsWith(' ')) piece += ' ';
        }
        if (piece.length > 0) { separate(); append(piece); remember(piece); }
      }
    }
    operands = [];
  }
  return out;
}

/**
 * Extracts the text layer of a document.
 *
 * Returns a named refusal rather than an empty success when the document is
 * encrypted, unreadable, or carries no text layer at all.
 */
function extractPdfText(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 8) {
    return { ok: false, reason: 'This file is too small to be a portable document.' };
  }
  const source = bytes.toString('latin1');
  if (!source.slice(0, 1024).includes('%PDF-')) {
    return { ok: false, reason: 'This file does not begin with a portable-document header.' };
  }
  if (/\/Encrypt\b/.test(source)) {
    return {
      ok: false,
      reason: 'This document is encrypted. Open it in the application that produced it, save an unencrypted copy, and convert that copy.',
    };
  }

  let objects;
  try {
    objects = expandObjectStreams(scanObjects(source));
  } catch {
    return { ok: false, reason: 'The document structure could not be read.' };
  }
  if (objects.size === 0) return { ok: false, reason: 'The document contains no readable objects.' };

  const resolve = makeResolver(objects);
  const pages = collectPages(objects, resolve);
  if (pages.length === 0) return { ok: false, reason: 'No pages could be located in this document.' };

  const parts = [];
  let unreadableStreams = 0;
  try {
    for (const page of pages) {
      const fonts = buildFonts(page.resources, objects, resolve);
      const contents = resolve(page.dictionary.Contents);
      const references = Array.isArray(contents) ? contents : [page.dictionary.Contents];
      let content = '';
      for (const reference of references) {
        if (!reference || typeof reference !== 'object' || typeof reference.ref !== 'number') continue;
        const decoded = decodedStream(objects.get(reference.ref));
        if (!decoded) { unreadableStreams += 1; continue; }
        content += `${decoded.toString('latin1')}\n`;
      }
      if (content.length === 0) continue;
      const text = extractPageText(content, fonts);
      if (text.trim().length > 0) parts.push(text);
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'output-limit') {
      return { ok: false, reason: `This document produces more than ${MAX_OUTPUT_CHARS} characters of text, which is beyond the conversion limit.` };
    }
    return { ok: false, reason: 'The document content could not be read.' };
  }

  if (parts.length === 0) {
    return {
      ok: false,
      reason: unreadableStreams > 0
        ? 'No text layer could be read from this document; its page content uses a compression this build does not decode.'
        : 'This document has no text layer, so there is nothing to extract. A scanned page needs optical character recognition, which this build lists as unavailable.',
    };
  }

  const body = parts
    .join('\n\n')
    .replaceAll('\r\n', '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
  return { ok: true, body: `${body}\n`, pages: pages.length, pagesWithText: parts.length };
}

module.exports = { extractPdfText };
