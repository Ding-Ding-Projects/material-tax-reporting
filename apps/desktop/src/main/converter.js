'use strict';

/**
 * Local file conversion.
 *
 * Every conversion runs in the privileged boundary against files a person
 * chose, is bounded by the same limit as an attachment, and is strictly
 * offline. Output is written only to a path chosen through a save dialog.
 *
 * The catalogue is honest about what is present: an adapter that is not
 * bundled is listed as a disabled row naming exactly what is missing, rather
 * than being hidden. Nothing produced here is treated as confirmed tax data;
 * converted output that later feeds a report still has to pass the existing
 * manual parser-confirmation gate.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { ConverterRegistry, convertWithRegistry, neutralizeCsvCell } = require('@material-tax-reporting/surface-kernel');

const MAX_ROWS = 50_000;
const MAX_CELLS_PER_ROW = 512;

function splitCsv(input) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') { cell += '"'; index += 1; } else quoted = false;
      } else cell += character;
      continue;
    }
    if (character === '"') { quoted = true; continue; }
    if (character === ',') { row.push(cell); cell = ''; continue; }
    if (character === '\n' || character === '\r') {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(cell); cell = '';
      rows.push(row); row = [];
      if (rows.length > MAX_ROWS) throw new Error('row-limit');
      continue;
    }
    cell += character;
  }
  row.push(cell);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

function csvToJson(input) {
  const rows = splitCsv(input);
  if (rows.length === 0) return { ok: false, reason: 'The file contains no rows.' };
  const headers = rows[0].map((header, index) => header.trim() || `column${index + 1}`);
  const records = rows.slice(1).map((cells) => {
    const record = {};
    headers.forEach((header, index) => { record[header] = cells[index] ?? ''; });
    return record;
  });
  return { ok: true, body: `${JSON.stringify({ schemaVersion: 1, headers, rows: records }, null, 2)}\n` };
}

function jsonToCsv(input) {
  let parsed;
  try { parsed = JSON.parse(input); } catch { return { ok: false, reason: 'The file is not valid JSON.' }; }
  const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.rows) ? parsed.rows : null;
  if (!rows) return { ok: false, reason: 'Provide a JSON array, or an object with a rows array.' };
  if (rows.length > MAX_ROWS) return { ok: false, reason: `At most ${MAX_ROWS} rows are converted at once.` };
  const headers = [...new Set(rows.flatMap((row) => (row && typeof row === 'object' && !Array.isArray(row) ? Object.keys(row) : [])))].slice(0, MAX_CELLS_PER_ROW);
  if (headers.length === 0) return { ok: false, reason: 'Every row must be an object with at least one field.' };
  const lines = [headers.map((header) => neutralizeCsvCell(header)).join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => neutralizeCsvCell(String(row?.[header] ?? ''))).join(','));
  }
  return { ok: true, body: `${lines.join('\r\n')}\r\n` };
}

function markdownTableToCsv(input) {
  const lines = input.replaceAll('\r\n', '\n').split('\n').map((line) => line.trim()).filter((line) => line.startsWith('|'));
  if (lines.length < 2) return { ok: false, reason: 'No pipe table was found in the file.' };
  const cells = lines
    .filter((line) => !/^\|[\s:|-]+\|$/.test(line))
    .map((line) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim()));
  if (cells.length === 0) return { ok: false, reason: 'The pipe table has no data rows.' };
  return { ok: true, body: `${cells.map((row) => row.map((cell) => neutralizeCsvCell(cell)).join(',')).join('\r\n')}\r\n` };
}

function normalizeText(input) {
  return { ok: true, body: `${input.replaceAll('\r\n', '\n').replace(/[ \t]+$/gm, '').trimEnd()}\n` };
}

function bundledAdapter({ id, category, sourceType, targetType, run, validate }) {
  return {
    id,
    category,
    sourceType,
    targetType,
    bundled: true,
    validate: validate || ((input) => (input.trim().length > 0 ? { ok: true } : { ok: false, reason: 'The file is empty.' })),
    async convert(input, signal) {
      if (signal.aborted) return { ok: false, reason: 'The conversion was cancelled.' };
      try {
        return run(input);
      } catch (error) {
        return { ok: false, reason: error instanceof Error && error.message === 'row-limit' ? `At most ${MAX_ROWS} rows are converted at once.` : 'The file could not be read as the declared source format.' };
      }
    },
  };
}

/** Adapters that need a runtime this build does not carry. */
const UNBUNDLED_ADAPTERS = [
  {
    id: 'pdf-text-to-text',
    category: 'Documents',
    sourceType: 'application/pdf',
    targetType: 'text/plain',
    label: 'Portable document text to plain text',
    missing: 'A bundled document text-extraction runtime is not present in this build, so this row stays disabled.',
  },
  {
    id: 'image-to-text',
    category: 'Documents',
    sourceType: 'image/png',
    targetType: 'text/plain',
    label: 'Scanned image to plain text',
    missing: 'The bundled offline optical character recognition assets were not found in any packaged resource location.',
  },
];

