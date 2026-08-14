'use strict';

/**
 * Portable, encrypted .mtrproject containers.  This module deliberately uses
 * only built-in Node facilities: project data never needs a sidecar database.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MAGIC = Buffer.from('MTRPROJECT\0\x01\0\0\0\0\0', 'binary');
const FORMAT_VERSION = 1;
const MAX_HEADER_BYTES = 1024 * 1024;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_MEMBER_COUNT = 10_000;
const MAX_MEMBER_BYTES = 64 * 1024 * 1024;
const MAX_PAYLOAD_BYTES = 512 * 1024 * 1024;
const MAX_CONTAINER_BYTES = MAX_PAYLOAD_BYTES + MAX_HEADER_BYTES + MAGIC.length + 4 + (16 * MAX_MEMBER_COUNT);
const KDF = Object.freeze({ name: 'scrypt', N: 16384, r: 8, p: 1, keyLength: 32, maxmem: 64 * 1024 * 1024 });
const SCRATCH_PREFIX = 'mtrproject-';
const HISTORY_NAMESPACE = 'material-tax-reporting.local-history.v1';
const HISTORY_ENVELOPE_ALGORITHM = 'aes-256-gcm';
const MAX_LIVE_STATE_BYTES = 64 * 1024 * 1024;
const MAX_PARSER_IMPORTS = 10_000;
const MAX_PARSER_VALUE_COUNT = 100_000;
const MAX_PARSER_CORRECTIONS_PER_IMPORT = 10_000;
const MAX_PARSER_CORRECTED_VALUE_BYTES = 8 * 1024;
const MAX_PARSER_FIELD_IDENTIFIER_BYTES = 128;
const REVIEW_FIELDS = Object.freeze(['forms', 'calculations', 'attachments', 'mailingAddress', 'signatures']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PARSER_LIFECYCLE_STATUSES = new Set(['correction-required', 'corrected', 'confirmed']);
const PARSER_CORRECTION_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

class ProjectArchiveError extends Error {
  constructor(message = 'Project archive could not be processed') {
    super(message);
    this.name = 'ProjectArchiveError';
  }
}

function fail() { throw new ProjectArchiveError(); }

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function encodeJson(value, maximum) {
  const buffer = Buffer.from(JSON.stringify(value), 'utf8');
  if (buffer.length === 0 || buffer.length > maximum) fail();
  return buffer;
}

function decodeJson(buffer, maximum) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > maximum) fail();
  try {
    const parsed = JSON.parse(buffer.toString('utf8'));
    if (!isPlainObject(parsed)) fail();
    return parsed;
  } catch (_) { fail(); }
}

function toBase64(buffer) { return buffer.toString('base64'); }
function fromBase64(value, size) {
  if (typeof value !== 'string' || value.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) fail();
  const result = Buffer.from(value, 'base64');
  if (result.length !== size || toBase64(result) !== value) {
    secureErase(result);
    fail();
  }
  return result;
}

function normalizeArchivePath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1024 || value.includes('\\') || value.includes('\0')) fail();
  if (value.startsWith('/') || value.startsWith('//') || path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || /^[A-Za-z]:/.test(value)) fail();
  const parts = value.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || /:$/.test(part)
    || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(part))) fail();
  const normalized = parts.join('/');
  if (normalized !== value) fail();
  return normalized;
}

function requireExactOwnKeys(value, keys) {
  if (!isPlainObject(value)) fail();
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail();
}

function validateReviewChecklist(value) {
  requireExactOwnKeys(value, REVIEW_FIELDS);
  for (const field of REVIEW_FIELDS) if (typeof value[field] !== 'boolean') fail();
}

function validateIsoTimestamp(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) fail();
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) fail();
}

function normalizeLiveTaxYear(value) {
  const normalized = typeof value === 'number'
    ? value
    : (typeof value === 'string' && /^[0-9]+$/.test(value) ? Number(value) : NaN);
  if (!Number.isSafeInteger(normalized)) fail();
  return normalized;
}

function validateMetadata(metadata, members) {
  if (!isPlainObject(metadata) || !Number.isInteger(metadata.taxYear) || metadata.taxYear < 2000 || metadata.taxYear > 2100) fail();
  if (!isPlainObject(metadata.ruleSource) || !Array.isArray(metadata.ruleSource.references)
    || metadata.ruleSource.references.length === 0 || metadata.ruleSource.references.length > 128) fail();
  for (const reference of metadata.ruleSource.references) {
    if (typeof reference !== 'string' || Buffer.byteLength(reference, 'utf8') === 0
      || Buffer.byteLength(reference, 'utf8') > 2048) fail();
  }
  if (!Array.isArray(metadata.parserConfirmations) || metadata.parserConfirmations.length > MAX_PARSER_IMPORTS) fail();
  validateReviewChecklist(metadata.pdfReviewChecklist);
  const liveStatePath = normalizeArchivePath(metadata.liveStatePath);
  const historyRepositoryPath = normalizeArchivePath(metadata.historyRepositoryPath);
  if (liveStatePath === historyRepositoryPath || liveStatePath.startsWith(`${historyRepositoryPath}/`)
    || historyRepositoryPath.startsWith(`${liveStatePath}/`)) fail();
  if (!Array.isArray(metadata.encryptedAttachments)) fail();
  const known = new Set(members.map((member) => member.path));
  if (!known.has(liveStatePath)) fail();
  if (!members.some((member) => member.path.startsWith(`${historyRepositoryPath}/.git/`))) fail();
  const attachmentPaths = new Set();
  for (const attachment of metadata.encryptedAttachments) {
    const attachmentPath = normalizeArchivePath(typeof attachment === 'string' ? attachment : attachment.path);
    if (!attachmentPath.startsWith('attachments/') || !known.has(attachmentPath) || attachmentPaths.has(attachmentPath)) fail();
    attachmentPaths.add(attachmentPath);
  }
  return { liveStatePath, historyRepositoryPath };
}

function secureErase(buffer) {
  if (Buffer.isBuffer(buffer)) buffer.fill(0);
}

function requireNonEmptyPassword(password) {
  if (!(typeof password === 'string' || Buffer.isBuffer(password)) || password.length === 0) fail();
}

function deriveKey(password, salt, options = KDF) {
  requireNonEmptyPassword(password);
  if (!Buffer.isBuffer(salt) || salt.length !== 16) fail();
  if (options.name !== 'scrypt' || options.N !== KDF.N || options.r !== KDF.r || options.p !== KDF.p
      || options.keyLength !== KDF.keyLength || options.maxmem !== KDF.maxmem) fail();
  const passwordBuffer = Buffer.isBuffer(password) ? Buffer.from(password) : Buffer.from(password, 'utf8');
  try {
    return crypto.scryptSync(passwordBuffer, salt, options.keyLength, { N: options.N, r: options.r, p: options.p, maxmem: options.maxmem });
  } catch (_) { fail(); } finally { secureErase(passwordBuffer); }
}

function encrypt(key, plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), ciphertext };
}

function decrypt(key, iv, tag, ciphertext) {
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (_) { fail(); }
}

function fromBoundedBase64(value, minimum, maximum) {
  if (typeof value !== 'string' || value.length === 0 || !Number.isInteger(minimum) || !Number.isInteger(maximum)
    || minimum < 0 || maximum < minimum || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) fail();
  const result = Buffer.from(value, 'base64');
  if (result.length < minimum || result.length > maximum || toBase64(result) !== value) {
    secureErase(result);
    fail();
  }
  return result;
}

function validateParserAttachmentPath(id, attachmentPath) {
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) fail();
  const normalized = normalizeArchivePath(attachmentPath);
  if (normalized !== `attachments/${id}.bin`) fail();
  return normalized;
}

function parserLifecycleStatus(value) {
  if (typeof value !== 'string' || !PARSER_LIFECYCLE_STATUSES.has(value)) fail();
  return value;
}

function validateParserFieldIdentifier(value) {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') === 0
    || Buffer.byteLength(value, 'utf8') > MAX_PARSER_FIELD_IDENTIFIER_BYTES
    || !PARSER_CORRECTION_IDENTIFIER_PATTERN.test(value)) fail();
}

function validateParserCorrectedValue(value) {
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail();
    return;
  }
  if (typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= MAX_PARSER_CORRECTED_VALUE_BYTES) return;
  fail();
}

function validateParserCorrection(recordId, value) {
  if (!UUID_PATTERN.test(recordId)) fail();
  if (!isPlainObject(value)) fail();
  const status = value.status;
  const keys = status === 'confirmed'
    ? ['id', 'attachmentPath', 'status', 'correctedAt', 'confirmedAt', 'corrections']
    : ['id', 'attachmentPath', 'status', 'correctedAt', 'corrections'];
  requireExactOwnKeys(value, keys);
  if (value.id !== recordId || (status !== 'corrected' && status !== 'confirmed')) fail();
  const attachmentPath = validateParserAttachmentPath(recordId, value.attachmentPath);
  validateIsoTimestamp(value.correctedAt);
  if (status === 'confirmed') validateIsoTimestamp(value.confirmedAt);
  if (!Array.isArray(value.corrections) || value.corrections.length === 0
    || value.corrections.length > MAX_PARSER_CORRECTIONS_PER_IMPORT) fail();

  const correctedFields = new Set();
  for (const correction of value.corrections) {
    requireExactOwnKeys(correction, ['formId', 'boxId', 'lineId', 'value']);
    validateParserFieldIdentifier(correction.formId);
    validateParserFieldIdentifier(correction.boxId);
    validateParserFieldIdentifier(correction.lineId);
    validateParserCorrectedValue(correction.value);
    const fieldKey = `${correction.formId}\0${correction.boxId}\0${correction.lineId}`;
    if (correctedFields.has(fieldKey)) fail();
    correctedFields.add(fieldKey);
  }
  return { attachmentPath, status, correctedAt: value.correctedAt, confirmedAt: value.confirmedAt };
}

function validatePortableLiveState(state, metadata) {
  if (!isPlainObject(state) || state.schemaVersion !== 1 || !isPlainObject(state.wizard)
    || !isPlainObject(state.wizard.answers) || !Object.prototype.hasOwnProperty.call(state.wizard.answers, 'start')) fail();
  if (normalizeLiveTaxYear(state.wizard.answers.start) !== metadata.taxYear) fail();
  validateReviewChecklist(state.review);
  for (const field of REVIEW_FIELDS) if (state.review[field] !== metadata.pdfReviewChecklist[field]) fail();
  if (!Array.isArray(state.imports) || state.imports.length > MAX_PARSER_IMPORTS
    || !isPlainObject(state.parserCorrections) || Object.keys(state.parserCorrections).length > MAX_PARSER_IMPORTS) fail();

  const attachments = new Set();
  for (const attachment of metadata.encryptedAttachments) {
    const attachmentPath = normalizeArchivePath(typeof attachment === 'string' ? attachment : attachment.path);
    if (attachments.has(attachmentPath)) fail();
    attachments.add(attachmentPath);
  }

  const confirmations = new Map();
  const confirmationPaths = new Set();
  for (const confirmation of metadata.parserConfirmations) {
    const keys = confirmation.status === 'confirmed'
      ? ['recordId', 'attachmentPath', 'status', 'importedAt', 'confirmedAt']
      : ['recordId', 'attachmentPath', 'status', 'importedAt'];
    requireExactOwnKeys(confirmation, keys);
    const attachmentPath = validateParserAttachmentPath(confirmation.recordId, confirmation.attachmentPath);
    const status = parserLifecycleStatus(confirmation.status);
    validateIsoTimestamp(confirmation.importedAt);
    if (status === 'confirmed') validateIsoTimestamp(confirmation.confirmedAt);
    if (confirmations.has(confirmation.recordId) || confirmationPaths.has(attachmentPath)) fail();
    confirmations.set(confirmation.recordId, confirmation);
    confirmationPaths.add(attachmentPath);
  }

  const imports = new Map();
  const importPaths = new Set();
  for (const imported of state.imports) {
    requireExactOwnKeys(imported, ['id', 'kind', 'importedAt', 'status', 'valueCount', 'attachmentPath']);
    const attachmentPath = validateParserAttachmentPath(imported.id, imported.attachmentPath);
    if (imported.kind !== 'slip-parser-draft' || !PARSER_LIFECYCLE_STATUSES.has(imported.status)
      || !Number.isInteger(imported.valueCount) || imported.valueCount < 0 || imported.valueCount > MAX_PARSER_VALUE_COUNT) fail();
    validateIsoTimestamp(imported.importedAt);
    if (imports.has(imported.id) || importPaths.has(attachmentPath)) fail();
    imports.set(imported.id, imported);
    importPaths.add(attachmentPath);
  }

  if (imports.size !== confirmations.size || imports.size !== attachments.size) fail();
  for (const [id, imported] of imports) {
    const confirmation = confirmations.get(id);
    if (!confirmation || confirmation.attachmentPath !== imported.attachmentPath
      || confirmation.status !== imported.status || confirmation.importedAt !== imported.importedAt
      || !attachments.has(imported.attachmentPath)) fail();

    const correction = state.parserCorrections[id];
    if (imported.status === 'correction-required') {
      if (correction !== undefined) fail();
      continue;
    }
    const validatedCorrection = validateParserCorrection(id, correction);
    if (validatedCorrection.attachmentPath !== imported.attachmentPath || validatedCorrection.status !== imported.status
      || validatedCorrection.correctedAt < imported.importedAt) fail();
    if (imported.status === 'confirmed') {
      if (validatedCorrection.confirmedAt !== confirmation.confirmedAt
        || validatedCorrection.confirmedAt < validatedCorrection.correctedAt) fail();
    }
  }
  for (const recordId of Object.keys(state.parserCorrections)) if (!imports.has(recordId)) fail();
}

function validatePortableLiveStateEnvelope(envelope, dataKey, metadata) {
  requireExactOwnKeys(envelope, ['schemaVersion', 'algorithm', 'purpose', 'stableIdToken', 'revisionId', 'iv', 'tag', 'ciphertext']);
  if (envelope.schemaVersion !== 1 || envelope.algorithm !== HISTORY_ENVELOPE_ALGORITHM || envelope.purpose !== 'live-state'
    || typeof envelope.revisionId !== 'string' || !UUID_PATTERN.test(envelope.revisionId)
    || typeof envelope.stableIdToken !== 'string' || !/^[a-f0-9]{64}$/.test(envelope.stableIdToken)) fail();
  const expectedStableIdToken = crypto.createHmac('sha256', dataKey)
    .update(HISTORY_NAMESPACE).update('\0').update('application-live-state').digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(envelope.stableIdToken, 'utf8'), Buffer.from(expectedStableIdToken, 'utf8'))) fail();

  let iv;
  let tag;
  let ciphertext;
  let plaintext;
  try {
    iv = fromBase64(envelope.iv, 12);
    tag = fromBase64(envelope.tag, 16);
    ciphertext = fromBoundedBase64(envelope.ciphertext, 1, MAX_LIVE_STATE_BYTES);
    const aad = Buffer.from(`${HISTORY_NAMESPACE}\0${envelope.purpose}\0${envelope.stableIdToken}\0${envelope.revisionId}`, 'utf8');
    try {
      const decipher = crypto.createDecipheriv(HISTORY_ENVELOPE_ALGORITHM, dataKey, iv);
      decipher.setAAD(aad);
      decipher.setAuthTag(tag);
      plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } finally { secureErase(aad); }
    if (plaintext.length === 0 || plaintext.length > MAX_LIVE_STATE_BYTES) fail();
    const payload = decodeJson(plaintext, MAX_LIVE_STATE_BYTES);
    requireExactOwnKeys(payload, ['state', 'sourceRevisionId']);
    if (typeof payload.sourceRevisionId !== 'string' || !UUID_PATTERN.test(payload.sourceRevisionId)) fail();
    validatePortableLiveState(payload.state, metadata);
  } catch (error) {
    if (error instanceof ProjectArchiveError) throw error;
    fail();
  } finally {
    secureErase(iv);
    secureErase(tag);
    secureErase(ciphertext);
    secureErase(plaintext);
  }
}

function validatePreviewLiveState(scratchPath, parsed) {
  const repositoryPath = path.resolve(scratchPath, ...parsed.historyRepositoryPath.split('/'));
  const runtimePath = path.join(repositoryPath, '.runtime');
  if (!repositoryPath.startsWith(`${scratchPath}${path.sep}`) || fs.existsSync(runtimePath)) fail();
  const liveStatePath = path.resolve(scratchPath, ...parsed.liveStatePath.split('/'));
  if (!liveStatePath.startsWith(`${scratchPath}${path.sep}`)) fail();
  let envelopeBytes;
  try {
    const stat = fs.lstatSync(liveStatePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0 || stat.size > MAX_LIVE_STATE_BYTES) fail();
    envelopeBytes = fs.readFileSync(liveStatePath);
    validatePortableLiveStateEnvelope(decodeJson(envelopeBytes, MAX_LIVE_STATE_BYTES), parsed.dataKey, parsed.metadata);
  } finally { secureErase(envelopeBytes); }
}

function wrapDataKey(dataKey, password) {
  requireNonEmptyPassword(password);
  const salt = crypto.randomBytes(16);
  let kek;
  try {
    kek = deriveKey(password, salt);
    const wrapped = encrypt(kek, dataKey);
    return {
      kdf: { ...KDF, salt: toBase64(salt) },
      wrappedKey: { iv: toBase64(wrapped.iv), tag: toBase64(wrapped.tag), ciphertext: toBase64(wrapped.ciphertext) },
    };
  } finally { secureErase(kek); secureErase(salt); }
}

function unwrapDataKey(header, password) {
  requireNonEmptyPassword(password);
  if (!isPlainObject(header.kdf) || !isPlainObject(header.wrappedKey)) fail();
  const salt = fromBase64(header.kdf.salt, 16);
  const iv = fromBase64(header.wrappedKey.iv, 12);
  const tag = fromBase64(header.wrappedKey.tag, 16);
  let kek;
  try {
    kek = deriveKey(password, salt, header.kdf);
    const dataKey = decrypt(kek, iv, tag, fromBase64(header.wrappedKey.ciphertext, 32));
    if (dataKey.length !== 32) fail();
    return dataKey;
  } finally { secureErase(kek); secureErase(salt); secureErase(iv); secureErase(tag); }
}

function relativeArchivePath(root, absolutePath) {
  const relative = path.relative(root, absolutePath).split(path.sep).join('/');
  return normalizeArchivePath(relative);
}

function walkWorkspace(workspacePath) {
  const root = fs.realpathSync(workspacePath);
  if (!fs.statSync(root).isDirectory()) fail();
  const members = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) fail();
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) {
        const stat = fs.statSync(absolute);
        if (stat.size > MAX_MEMBER_BYTES) fail();
        members.push({ path: relativeArchivePath(root, absolute), absolute, size: stat.size });
      } else fail();
    }
  };
  visit(root);
  if (members.length === 0 || members.length > MAX_MEMBER_COUNT) fail();
  members.sort((a, b) => a.path.localeCompare(b.path));
  if (new Set(members.map((member) => member.path)).size !== members.length) fail();
  return { root, members };
}

function buildPlainPayload(workspacePath, metadata) {
  const workspace = walkWorkspace(workspacePath);
  let totalBytes = 0;
  const members = workspace.members.map((member) => {
    const content = fs.readFileSync(member.absolute);
    totalBytes += content.length;
    if (totalBytes > MAX_PAYLOAD_BYTES) fail();
    return { path: member.path, size: content.length, sha256: crypto.createHash('sha256').update(content).digest('hex'), content };
  });
  validateMetadata(metadata, members);
  const manifestMembers = members.map(({ path: memberPath, size, sha256 }) => ({ path: memberPath, size, sha256 }));
  const manifest = encodeJson({ metadata, members: manifestMembers }, MAX_MANIFEST_BYTES);
  if (manifest.length + 4 + totalBytes > MAX_PAYLOAD_BYTES) fail();
  const manifestLength = Buffer.allocUnsafe(4);
  manifestLength.writeUInt32BE(manifest.length, 0);
  return {
    plain: Buffer.concat([manifestLength, manifest, ...members.map((member) => member.content)]),
    memberCount: members.length,
  };
}

function makeHeader(keyWrap, payload, memberCount) {
  return {
    format: 'mtrproject',
    version: FORMAT_VERSION,
    kdf: keyWrap.kdf,
    wrappedKey: keyWrap.wrappedKey,
    payload: { algorithm: 'aes-256-gcm', iv: toBase64(payload.iv), tag: toBase64(payload.tag), length: payload.ciphertext.length },
    memberCount,
  };
}

function atomicWrite(destinationPath, content, replace) {
  const destination = path.resolve(destinationPath);
  if (path.extname(destination).toLowerCase() !== '.mtrproject') fail();
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (!replace && fs.existsSync(destination)) fail();
  const temporary = path.join(path.dirname(destination), `.${path.basename(destination)}.${crypto.randomBytes(12).toString('hex')}.tmp`);
  try {
    fs.writeFileSync(temporary, content, { flag: 'wx', mode: 0o600 });
    const descriptor = fs.openSync(temporary, 'r');
    try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
    if (replace) fs.renameSync(temporary, destination);
    else {
      // link is an atomic no-overwrite publish when both files are in one directory.
      fs.linkSync(temporary, destination);
      fs.unlinkSync(temporary);
    }
  } catch (_) {
    try { fs.unlinkSync(temporary); } catch (_) { /* best effort temporary cleanup */ }
    fail();
  }
}

