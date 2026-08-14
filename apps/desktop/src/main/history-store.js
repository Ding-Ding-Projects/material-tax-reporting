'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { atomicWrite } = require('./key-vault');

const MAX_STATE_BYTES = 32 * 1024 * 1024;
const ACTIONS = new Set(['create', 'answer', 'attachment-add', 'attachment-remove', 'review', 'restore', 'undo', 'import-copy', 'reconcile', 'replace']);

function runGit(repositoryPath, args, { allowFailure = false } = {}) {
  const result = spawnSync('git', ['-C', repositoryPath, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (!allowFailure && (result.error || result.status !== 0)) throw new Error('Local history operation failed.');
  return result;
}

function exactJson(value) {
  const bytes = Buffer.from(JSON.stringify(value), 'utf8');
  if (bytes.length === 0 || bytes.length > MAX_STATE_BYTES) throw new Error('Project state exceeds the local history limit.');
  return bytes;
}

function encryptedEnvelope(projectId, revisionId, dataKey, state) {
  const plaintext = exactJson(state);
  const iv = crypto.randomBytes(12);
  const aad = Buffer.from(`material-tax-reporting.history.v1\0${projectId}\0${revisionId}`, 'utf8');
  try {
    const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv);
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return {
      schemaVersion: 1,
      algorithm: 'aes-256-gcm',
      projectId,
      revisionId,
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
      plaintextSha256: crypto.createHash('sha256').update(plaintext).digest('hex'),
    };
  } finally {
    plaintext.fill(0);
    aad.fill(0);
  }
}

function decryptEnvelope(projectId, dataKey, envelope) {
  if (!envelope || envelope.schemaVersion !== 1 || envelope.algorithm !== 'aes-256-gcm'
    || envelope.projectId !== projectId || !/^[0-9a-f-]{36}$/i.test(envelope.revisionId)) {
    throw new Error('Local history record metadata is invalid.');
  }
  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
  const aad = Buffer.from(`material-tax-reporting.history.v1\0${projectId}\0${envelope.revisionId}`, 'utf8');
  let plaintext;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    if (plaintext.length === 0 || plaintext.length > MAX_STATE_BYTES
      || crypto.createHash('sha256').update(plaintext).digest('hex') !== envelope.plaintextSha256) {
      throw new Error('Local history record integrity validation failed.');
    }
    return JSON.parse(plaintext.toString('utf8'));
  } finally {
    iv.fill(0); tag.fill(0); ciphertext.fill(0); aad.fill(0); plaintext?.fill(0);
  }
}

function changedPaths(before, after, prefix = '', output = []) {
  if (Object.is(before, after)) return output;
  if (before === null || after === null || typeof before !== 'object' || typeof after !== 'object'
    || Array.isArray(before) !== Array.isArray(after)) {
    output.push(prefix || '/');
    return output;
  }
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of [...keys].sort()) changedPaths(before[key], after[key], `${prefix}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`, output);
  return output;
}

class HistoryStore {
  constructor({ repositoryPath, projectId, dataKey }) {
    this.repositoryPath = path.resolve(repositoryPath);
    this.projectId = projectId;
    this.dataKey = Buffer.from(dataKey);
  }

  initialize(initialState) {
    fs.mkdirSync(this.repositoryPath, { recursive: true });
    if (!fs.existsSync(path.join(this.repositoryPath, '.git'))) {
      runGit(this.repositoryPath, ['init', '-b', 'main']);
      runGit(this.repositoryPath, ['config', 'user.name', 'Material Tax Reporting History']);
      runGit(this.repositoryPath, ['config', 'user.email', 'local-history@invalid']);
      atomicWrite(path.join(this.repositoryPath, '.gitignore'), Buffer.from('.runtime/\n', 'utf8'));
      fs.mkdirSync(path.join(this.repositoryPath, 'records'), { recursive: true });
      fs.mkdirSync(path.join(this.repositoryPath, 'labels'), { recursive: true });
      this.transact({ action: 'create', stableId: 'project', summary: 'Created encrypted local project history', state: initialState });
    }
    this.verify();
  }

  dispose() {
    this.dataKey.fill(0);
  }

  transact({ action, stableId, summary, state }) {
    if (!ACTIONS.has(action) || typeof stableId !== 'string' || stableId.length < 1 || stableId.length > 256
      || typeof summary !== 'string' || summary.length < 1 || summary.length > 256) {
      throw new Error('Local history mutation metadata is invalid.');
    }
    const revisionId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const envelope = encryptedEnvelope(this.projectId, revisionId, this.dataKey, state);
    const record = {
      schemaVersion: 1,
      revisionId,
      action,
      stableId: crypto.createHmac('sha256', this.dataKey).update(stableId).digest('hex'),
      summary,
      timestamp,
      snapshot: envelope,
    };
    const recordPath = path.join(this.repositoryPath, 'records', `${revisionId}.json`);
    atomicWrite(recordPath, Buffer.from(`${JSON.stringify(record)}\n`, 'utf8'));
    atomicWrite(path.join(this.repositoryPath, 'current'), Buffer.from(`${revisionId}\n`, 'utf8'));
    runGit(this.repositoryPath, ['add', '--', 'records', 'current', '.gitignore', 'labels']);
    runGit(this.repositoryPath, ['commit', '-m', `history: ${action} ${revisionId}`, '-m', summary]);
    return { revisionId, action, summary, timestamp };
  }