const EXTENSION_TYPES = new Map([
  ['.csv', 'text/csv'],
  ['.json', 'application/json'],
  ['.md', 'text/markdown'],
  ['.markdown', 'text/markdown'],
  ['.txt', 'text/plain'],
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
]);

const ADAPTER_LABELS = new Map([
  ['csv-to-json', 'Comma-separated values to JSON'],
  ['json-to-csv', 'JSON rows to comma-separated values'],
  ['markdown-table-to-csv', 'Markdown pipe table to comma-separated values'],
  ['text-normalize', 'Plain text line-ending and trailing-space normalization'],
]);

const OUTPUT_EXTENSIONS = new Map([
  ['application/json', 'json'],
  ['text/csv', 'csv'],
  ['text/plain', 'txt'],
]);

class FileConverter {
  constructor({ maxBytes, offlineOcrStatus }) {
    this.maxBytes = maxBytes;
    this.offlineOcrStatus = offlineOcrStatus;
    this.registry = new ConverterRegistry();
    this.registry.register(bundledAdapter({ id: 'csv-to-json', category: 'Tabular data', sourceType: 'text/csv', targetType: 'application/json', run: csvToJson }));
    this.registry.register(bundledAdapter({ id: 'json-to-csv', category: 'Tabular data', sourceType: 'application/json', targetType: 'text/csv', run: jsonToCsv }));
    this.registry.register(bundledAdapter({ id: 'markdown-table-to-csv', category: 'Documents', sourceType: 'text/markdown', targetType: 'text/csv', run: markdownTableToCsv }));
    this.registry.register(bundledAdapter({ id: 'text-normalize', category: 'Plain text', sourceType: 'text/plain', targetType: 'text/plain', run: normalizeText }));
    this.staged = new Map();
    this.jobs = new Map();
  }

  /** Guided categories with every adapter, bundled and unbundled alike. */
  catalog() {
    const ocr = this.offlineOcrStatus();
    const bundled = this.registry.list().map((adapter) => ({
      id: adapter.id,
      label: ADAPTER_LABELS.get(adapter.id) ?? adapter.id,
      category: adapter.category,
      sourceType: adapter.sourceType,
      targetType: adapter.targetType,
      enabled: true,
      missing: null,
    }));
    const unbundled = UNBUNDLED_ADAPTERS.map((adapter) => ({
      id: adapter.id,
      label: adapter.label,
      category: adapter.category,
      sourceType: adapter.sourceType,
      targetType: adapter.targetType,
      enabled: false,
      missing: adapter.id === 'image-to-text' && !ocr.available ? ocr.missing || adapter.missing : adapter.missing,
    }));
    const adapters = [...bundled, ...unbundled];
    const categories = [...new Set(adapters.map((adapter) => adapter.category))].sort();
    return {
      categories: categories.map((category) => ({
        name: category,
        adapters: adapters.filter((adapter) => adapter.category === category),
      })),
      maxBytes: this.maxBytes,
      offlineOcr: { available: ocr.available, searchedLocations: ocr.searchedLocations },
      boundary:
        'Conversion runs on this computer only. Converted output is not confirmed tax data: anything that later feeds a report still has to pass the manual parser-confirmation step.',
    };
  }