function resolveProjectPath(projectPath) {
  if (typeof projectPath !== 'string' || projectPath.length === 0) fail();
  const resolved = path.resolve(projectPath);
  if (path.extname(resolved).toLowerCase() !== '.mtrproject') fail();
  return resolved;
}

function serialiseArchive(workspacePath, metadata, dataKey, keyWrap) {
  const payloadSource = buildPlainPayload(workspacePath, metadata);
  let payload;
  try {
    payload = encrypt(dataKey, payloadSource.plain);
    const header = makeHeader(keyWrap, payload, payloadSource.memberCount);
    const headerBytes = encodeJson(header, MAX_HEADER_BYTES);
    const headerLength = Buffer.allocUnsafe(4);
    headerLength.writeUInt32BE(headerBytes.length, 0);
    const result = Buffer.concat([MAGIC, headerLength, headerBytes, payload.ciphertext]);
    if (result.length > MAX_CONTAINER_BYTES) fail();
    return result;
  } finally { secureErase(payloadSource.plain); }
}

function readArchive(projectPath, password) {
  const archive = fs.readFileSync(resolveProjectPath(projectPath));
  if (archive.length > MAX_CONTAINER_BYTES || archive.length < MAGIC.length + 4 + 16) fail();
  if (!archive.subarray(0, MAGIC.length).equals(MAGIC)) fail();
  const headerLength = archive.readUInt32BE(MAGIC.length);
  if (headerLength === 0 || headerLength > MAX_HEADER_BYTES || MAGIC.length + 4 + headerLength >= archive.length) fail();
  const header = decodeJson(archive.subarray(MAGIC.length + 4, MAGIC.length + 4 + headerLength), MAX_HEADER_BYTES);
  if (header.format !== 'mtrproject' || header.version !== FORMAT_VERSION || !Number.isInteger(header.memberCount)
    || header.memberCount < 1 || header.memberCount > MAX_MEMBER_COUNT || !isPlainObject(header.payload)
    || header.payload.algorithm !== 'aes-256-gcm' || !Number.isInteger(header.payload.length)) fail();
  const ciphertext = archive.subarray(MAGIC.length + 4 + headerLength);
  if (ciphertext.length !== header.payload.length || ciphertext.length > MAX_PAYLOAD_BYTES + MAX_MANIFEST_BYTES + 4) fail();
  const dataKey = unwrapDataKey(header, password);
  let plain;
  try {
    plain = decrypt(dataKey, fromBase64(header.payload.iv, 12), fromBase64(header.payload.tag, 16), ciphertext);
    if (plain.length < 5 || plain.length > MAX_PAYLOAD_BYTES) fail();
    const manifestLength = plain.readUInt32BE(0);
    if (manifestLength === 0 || manifestLength > MAX_MANIFEST_BYTES || manifestLength + 4 >= plain.length) fail();
    const manifest = decodeJson(plain.subarray(4, 4 + manifestLength), MAX_MANIFEST_BYTES);
    if (!Array.isArray(manifest.members) || manifest.members.length !== header.memberCount || manifest.members.length > MAX_MEMBER_COUNT) fail();
    let offset = 4 + manifestLength;
    const seen = new Set();
    const members = manifest.members.map((member) => {
      if (!isPlainObject(member) || !Number.isInteger(member.size) || member.size < 0 || member.size > MAX_MEMBER_BYTES
        || typeof member.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(member.sha256)) fail();
      const memberPath = normalizeArchivePath(member.path);
      if (seen.has(memberPath) || offset + member.size > plain.length) fail();
      seen.add(memberPath);
      const content = Buffer.from(plain.subarray(offset, offset + member.size));
      offset += member.size;
      if (crypto.createHash('sha256').update(content).digest('hex') !== member.sha256) fail();
      return { path: memberPath, size: member.size, content };
    });
    if (offset !== plain.length) fail();
    const paths = validateMetadata(manifest.metadata, members);
    return { header, dataKey, metadata: manifest.metadata, members, ...paths };
  } catch (error) {
    secureErase(dataKey);
    if (error instanceof ProjectArchiveError) throw error;
    fail();
  } finally { secureErase(plain); secureErase(archive); }
}