  currentRevisionId() {
    const value = fs.readFileSync(path.join(this.repositoryPath, 'current'), 'utf8').trim();
    if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error('Local history current revision is invalid.');
    return value;
  }

  readRevision(revisionId) {
    if (!/^[0-9a-f-]{36}$/i.test(revisionId)) throw new Error('Invalid local history revision.');
    const filePath = path.join(this.repositoryPath, 'records', `${revisionId}.json`);
    const record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (record.revisionId !== revisionId) throw new Error('Local history record identifier mismatch.');
    return { record, state: decryptEnvelope(this.projectId, this.dataKey, record.snapshot) };
  }

  load() {
    return this.readRevision(this.currentRevisionId()).state;
  }

  query({ text = '', action = '', from = '', to = '' } = {}) {
    const needle = String(text).trim().toLocaleLowerCase();
    const files = fs.readdirSync(path.join(this.repositoryPath, 'records')).filter((name) => name.endsWith('.json'));
    const labels = this.readLabels();
    const rows = files.map((name) => JSON.parse(fs.readFileSync(path.join(this.repositoryPath, 'records', name), 'utf8')))
      .filter((record) => !action || record.action === action)
      .filter((record) => !from || record.timestamp >= from)
      .filter((record) => !to || record.timestamp <= to)
      .filter((record) => !needle || `${record.summary} ${record.action} ${labels[record.revisionId] || ''}`.toLocaleLowerCase().includes(needle))
      .map((record) => ({
        revisionId: record.revisionId,
        action: record.action,
        summary: record.summary,
        timestamp: record.timestamp,
        label: labels[record.revisionId] || '',
        current: record.revisionId === this.currentRevisionId(),
      }))
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
    return { rows, actions: [...new Set(rows.map((row) => row.action))].sort() };
  }

  readLabels() {
    const labels = {};
    const directory = path.join(this.repositoryPath, 'labels');
    if (!fs.existsSync(directory)) return labels;
    for (const name of fs.readdirSync(directory)) {
      if (!name.endsWith('.json')) continue;
      const entry = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
      if (/^[0-9a-f-]{36}$/i.test(entry.revisionId) && typeof entry.label === 'string') labels[entry.revisionId] = entry.label;
    }
    return labels;
  }

  diff(fromRevisionId, toRevisionId) {
    const before = this.readRevision(fromRevisionId).state;
    const after = this.readRevision(toRevisionId).state;
    return { fromRevisionId, toRevisionId, changedPaths: changedPaths(before, after).slice(0, 10_000) };
  }

  restore(revisionId, action = 'restore') {
    if (action !== 'restore' && action !== 'undo') throw new Error('Invalid local history restore action.');
    const source = this.readRevision(revisionId);
    const result = this.transact({
      action,
      stableId: `restore:${revisionId}`,
      summary: `${action === 'undo' ? 'Undid to' : 'Restored'} revision ${revisionId}`,
      state: source.state,
    });
    return { ...result, state: source.state };
  }

  undo() {
    const current = this.currentRevisionId();
    const prior = this.query().rows.find((row) => row.revisionId !== current);
    if (!prior) throw new Error('There is no earlier revision to undo to.');
    return this.restore(prior.revisionId, 'undo');
  }

  label(revisionId, label) {
    this.readRevision(revisionId);
    const normalized = String(label).trim();
    if (normalized.length > 80) throw new Error('History labels are limited to 80 characters.');
    atomicWrite(path.join(this.repositoryPath, 'labels', `${revisionId}.json`), Buffer.from(`${JSON.stringify({ revisionId, label: normalized })}\n`, 'utf8'));
    runGit(this.repositoryPath, ['add', '--', 'labels']);
    runGit(this.repositoryPath, ['commit', '-m', `history: label ${revisionId}`, '-m', normalized || 'Removed revision label']);
    return { revisionId, label: normalized };
  }

  verify() {
    const result = runGit(this.repositoryPath, ['fsck', '--strict', '--full', '--no-dangling'], { allowFailure: true });
    if (result.error || result.status !== 0) throw new Error('The local Git object graph is invalid.');
    const head = runGit(this.repositoryPath, ['rev-parse', '--verify', 'HEAD'], { allowFailure: true });
    if (head.error || head.status !== 0 || !/^[0-9a-f]{40,64}$/i.test(head.stdout.trim())) throw new Error('The local history ref is invalid.');
    return { ok: true, head: head.stdout.trim() };
  }
}

module.exports = { HistoryStore, MAX_STATE_BYTES, decryptEnvelope };
