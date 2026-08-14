'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { atomicWrite } = require('./key-vault');

const MAGIC = Buffer.from('MTRPROJECT\0\x02\0\0\0\0', 'binary');
const MAX_CONTAINER_BYTES = 768 * 1024 * 1024;
const MAX_HEADER_BYTES = 1024 * 1024;
const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
const MAX_MEMBER_BYTES = 96 * 1024 * 1024;
const MAX_MEMBER_COUNT = 20_000;
const MAX_PATH_BYTES = 1024;
const MAX_PATH_DEPTH = 32;
const KDF = Object.freeze({ name: 'scrypt', N: 262144, r: 8, p: 1, keyLength: 32, maxmem: 512 * 1024 * 1024 });
const REVIEW_KEYS = Object.freeze(['forms', 'calculations', 'attachments', 'mailingDestination', 'signatureFields']);

class ProjectBundleError extends Error {
  constructor(code, message, recovery) {
    super(message);
    this.name = 'ProjectBundleError';
    this.code = code;
    this.recovery = recovery;
  }
}

function fail(code = 'PROJECT_INVALID', message = 'The project file is invalid.', recovery = 'Choose an unchanged project file and enter its password again.') {
  throw new ProjectBundleError(code, message, recovery);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys) {
  if (!isObject(value)) fail();
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail();
}

function validateIso(value) {
  if (typeof value !== 'string' || new Date(value).toISOString() !== value) fail();
}

function validateMemberPath(value) {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') < 1 || Buffer.byteLength(value, 'utf8') > MAX_PATH_BYTES
    || value.includes('\\') || value.includes('\0') || value.startsWith('/') || value.startsWith('//')
    || path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || /^[A-Za-z]:/.test(value)) fail();
  const segments = value.split('/');
  if (segments.length > MAX_PATH_DEPTH || segments.some((segment) => !segment || segment === '.' || segment === '..'
    || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment))) fail();
  if (segments.join('/') !== value) fail();
  return value;
}

function validateMetadata(metadata) {
  exactKeys(metadata, ['schemaVersion', 'projectId', 'createdAt', 'updatedAt', 'taxYear', 'ruleSources', 'parserConfirmations', 'pdfReview', 'currentRevisionId']);
  if (metadata.schemaVersion !== 1 || !/^[0-9a-f-]{36}$/i.test(metadata.projectId)
    || !Number.isInteger(metadata.taxYear) || metadata.taxYear < 2025 || metadata.taxYear > 2100
    || !/^[0-9a-f-]{36}$/i.test(metadata.currentRevisionId)) fail();
  validateIso(metadata.createdAt); validateIso(metadata.updatedAt);
  if (!Array.isArray(metadata.ruleSources) || metadata.ruleSources.length < 1 || metadata.ruleSources.length > 128) fail();
  for (const source of metadata.ruleSources) {
    exactKeys(source, ['title', 'url', 'retrievedAt']);
    if (typeof source.title !== 'string' || source.title.length < 1 || source.title.length > 256
      || typeof source.url !== 'string' || source.url.length > 2048 || !source.url.startsWith('https://')) fail();
    const parsed = new URL(source.url);
    if (!['www.canada.ca', 'canada.ca', 'www.ontario.ca', 'ontario.ca'].includes(parsed.hostname)) fail();
    validateIso(source.retrievedAt);
  }
  if (!Array.isArray(metadata.parserConfirmations) || metadata.parserConfirmations.length > 10_000) fail();
  for (const confirmation of metadata.parserConfirmations) {
    exactKeys(confirmation, ['attachmentId', 'parserId', 'confirmedAt']);
    if (!/^[0-9a-f-]{36}$/i.test(confirmation.attachmentId) || typeof confirmation.parserId !== 'string'
      || confirmation.parserId.length < 1 || confirmation.parserId.length > 128) fail();
    validateIso(confirmation.confirmedAt);
  }
  exactKeys(metadata.pdfReview, REVIEW_KEYS);
  for (const key of REVIEW_KEYS) if (typeof metadata.pdfReview[key] !== 'boolean') fail();
  return metadata;
}

function passwordBytes(password) {
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 1024) {
    fail('PASSWORD_INVALID', 'The project password must contain at least 12 characters.', 'Enter the project password without placing it in a file or log.');
  }
  return Buffer.from(password, 'utf8');
}