  /** Stages chosen files and reports, per file, whether a conversion is possible. */
  preview(filePaths, adapterId) {
    const adapter = this.registry.list().find((entry) => entry.id === adapterId) || null;
    const jobId = crypto.randomUUID();
    const files = [];
    for (const filePath of filePaths.slice(0, 50)) {
      const extension = path.extname(filePath).toLowerCase();
      const detectedType = EXTENSION_TYPES.get(extension) ?? null;
      let bytes = null;
      let blocker = null;
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) blocker = 'This entry is not a regular file.';
        else if (stat.size < 1) blocker = 'This file is empty.';
        else if (stat.size > this.maxBytes) blocker = `This file is larger than the ${Math.round(this.maxBytes / (1024 * 1024))} MB conversion limit.`;
        else bytes = stat.size;
      } catch {
        blocker = 'This file could not be read.';
      }
      if (!blocker && !adapter) blocker = 'Choose a bundled converter first.';
      if (!blocker && adapter && detectedType !== adapter.sourceType) {
        blocker = `This file looks like ${detectedType ?? 'an unrecognized format'}, and the chosen converter reads ${adapter.sourceType}.`;
      }
      files.push({ path: filePath, displayName: path.basename(filePath), bytes, detectedType, blocker });
    }
    this.staged.set(jobId, { adapterId, files });
    return {
      jobId,
      adapterId,
      files: files.map((file) => ({ displayName: file.displayName, bytes: file.bytes, detectedType: file.detectedType, blocker: file.blocker })),
      convertible: files.filter((file) => !file.blocker).length,
      outputExtension: adapter ? OUTPUT_EXTENSIONS.get(adapter.targetType) ?? 'txt' : 'txt',
    };
  }

  /** Runs the staged conversion, returning one validated result per file. */
  async run(jobId, destinationDirectory) {
    const staged = this.staged.get(jobId);
    if (!staged) throw new Error('Preview the files again before running a conversion.');
    const adapter = this.registry.list().find((entry) => entry.id === staged.adapterId);
    if (!adapter) throw new Error('That converter is not available in this build.');
    const controller = new AbortController();
    this.jobs.set(jobId, controller);
    const outputExtension = OUTPUT_EXTENSIONS.get(adapter.targetType) ?? 'txt';
    const results = [];
    try {
      for (const file of staged.files) {
        if (controller.signal.aborted) {
          results.push({ displayName: file.displayName, ok: false, reason: 'The conversion was cancelled before this file was read.' });
          continue;
        }
        if (file.blocker) {
          results.push({ displayName: file.displayName, ok: false, reason: file.blocker });
          continue;
        }
        let input;
        try {
          input = fs.readFileSync(file.path, 'utf8');
        } catch {
          results.push({ displayName: file.displayName, ok: false, reason: 'This file could not be read as text.' });
          continue;
        }
        const outcome = await convertWithRegistry(this.registry, adapter.sourceType, adapter.targetType, input, controller.signal);
        if (!outcome.ok || typeof outcome.body !== 'string') {
          results.push({ displayName: file.displayName, ok: false, reason: outcome.reason ?? 'The converter refused this file.' });
          continue;
        }
        const outputName = `${path.basename(file.displayName, path.extname(file.displayName))}.${outputExtension}`;
        const outputPath = path.join(destinationDirectory, outputName);
        if (fs.existsSync(outputPath)) {
          results.push({ displayName: file.displayName, ok: false, reason: 'An output file with that name already exists; nothing was overwritten.' });
          continue;
        }
        const bytes = Buffer.from(outcome.body, 'utf8');
        fs.writeFileSync(outputPath, bytes, { flag: 'wx', mode: 0o600 });
        results.push({ displayName: file.displayName, ok: true, outputName, bytes: bytes.length });
      }
    } finally {
      this.jobs.delete(jobId);
      this.staged.delete(jobId);
    }
    return {
      adapterId: adapter.id,
      results,
      succeeded: results.filter((result) => result.ok).length,
      failed: results.filter((result) => !result.ok).length,
      confirmationNotice:
        'Converted output is not confirmed tax data. Attach it and complete the manual parser-confirmation step before any value is treated as reviewed.',
    };
  }

  cancel(jobId) {
    const controller = this.jobs.get(jobId);
    if (controller) controller.abort();
    this.staged.delete(jobId);
    return { jobId, cancelled: Boolean(controller) };
  }
}

module.exports = { FileConverter, UNBUNDLED_ADAPTERS };