function runGit(workspacePath, args) {
  const result = spawnSync('git', ['-C', workspacePath, ...args], { shell: false, stdio: 'ignore', windowsHide: true });
  if (result.error || result.status !== 0) fail();
}

function runGitText(workspacePath, args, input) {
  const result = spawnSync('git', ['-C', workspacePath, ...args], {
    shell: false,
    encoding: 'utf8',
    input,
    windowsHide: true,
  });
  if (result.error || result.status !== 0 || typeof result.stdout !== 'string') fail();
  return result.stdout.trim();
}

function gitStatusIsClean(repositoryPath) {
  return runGitText(repositoryPath, ['status', '--porcelain=v1', '--untracked-files=all']) === '';
}

function gitHeadCommit(repositoryPath) {
  const commit = runGitText(repositoryPath, ['rev-parse', '--verify', 'HEAD^{commit}']);
  if (!/^[a-f0-9]{40,64}$/i.test(commit)) fail();
  return commit;
}

function listSafeLocalRefs(repositoryPath) {
  const output = runGitText(repositoryPath, ['for-each-ref', '--format=%(refname) %(objecttype)']);
  const refs = output === '' ? [] : output.split(/\r?\n/).map((line) => {
    const match = /^(refs\/(?:heads|tags)\/[A-Za-z0-9][A-Za-z0-9._/-]*|refs\/mtrproject\/imports\/[a-f0-9]{32}\/[A-Za-z0-9][A-Za-z0-9._/-]*) (commit|tag)$/.exec(line);
    if (!match || match[1].includes('..') || match[1].endsWith('/') || match[1].includes('//')) fail();
    return match[1];
  });
  if (new Set(refs).size !== refs.length) fail();
  return refs;
}