function deriveWrappingKey(password, salt, parameters = KDF) {
  exactKeys(parameters, ['name', 'N', 'r', 'p', 'keyLength', 'maxmem']);
  if (parameters.name !== KDF.name || parameters.N !== KDF.N || parameters.r !== KDF.r || parameters.p !== KDF.p
    || parameters.keyLength !== KDF.keyLength || parameters.maxmem !== KDF.maxmem) fail();
  const secret = passwordBytes(password);
  try {
    return crypto.scryptSync(secret, salt, parameters.keyLength, {
      N: parameters.N,
      r: parameters.r,
      p: parameters.p,
      maxmem: parameters.maxmem,
    });
  } finally {
    secret.fill(0);
  }
}

function encryptAead(key, plaintext, aad) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), ciphertext };
}

function decryptAead(key, encrypted, aad) {
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, encrypted.iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(encrypted.tag);
    return Buffer.concat([decipher.update(encrypted.ciphertext), decipher.final()]);
  } catch {
    fail('PROJECT_AUTHENTICATION_FAILED', 'The project password or encrypted payload is invalid.', 'Confirm the password and use an unchanged project file.');
  }
}

function decodedBase64(value, bytes) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) fail();
  const result = Buffer.from(value, 'base64');
  if ((bytes !== undefined && result.length !== bytes) || result.toString('base64') !== value) fail();
  return result;
}

function createPortableKey(dataKey, password) {
  const salt = crypto.randomBytes(16);
  let wrappingKey;
  const aad = Buffer.from('material-tax-reporting.project-key.v2', 'utf8');
  try {
    wrappingKey = deriveWrappingKey(password, salt);
    const encrypted = encryptAead(wrappingKey, dataKey, aad);
    return {
      schemaVersion: 1,
      kdf: { ...KDF, salt: salt.toString('base64') },
      wrappedKey: {
        algorithm: 'aes-256-gcm',
        iv: encrypted.iv.toString('base64'),
        tag: encrypted.tag.toString('base64'),
        ciphertext: encrypted.ciphertext.toString('base64'),
      },
    };
  } finally {
    salt.fill(0); wrappingKey?.fill(0); aad.fill(0);
  }
}

function unwrapPortableKey(portableKey, password) {
  exactKeys(portableKey, ['schemaVersion', 'kdf', 'wrappedKey']);
  if (portableKey.schemaVersion !== 1) fail();
  exactKeys(portableKey.kdf, ['name', 'N', 'r', 'p', 'keyLength', 'maxmem', 'salt']);
  exactKeys(portableKey.wrappedKey, ['algorithm', 'iv', 'tag', 'ciphertext']);
  if (portableKey.wrappedKey.algorithm !== 'aes-256-gcm') fail();
  const salt = decodedBase64(portableKey.kdf.salt, 16);
  const iv = decodedBase64(portableKey.wrappedKey.iv, 12);
  const tag = decodedBase64(portableKey.wrappedKey.tag, 16);
  const ciphertext = decodedBase64(portableKey.wrappedKey.ciphertext, 32);
  const aad = Buffer.from('material-tax-reporting.project-key.v2', 'utf8');
  let wrappingKey;
  try {
    wrappingKey = deriveWrappingKey(password, salt, portableKey.kdf);
    const key = decryptAead(wrappingKey, { iv, tag, ciphertext }, aad);
    if (key.length !== 32) fail();
    return key;
  } finally {
    salt.fill(0); iv.fill(0); tag.fill(0); ciphertext.fill(0); aad.fill(0); wrappingKey?.fill(0);
  }
}

function walkProject(projectRoot) {
  const root = fs.realpathSync(projectRoot);
  const members = [];
  let total = 0;
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.runtime' || entry.name.endsWith('.lock')) continue;
      const absolute = path.join(directory, entry.name);
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) fail('PROJECT_LINK_REJECTED', 'Project data contains a symbolic link.', 'Remove links from the app-private project data and retry Save.');
      if (stat.isDirectory()) visit(absolute);
      else if (stat.isFile()) {
        const relative = validateMemberPath(path.relative(root, absolute).split(path.sep).join('/'));
        if (stat.size > MAX_MEMBER_BYTES) fail('PROJECT_MEMBER_TOO_LARGE', 'A project member exceeds its size limit.', 'Remove the oversized attachment and retry Save.');
        total += stat.size;
        if (total > MAX_ARCHIVE_BYTES || members.length >= MAX_MEMBER_COUNT) fail('PROJECT_TOO_LARGE', 'The project exceeds its bounded archive limits.', 'Remove large attachments and retry Save.');
        members.push({ path: relative, absolute, size: stat.size });
      } else fail();
    }
  };
  visit(root);
  members.sort((left, right) => left.path.localeCompare(right.path));
  if (members.length === 0 || new Set(members.map((member) => member.path)).size !== members.length) fail();
  return members;
}

