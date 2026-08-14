'use strict';

/**
 * Exports of the currently filtered view.
 *
 * Every export carries a manifest that states the encoding, the schema
 * version, the exact filter, the row count and what was deliberately left out.
 *
 * Redaction of the identity answers is on by default. Including them requires
 * the same kind of typed confirmation the replace-project gate already uses,
 * and the manifest records which choice was made.
 */

const path = require('node:path');
const { atomicWrite } = require('./key-vault');
const { describeOmissions, serializeExport } = require('@material-tax-reporting/surface-kernel');

const MAX_ROWS = 20_000;
const MAX_CELL_LENGTH = 4000;
const MAX_COLUMNS = 40;
const FORMATS = new Set(['json', 'csv', 'markdown', 'text']);
const REDACTION_MARKER = '[redacted]';
const IDENTITY_CONFIRMATION = 'INCLUDE IDENTITY ANSWERS';

/**
 * The declared identity answers. These match the writable field declarations
 * in the privileged boundary and are replaced by a marker unless the person
 * types the confirmation phrase.
 */
const IDENTITY_PATHS = ['profile.socialInsuranceNumber', 'profile.dateOfBirth', 'residency.address'];

const COLLECTIONS = new Set(['history', 'notifications', 'changelog', 'support-tickets', 'appearance-preset', 'settings']);

function normalizeCell(value) {
  return String(value ?? '').slice(0, MAX_CELL_LENGTH);
}

function redactIdentity(rows, columns) {
  const identityColumns = new Set(columns.filter((column) => IDENTITY_PATHS.includes(column.key)).map((column) => column.key));
  const seen = new Set();
  const redactedRows = rows.map((row) => {
    const next = { ...row };
    for (const key of identityColumns) {
      if (next[key] !== undefined && next[key] !== '') { next[key] = REDACTION_MARKER; seen.add(key); }
    }
    for (const [key, value] of Object.entries(next)) {
      for (const identityPath of IDENTITY_PATHS) {
        if (typeof value === 'string' && value.includes(identityPath)) seen.add(identityPath);
      }
    }
    return next;
  });
  return { rows: redactedRows, redacted: [...seen].sort() };
}

/**
 * Builds the export body. The caller supplies the exact rows the surface is
 * showing, so what is written is what was on screen.
 */
function buildExport({ collection, surface, format, rows, columns, filterDescription, includeIdentity, confirmation, omitted }) {
  if (!COLLECTIONS.has(collection)) throw new Error('Choose one of the listed collections.');
  if (!FORMATS.has(format)) throw new Error('Choose JSON, CSV, Markdown or plain text.');
  if (!Array.isArray(rows) || rows.length > MAX_ROWS) throw new Error(`An export carries at most ${MAX_ROWS} rows.`);
  if (!Array.isArray(columns) || columns.length < 1 || columns.length > MAX_COLUMNS) throw new Error('An export needs between 1 and 40 columns.');

  const safeColumns = columns
    .filter((column) => column && typeof column.key === 'string' && column.key.length > 0 && column.key.length <= 120)
    .map((column) => ({ key: column.key, label: normalizeCell(column.label || column.key) }));
  const safeRows = rows.map((row) => {
    const next = {};
    for (const column of safeColumns) next[column.key] = normalizeCell(row?.[column.key]);
    return next;
  });

  const wantsIdentity = includeIdentity === true && confirmation === IDENTITY_CONFIRMATION;
  const applied = wantsIdentity ? { rows: safeRows, redacted: [] } : redactIdentity(safeRows, safeColumns);
  const declaredOmissions = Array.isArray(omitted) ? omitted.filter((entry) => typeof entry === 'string').slice(0, 20).map((entry) => normalizeCell(entry)) : [];
  const omissions = [
    ...declaredOmissions,
    'attachment bytes',
    'personal vocabulary content',
    'lock verifiers and authenticator secrets',
  ];

  const manifest = {
    generatedAt: new Date().toISOString(),
    surface,
    collection,
    filterDescription: normalizeCell(filterDescription || 'No filter was applied.'),
    rowCount: applied.rows.length,
    omitted: omissions,
    redacted: wantsIdentity ? [] : (applied.redacted.length > 0 ? applied.redacted : IDENTITY_PATHS),
  };

  const bundle = serializeExport({ rows: applied.rows, columns: safeColumns, manifest, format });
  const header = [
    `Encoding: UTF-8 without a byte-order mark; ${format === 'csv' ? 'CRLF line endings' : 'LF line endings'}.`,
    'Export schema version: 1.',
    `Identity answers: ${wantsIdentity ? 'included after an explicit typed confirmation' : 'replaced by a marker'}.`,
    describeOmissions(manifest.omitted, manifest.redacted),
    'This file records local application state. It does not file or transmit a return.',
  ];

  const body = format === 'json'
    ? `${JSON.stringify({ header, ...JSON.parse(bundle.body) }, null, 2)}\n`
    : `${header.map((line) => (format === 'csv' ? `# ${line}` : `${format === 'markdown' ? '> ' : ''}${line}`)).join(format === 'csv' ? '\r\n' : '\n')}${format === 'csv' ? '\r\n' : '\n'}${bundle.body}`;

  return { fileName: bundle.fileName, mimeType: bundle.mimeType, body, manifest, identityIncluded: wantsIdentity };
}

/** Writes an already-built export to a chosen path. */
function writeExport(destinationPath, body) {
  const resolved = path.resolve(destinationPath);
  const bytes = Buffer.from(body, 'utf8');
  atomicWrite(resolved, bytes);
  return { path: resolved, fileName: path.basename(resolved), bytes: bytes.length };
}

module.exports = {
  COLLECTIONS,
  IDENTITY_CONFIRMATION,
  IDENTITY_PATHS,
  MAX_ROWS,
  REDACTION_MARKER,
  buildExport,
  writeExport,
};