function reconciliationFailure() {
  throw new ProjectArchiveError('Reconciliation cannot safely preserve this project. Choose create-copy or replace recovery.');
}

function reconciliationEligibility(active, pending) {
  if (!active || !pending || !Buffer.isBuffer(active.dataKey) || !Buffer.isBuffer(pending.dataKey)
    || active.dataKey.length !== 32 || pending.dataKey.length !== 32) {
    return { eligible: false, reason: 'Reconciliation requires matching project lineage, tax year, and supported archive schema.' };
  }
  const sameLineage = crypto.timingSafeEqual(active.dataKey, pending.dataKey);
  const sameTaxYear = active.metadata && pending.metadata && active.metadata.taxYear === pending.metadata.taxYear;
  const samePaths = active.liveStatePath === pending.liveStatePath
    && active.historyRepositoryPath === pending.historyRepositoryPath;
  const supportedSchema = active.metadata && pending.metadata
    && Number.isInteger(active.metadata.taxYear) && Number.isInteger(pending.metadata.taxYear)
    && active.metadata.taxYear >= 2000 && active.metadata.taxYear <= 2100
    && pending.metadata.taxYear >= 2000 && pending.metadata.taxYear <= 2100;
  return sameLineage && sameTaxYear && samePaths && supportedSchema
    ? { eligible: true }
    : { eligible: false, reason: 'Reconciliation requires matching project lineage, tax year, and supported archive schema.' };
}