function encodeArchive(projectRoot, metadata) {
  validateMetadata(metadata);
  const members = walkProject(projectRoot);
  const chunks = [];
  let offset = 0;
  const entries = members.map((member) => {
    const bytes = fs.readFileSync(member.absolute);
    const entry = {
      path: member.path,
      offset,
      size: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    };
    chunks.push(bytes);
    offset += bytes.length;
    return entry;
  });
  const manifest = Buffer.from(JSON.stringify({ schemaVersion: 1, metadata, entries }), 'utf8');
  if (manifest.length > MAX_HEADER_BYTES || manifest.length + offset > MAX_ARCHIVE_BYTES) fail();
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32BE(manifest.length);
  return Buffer.concat([length, manifest, ...chunks]);
}

function decodeArchive(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 5 || bytes.length > MAX_ARCHIVE_BYTES) fail();
  const manifestLength = bytes.readUInt32BE(0);
  if (manifestLength < 2 || manifestLength > MAX_HEADER_BYTES || 4 + manifestLength > bytes.length) fail();
  let manifest;
  try { manifest = JSON.parse(bytes.subarray(4, 4 + manifestLength).toString('utf8')); } catch { fail(); }
  exactKeys(manifest, ['schemaVersion', 'metadata', 'entries']);
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.entries) || manifest.entries.length < 1 || manifest.entries.length > MAX_MEMBER_COUNT) fail();
  validateMetadata(manifest.metadata);
  const data = bytes.subarray(4 + manifestLength);
  const names = new Set();
  let priorEnd = 0;
  const entries = manifest.entries.map((entry) => {
    exactKeys(entry, ['path', 'offset', 'size', 'sha256']);
    const memberPath = validateMemberPath(entry.path);
    if (names.has(memberPath) || !Number.isSafeInteger(entry.offset) || !Number.isSafeInteger(entry.size)
      || entry.offset !== priorEnd || entry.size < 0 || entry.size > MAX_MEMBER_BYTES || entry.offset + entry.size > data.length
      || !/^[0-9a-f]{64}$/.test(entry.sha256)) fail();
    names.add(memberPath);
    const content = data.subarray(entry.offset, entry.offset + entry.size);
    if (crypto.createHash('sha256').update(content).digest('hex') !== entry.sha256) fail();
    priorEnd = entry.offset + entry.size;
    return { ...entry, path: memberPath, content };
  });
  if (priorEnd !== data.length || !names.has('history/.git/HEAD') || !names.has('history/.git/config')
    || ![...names].some((name) => name.startsWith('history/.git/objects/'))) fail();
  return { metadata: manifest.metadata, entries };
}

function extractArchive(decoded, destinationRoot) {
  fs.mkdirSync(destinationRoot, { recursive: true });
  const root = fs.realpathSync(destinationRoot);
  for (const entry of decoded.entries) {
    const destination = path.resolve(root, ...entry.path.split('/'));
    if (!destination.startsWith(`${root}${path.sep}`)) fail();
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const handle = fs.openSync(destination, 'wx', 0o600);
    try { fs.writeFileSync(handle, entry.content); } finally { fs.closeSync(handle); }
  }
}