function isNestedHistoryGitPath(memberPath, historyRepositoryPath) {
  return memberPath === `${historyRepositoryPath}/.git` || memberPath.startsWith(`${historyRepositoryPath}/.git/`);
}

function clearCandidateWorkspace(candidatePath, historyRepositoryPath) {
  const candidate = walkWorkspace(candidatePath);
  for (const member of candidate.members) {
    if (isNestedHistoryGitPath(member.path, historyRepositoryPath)) continue;
    fs.unlinkSync(member.absolute);
  }
  const repositoryPath = path.resolve(candidatePath, ...historyRepositoryPath.split('/'));
  const prune = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (absolute === path.join(repositoryPath, '.git')) continue;
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        prune(absolute);
        if (absolute !== repositoryPath && fs.readdirSync(absolute).length === 0) fs.rmdirSync(absolute);
      }
    }
  };
  prune(candidatePath);
}

function copyPreviewContentToCandidate(previewPath, candidatePath, historyRepositoryPath) {
  const preview = walkWorkspace(previewPath);
  for (const member of preview.members) {
    if (isNestedHistoryGitPath(member.path, historyRepositoryPath)) continue;
    const target = path.resolve(candidatePath, ...member.path.split('/'));
    if (!target.startsWith(`${candidatePath}${path.sep}`)) fail();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(member.absolute, target, fs.constants.COPYFILE_EXCL);
  }
}

function prepareReconciledCandidate(candidatePath, active, pending) {
  const candidateRepositoryPath = validateExtractedGit(candidatePath, active.metadata);
  const previewRepositoryPath = validateExtractedGit(pending.workspacePath, pending.metadata);
  if (!gitStatusIsClean(candidateRepositoryPath) || !gitStatusIsClean(previewRepositoryPath)
    || fs.existsSync(path.join(candidateRepositoryPath, '.runtime')) || fs.existsSync(path.join(previewRepositoryPath, '.runtime'))) fail();

  const activeTip = gitHeadCommit(candidateRepositoryPath);
  const importedTip = gitHeadCommit(previewRepositoryPath);
  listSafeLocalRefs(candidateRepositoryPath);
  const importedRefs = listSafeLocalRefs(previewRepositoryPath);
  const namespaceId = crypto.randomBytes(16).toString('hex');
  const namespace = `refs/mtrproject/imports/${namespaceId}`;
  if (runGitText(candidateRepositoryPath, ['for-each-ref', '--format=%(refname)', namespace]) !== '') fail();
  const refspecs = [
    `+${importedTip}:${namespace}/head`,
    ...importedRefs.map((ref) => `+${ref}:${namespace}/${ref.slice(5)}`),
  ];
  runGit(candidateRepositoryPath, ['fetch', '--no-tags', '--no-write-fetch-head', previewRepositoryPath, ...refspecs]);
  runGit(candidateRepositoryPath, ['rev-parse', '--verify', `${namespace}/head^{commit}`]);

  clearCandidateWorkspace(candidatePath, active.historyRepositoryPath);
  copyPreviewContentToCandidate(pending.workspacePath, candidatePath, active.historyRepositoryPath);
  runGit(candidateRepositoryPath, ['add', '--all']);
  const tree = runGitText(candidateRepositoryPath, ['write-tree']);
  if (!/^[a-f0-9]{40,64}$/i.test(tree)) fail();
  const reconciliationCommit = runGitText(candidateRepositoryPath, [
    '-c', 'user.name=Material Tax Reporting',
    '-c', 'user.email=noreply@invalid',
    'commit-tree', tree, '-p', activeTip, '-p', `${namespace}/head`, '-m', 'Reconcile portable project histories',
  ]);
  if (!/^[a-f0-9]{40,64}$/i.test(reconciliationCommit)) fail();
  runGit(candidateRepositoryPath, ['update-ref', 'HEAD', reconciliationCommit, activeTip]);
  if (!gitStatusIsClean(candidateRepositoryPath)) fail();
  validateExtractedGit(candidatePath, pending.metadata);
}

function validateExtractedGit(workspacePath, metadata) {
  const historyRepositoryPath = normalizeArchivePath(metadata.historyRepositoryPath);
  const repositoryPath = path.resolve(workspacePath, ...historyRepositoryPath.split('/'));
  if (!repositoryPath.startsWith(`${workspacePath}${path.sep}`) || !fs.existsSync(path.join(repositoryPath, '.git'))) fail();
  const remoteCheck = spawnSync('git', ['-C', repositoryPath, 'config', '--get-regexp', '^remote\\.'], { shell: false, stdio: 'ignore', windowsHide: true });
  if (remoteCheck.error || (remoteCheck.status !== 0 && remoteCheck.status !== 1)) fail();
  if (remoteCheck.status === 0) fail();
  runGit(repositoryPath, ['fsck', '--full', '--strict']);
  return repositoryPath;
}

function revisionCount(workspacePath, metadata) {
  const repositoryPath = validateExtractedGit(workspacePath, metadata);
  const result = spawnSync('git', ['-C', repositoryPath, 'rev-list', '--count', 'HEAD'], {
    shell: false,
    encoding: 'utf8',
    windowsHide: true,
  });
  const output = typeof result.stdout === 'string' ? result.stdout.trim() : '';
  if (result.error || result.status !== 0 || !/^(0|[1-9][0-9]*)$/.test(output)) fail();
  const count = Number(output);
  if (!Number.isSafeInteger(count)) fail();
  return count;
}

function copyMembersToScratch(scratchPath, members) {
  for (const member of members) {
    const target = path.resolve(scratchPath, ...member.path.split('/'));
    if (!target.startsWith(`${scratchPath}${path.sep}`)) fail();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, member.content, { flag: 'wx', mode: 0o600 });
  }
}

function copyWorkspaceToScratch(workspacePath, scratchPath) {
  const source = walkWorkspace(workspacePath);
  for (const member of source.members) {
    const target = path.resolve(scratchPath, ...member.path.split('/'));
    if (!target.startsWith(`${scratchPath}${path.sep}`)) fail();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(member.absolute, target, fs.constants.COPYFILE_EXCL);
  }
}

class ProjectArchiveManager {
  constructor({ scratchRoot = path.join(os.tmpdir(), 'material-tax-reporting-projects') } = {}) {
    this.scratchRoot = path.resolve(scratchRoot);
    this.active = null;
    this.pendingPreview = null;
  }

  getActiveDataKey() { return this.active ? Buffer.from(this.active.dataKey) : null; }