function verifyGitGraph(projectRoot) {
  const gitDirectory = path.join(projectRoot, 'history', '.git');
  const result = spawnSync('git', [`--git-dir=${gitDirectory}`, 'fsck', '--strict', '--full', '--no-dangling'], {
    encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) fail('PROJECT_HISTORY_INVALID', 'The embedded local Git object graph is invalid.', 'Use another project backup; no local data was replaced.');
  const head = spawnSync('git', [`--git-dir=${gitDirectory}`, 'rev-parse', '--verify', 'HEAD'], {
    encoding: 'utf8', windowsHide: true, timeout: 30_000,
  });
  if (head.error || head.status !== 0 || !/^[0-9a-f]{40,64}$/i.test(head.stdout.trim())) fail();
  return head.stdout.trim();
}

function atomicContainerWrite(destinationPath, container) {
  const destination = path.resolve(destinationPath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const handle = fs.openSync(temporary, 'wx', 0o600);
  try {
    fs.writeFileSync(handle, container);
    fs.fsyncSync(handle);
  } finally { fs.closeSync(handle); }
  fs.renameSync(temporary, destination);
}

function saveBundle({ projectRoot, destinationPath, dataKey, metadata, portableKey }) {
  validateMetadata(metadata);
  const archive = encodeArchive(projectRoot, metadata);
  const aad = Buffer.from('material-tax-reporting.project-payload.v2', 'utf8');
  try {
    const encrypted = encryptAead(dataKey, archive, aad);
    const header = {
      schemaVersion: 2,
      portableKey,
      payload: {
        algorithm: 'aes-256-gcm',
        iv: encrypted.iv.toString('base64'),
        tag: encrypted.tag.toString('base64'),
        plaintextBytes: archive.length,
        ciphertextBytes: encrypted.ciphertext.length,
        plaintextSha256: crypto.createHash('sha256').update(archive).digest('hex'),
      },
    };
    const headerBytes = Buffer.from(JSON.stringify(header), 'utf8');
    if (headerBytes.length > MAX_HEADER_BYTES) fail();
    const length = Buffer.allocUnsafe(4); length.writeUInt32BE(headerBytes.length);
    const container = Buffer.concat([MAGIC, length, headerBytes, encrypted.ciphertext]);
    if (container.length > MAX_CONTAINER_BYTES) fail('PROJECT_TOO_LARGE', 'The encrypted project exceeds its size limit.', 'Remove large attachments and retry Save.');
    atomicContainerWrite(destinationPath, container);
    return { bytes: container.length, sha256: crypto.createHash('sha256').update(container).digest('hex') };
  } finally { archive.fill(0); aad.fill(0); }
}

function readBundle({ sourcePath, password }) {
  const stat = fs.statSync(sourcePath);
  if (!stat.isFile() || stat.size < MAGIC.length + 5 || stat.size > MAX_CONTAINER_BYTES) fail();
  const container = fs.readFileSync(sourcePath);
  if (!crypto.timingSafeEqual(container.subarray(0, MAGIC.length), MAGIC)) fail();
  const headerLength = container.readUInt32BE(MAGIC.length);
  const headerStart = MAGIC.length + 4;
  if (headerLength < 2 || headerLength > MAX_HEADER_BYTES || headerStart + headerLength >= container.length) fail();
  let header;
  try { header = JSON.parse(container.subarray(headerStart, headerStart + headerLength).toString('utf8')); } catch { fail(); }
  exactKeys(header, ['schemaVersion', 'portableKey', 'payload']);
  if (header.schemaVersion !== 2) fail();
  exactKeys(header.payload, ['algorithm', 'iv', 'tag', 'plaintextBytes', 'ciphertextBytes', 'plaintextSha256']);
  if (header.payload.algorithm !== 'aes-256-gcm' || !Number.isSafeInteger(header.payload.plaintextBytes)
    || header.payload.plaintextBytes < 1 || header.payload.plaintextBytes > MAX_ARCHIVE_BYTES
    || !Number.isSafeInteger(header.payload.ciphertextBytes) || header.payload.ciphertextBytes !== container.length - headerStart - headerLength
    || !/^[0-9a-f]{64}$/.test(header.payload.plaintextSha256)) fail();
  const dataKey = unwrapPortableKey(header.portableKey, password);
  const aad = Buffer.from('material-tax-reporting.project-payload.v2', 'utf8');
  let plaintext;
  let scratchRoot;
  try {
    plaintext = decryptAead(dataKey, {
      iv: decodedBase64(header.payload.iv, 12),
      tag: decodedBase64(header.payload.tag, 16),
      ciphertext: container.subarray(headerStart + headerLength),
    }, aad);
    if (plaintext.length !== header.payload.plaintextBytes
      || crypto.createHash('sha256').update(plaintext).digest('hex') !== header.payload.plaintextSha256) fail();
    const decoded = decodeArchive(plaintext);
    scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'material-tax-project-import-'));
    const projectRoot = path.join(scratchRoot, 'project');
    extractArchive(decoded, projectRoot);
    let embeddedMetadata;
    let embeddedPortableKey;
    try {
      embeddedMetadata = JSON.parse(fs.readFileSync(path.join(projectRoot, 'project.json'), 'utf8'));
      embeddedPortableKey = JSON.parse(fs.readFileSync(path.join(projectRoot, 'portable-key.json'), 'utf8'));
    } catch { fail(); }
    if (JSON.stringify(embeddedMetadata) !== JSON.stringify(decoded.metadata)
      || JSON.stringify(embeddedPortableKey) !== JSON.stringify(header.portableKey)) fail();
    const historyHead = verifyGitGraph(projectRoot);
    return { dataKey, portableKey: header.portableKey, metadata: decoded.metadata, scratchRoot, projectRoot, historyHead, sourcePath: path.resolve(sourcePath) };
  } catch (error) {
    dataKey.fill(0);
    if (scratchRoot) fs.rmSync(scratchRoot, { recursive: true, force: true, maxRetries: 2, retryDelay: 25 });
    throw error;
  } finally {
    container.fill(0); plaintext?.fill(0); aad.fill(0);
  }
}