  getActiveProjectSnapshot() {
    if (!this.active) return null;
    return {
      projectPath: this.active.projectPath,
      workspacePath: this.active.workspacePath,
      gitPath: path.join(this.active.workspacePath, ...this.active.historyRepositoryPath.split('/')),
      liveStatePath: path.join(this.active.workspacePath, ...this.active.liveStatePath.split('/')),
      metadata: JSON.parse(JSON.stringify(this.active.metadata)),
      dataKey: Buffer.from(this.active.dataKey),
    };
  }

  preview({ projectPath, password }) {
    if (this.pendingPreview) fail();
    requireNonEmptyPassword(password);
    const resolvedProjectPath = resolveProjectPath(projectPath);
    const parsed = readArchive(resolvedProjectPath, password);
    let scratchPath;
    try {
      fs.mkdirSync(this.scratchRoot, { recursive: true, mode: 0o700 });
      scratchPath = fs.mkdtempSync(path.join(this.scratchRoot, SCRATCH_PREFIX));
      copyMembersToScratch(scratchPath, parsed.members);
      const count = revisionCount(scratchPath, parsed.metadata);
      validatePreviewLiveState(scratchPath, parsed);
      const token = crypto.randomBytes(24).toString('hex');
      this.pendingPreview = {
        token,
        projectPath: resolvedProjectPath,
        workspacePath: scratchPath,
        liveStatePath: parsed.liveStatePath,
        historyRepositoryPath: parsed.historyRepositoryPath,
        metadata: parsed.metadata,
        dataKey: parsed.dataKey,
        keyWrap: { kdf: parsed.header.kdf, wrappedKey: parsed.header.wrappedKey },
      };
      const reconciliation = reconciliationEligibility(this.active, this.pendingPreview);
      return {
        projectPath: resolvedProjectPath,
        metadata: JSON.parse(JSON.stringify(parsed.metadata)),
        memberCount: parsed.members.length,
        totalMemberBytes: parsed.members.reduce((total, member) => total + member.size, 0),
        revisionCount: count,
        attachmentCount: parsed.metadata.encryptedAttachments.length,
        previewToken: token,
        reconcileEligible: reconciliation.eligible,
        ...(this.active && !reconciliation.eligible ? { reconcileIneligibilityReason: reconciliation.reason } : {}),
      };
    } catch (error) {
      secureErase(parsed.dataKey);
      if (scratchPath) this._removeScratch(scratchPath);
      if (error instanceof ProjectArchiveError) throw error;
      fail();
    } finally { parsed.members.forEach((member) => secureErase(member.content)); }
  }

  open({ projectPath, password }) {
    const preview = this.preview({ projectPath, password });
    return this.activatePreview({ previewToken: preview.previewToken, strategy: 'replace' });
  }

  create({ destinationPath, workspacePath, password, metadata }) {
    if (this.active) fail();
    requireNonEmptyPassword(password);
    const dataKey = crypto.randomBytes(32);
    let scratchPath;
    try {
      const destination = resolveProjectPath(destinationPath);
      if (fs.existsSync(destination)) fail();
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      const keyWrap = wrapDataKey(dataKey, password);
      fs.mkdirSync(this.scratchRoot, { recursive: true, mode: 0o700 });
      scratchPath = fs.mkdtempSync(path.join(this.scratchRoot, SCRATCH_PREFIX));
      if (workspacePath !== undefined) copyWorkspaceToScratch(path.resolve(workspacePath), scratchPath);
      this.active = {
        projectPath: destination,
        workspacePath: scratchPath,
        liveStatePath: normalizeArchivePath(metadata.liveStatePath),
        historyRepositoryPath: normalizeArchivePath(metadata.historyRepositoryPath),
        metadata: JSON.parse(JSON.stringify(metadata)),
        dataKey: Buffer.from(dataKey),
        keyWrap,
        isNew: true,
      };
      return this.getActiveProjectSnapshot();
    } catch (error) {
      if (scratchPath) this._removeScratch(scratchPath);
      if (error instanceof ProjectArchiveError) throw error;
      fail();
    } finally { secureErase(dataKey); }
  }

  /** Consumes a password-authenticated preview without retaining its password. */
  activatePreview({ previewToken, strategy, destinationPath, password } = {}) {
    const pending = this.pendingPreview;
    if (!pending || typeof previewToken !== 'string') fail();
    const suppliedToken = Buffer.from(previewToken);
    const pendingToken = Buffer.from(pending.token);
    if (suppliedToken.length !== pendingToken.length || !crypto.timingSafeEqual(suppliedToken, pendingToken)) fail();
    if (strategy === 'reconcile') {
      const previous = this.active;
      const eligibility = reconciliationEligibility(previous, pending);
      if (!previous || !eligibility.eligible || previous.isNew || !fs.existsSync(previous.projectPath)) reconciliationFailure();
      let candidatePath;
      let archive;
      try {
        validatePreviewLiveState(previous.workspacePath, previous);
        validatePreviewLiveState(pending.workspacePath, pending);
        fs.mkdirSync(this.scratchRoot, { recursive: true, mode: 0o700 });
        candidatePath = fs.mkdtempSync(path.join(this.scratchRoot, SCRATCH_PREFIX));
        copyWorkspaceToScratch(previous.workspacePath, candidatePath);
        prepareReconciledCandidate(candidatePath, previous, pending);
        validatePreviewLiveState(candidatePath, {
          metadata: pending.metadata,
          dataKey: previous.dataKey,
          liveStatePath: pending.liveStatePath,
          historyRepositoryPath: pending.historyRepositoryPath,
        });
        archive = serialiseArchive(candidatePath, pending.metadata, previous.dataKey, previous.keyWrap);
        atomicWrite(previous.projectPath, archive, true);
        this.active = {
          projectPath: previous.projectPath,
          workspacePath: candidatePath,
          liveStatePath: pending.liveStatePath,
          historyRepositoryPath: pending.historyRepositoryPath,
          metadata: pending.metadata,
          dataKey: previous.dataKey,
          keyWrap: previous.keyWrap,
          isNew: false,
        };
        this.pendingPreview = null;
        candidatePath = null;
        secureErase(pending.dataKey);
        try { this._removeScratch(previous.workspacePath); } catch (_) { /* persisted reconciliation remains valid */ }
        try { this._removeScratch(pending.workspacePath); } catch (_) { /* persisted reconciliation remains valid */ }
        return this.getActiveProjectSnapshot();
      } catch (_) {
        secureErase(archive);
        if (candidatePath) {
          try { this._removeScratch(candidatePath); } catch (_) { /* source projects remain unchanged */ }
        }
        reconciliationFailure();
      } finally { secureErase(archive); }
    }
    if (strategy !== 'replace' && strategy !== 'create-copy') fail();
    let nextProjectPath = pending.projectPath;
    let isNew = false;
    let nextKeyWrap = pending.keyWrap;
    if (strategy === 'create-copy') {
      if (destinationPath === undefined || password === undefined) fail();
      requireNonEmptyPassword(password);
      validateExtractedGit(pending.workspacePath, pending.metadata);
      nextKeyWrap = wrapDataKey(pending.dataKey, password);
      const archive = serialiseArchive(pending.workspacePath, pending.metadata, pending.dataKey, nextKeyWrap);
      try { atomicWrite(destinationPath, archive, false); } finally { secureErase(archive); }
      nextProjectPath = resolveProjectPath(destinationPath);
    }
    const previous = this.active;
    this.active = {
      projectPath: nextProjectPath,
      workspacePath: pending.workspacePath,
      liveStatePath: pending.liveStatePath,
      historyRepositoryPath: pending.historyRepositoryPath,
      metadata: pending.metadata,
      dataKey: pending.dataKey,
      keyWrap: nextKeyWrap,
      isNew,
    };
    this.pendingPreview = null;
    if (previous) {
      secureErase(previous.dataKey);
      this._removeScratch(previous.workspacePath);
    }
    return this.getActiveProjectSnapshot();
  }

  discardPreview() {
    if (!this.pendingPreview) return;
    const pending = this.pendingPreview;
    this.pendingPreview = null;
    secureErase(pending.dataKey);
    this._removeScratch(pending.workspacePath);
  }

  save({ password } = {}) {
    if (!this.active) fail();
    if (password !== undefined) requireNonEmptyPassword(password);
    validateExtractedGit(this.active.workspacePath, this.active.metadata);
    let keyWrap = this.active.keyWrap;
    if (password !== undefined) keyWrap = wrapDataKey(this.active.dataKey, password);
    const archive = serialiseArchive(this.active.workspacePath, this.active.metadata, this.active.dataKey, keyWrap);
    try {
      atomicWrite(this.active.projectPath, archive, !this.active.isNew);
      this.active.keyWrap = keyWrap;
      this.active.isNew = false;
    } finally { secureErase(archive); }
  }

  saveCopy({ destinationPath, password }) {
    if (!this.active || password === undefined) fail();
    requireNonEmptyPassword(password);
    validateExtractedGit(this.active.workspacePath, this.active.metadata);
    const archive = serialiseArchive(this.active.workspacePath, this.active.metadata, this.active.dataKey, wrapDataKey(this.active.dataKey, password));
    try { atomicWrite(destinationPath, archive, false); } finally { secureErase(archive); }
  }

  /**
   * Replaces active metadata only after checking the complete required shape
   * against the files currently held in the active ephemeral workspace.
   */
  updateMetadata(nextMetadata) {
    if (!this.active) fail();
    let copied;
    try { copied = JSON.parse(JSON.stringify(nextMetadata)); } catch (_) { fail(); }
    const workspace = walkWorkspace(this.active.workspacePath);
    validateMetadata(copied, workspace.members);
    this.active.metadata = copied;
    this.active.liveStatePath = normalizeArchivePath(copied.liveStatePath);
    this.active.historyRepositoryPath = normalizeArchivePath(copied.historyRepositoryPath);
    return this.getActiveProjectSnapshot();
  }

  addAttachment({ sourcePath, archivePath }) {
    if (!this.active) fail();
    const source = path.resolve(sourcePath);
    const sourceStat = fs.lstatSync(source);
    if (!sourceStat.isFile() || sourceStat.isSymbolicLink() || sourceStat.size > MAX_MEMBER_BYTES) fail();
    const relative = normalizeArchivePath(archivePath || `attachments/${path.basename(source)}`);
    if (!relative.startsWith('attachments/')) fail();
    const target = path.resolve(this.active.workspacePath, ...relative.split('/'));
    if (!target.startsWith(`${this.active.workspacePath}${path.sep}`) || fs.existsSync(target)) fail();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
    const attachmentPaths = this.active.metadata.encryptedAttachments.map((item) => (typeof item === 'string' ? item : item.path));
    if (!attachmentPaths.includes(relative)) this.active.metadata.encryptedAttachments.push(relative);
    return relative;
  }

  close() {
    if (!this.active) return;
    const active = this.active;
    this.active = null;
    secureErase(active.dataKey);
    this._removeScratch(active.workspacePath);
  }

  cleanupStaleScratch() {
    fs.mkdirSync(this.scratchRoot, { recursive: true, mode: 0o700 });
    const activePath = this.active && this.active.workspacePath;
    const pendingPath = this.pendingPreview && this.pendingPreview.workspacePath;
    for (const entry of fs.readdirSync(this.scratchRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith(SCRATCH_PREFIX)) continue;
      const candidate = path.resolve(this.scratchRoot, entry.name);
      if (candidate !== activePath && candidate !== pendingPath) this._removeScratch(candidate);
    }
  }

  _removeScratch(candidate) {
    const resolved = path.resolve(candidate);
    if (path.dirname(resolved) !== this.scratchRoot || !path.basename(resolved).startsWith(SCRATCH_PREFIX)) fail();
    try { fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 2 }); } catch (_) { fail(); }
  }
}

module.exports = {
  FORMAT_VERSION,
  ProjectArchiveError,
  ProjectArchiveManager,
};