function encryptAttachment(dataKey, attachmentId, bytes) {
  if (!/^[0-9a-f-]{36}$/i.test(attachmentId) || !Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > MAX_MEMBER_BYTES) fail();
  const aad = Buffer.from(`material-tax-reporting.attachment.v1\0${attachmentId}`, 'utf8');
  try {
    const encrypted = encryptAead(dataKey, bytes, aad);
    return Buffer.from(JSON.stringify({
      schemaVersion: 1,
      algorithm: 'aes-256-gcm',
      attachmentId,
      plaintextBytes: bytes.length,
      plaintextSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      iv: encrypted.iv.toString('base64'),
      tag: encrypted.tag.toString('base64'),
      ciphertext: encrypted.ciphertext.toString('base64'),
    }), 'utf8');
  } finally { aad.fill(0); }
}

function validateEncryptedAttachment(dataKey, attachmentId, envelopeBytes, expectedBytes) {
  if (!Buffer.isBuffer(dataKey) || dataKey.length !== 32 || !/^[0-9a-f-]{36}$/i.test(attachmentId)
    || !Buffer.isBuffer(envelopeBytes) || envelopeBytes.length < 2 || envelopeBytes.length > Math.ceil(MAX_MEMBER_BYTES * 1.5)) fail();
  let envelope;
  try { envelope = JSON.parse(envelopeBytes.toString('utf8')); } catch { fail(); }
  exactKeys(envelope, ['schemaVersion', 'algorithm', 'attachmentId', 'plaintextBytes', 'plaintextSha256', 'iv', 'tag', 'ciphertext']);
  if (envelope.schemaVersion !== 1 || envelope.algorithm !== 'aes-256-gcm' || envelope.attachmentId !== attachmentId
    || !Number.isSafeInteger(envelope.plaintextBytes) || envelope.plaintextBytes < 1 || envelope.plaintextBytes > MAX_MEMBER_BYTES
    || envelope.plaintextBytes !== expectedBytes || !/^[0-9a-f]{64}$/.test(envelope.plaintextSha256)) fail();
  const iv = decodedBase64(envelope.iv, 12);
  const tag = decodedBase64(envelope.tag, 16);
  const ciphertext = decodedBase64(envelope.ciphertext);
  const aad = Buffer.from(`material-tax-reporting.attachment.v1\0${attachmentId}`, 'utf8');
  let plaintext;
  try {
    if (ciphertext.length !== envelope.plaintextBytes) fail();
    plaintext = decryptAead(dataKey, { iv, tag, ciphertext }, aad);
    if (plaintext.length !== expectedBytes || crypto.createHash('sha256').update(plaintext).digest('hex') !== envelope.plaintextSha256) fail();
    return true;
  } finally {
    iv.fill(0); tag.fill(0); ciphertext.fill(0); aad.fill(0); plaintext?.fill(0);
  }
}

function storeProjectMetadata(projectRoot, metadata, portableKey) {
  validateMetadata(metadata);
  atomicWrite(path.join(projectRoot, 'project.json'), Buffer.from(`${JSON.stringify(metadata)}\n`, 'utf8'));
  atomicWrite(path.join(projectRoot, 'portable-key.json'), Buffer.from(`${JSON.stringify(portableKey)}\n`, 'utf8'));
}

module.exports = {
  KDF,
  MAX_CONTAINER_BYTES,
  ProjectBundleError,
  createPortableKey,
  encryptAttachment,
  readBundle,
  saveBundle,
  storeProjectMetadata,
  validateEncryptedAttachment,
  validateMetadata,
  verifyGitGraph,
};
