'use strict';

const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { HistoryKeyVault, HistoryKeyVaultError } = require('./history-key-vault');

const SCHEMA_VERSION = 1;
const SNAPSHOT_ALGORITHM = 'aes-256-gcm';
const HISTORY_NAMESPACE = 'material-tax-reporting.local-history.v1';
const MAX_SNAPSHOT_BYTES = 64 * 1024 * 1024;

const HISTORY_ACTIONS = Object.freeze({
  TAX_VALUE_CREATED: 'tax-value-created',
  TAX_VALUE_EDITED: 'tax-value-edited',
  TAX_VALUE_IMPORTED: 'tax-value-imported',
  PARSER_CORRECTED: 'parser-corrected',
  TAX_VALUE_DELETED: 'tax-value-deleted',
  WIZARD_ANSWER_RECORDED: 'wizard-answer-recorded',
  SETTINGS_MUTATED: 'settings-mutated',
  DISCARDED: 'discarded',
  UNDO: 'undo',
  REDO: 'redo',
  RESTORE: 'restore',
  LABEL: 'label',
  PRUNE_AUTHORIZED: 'prune-authorized',
  RECOVERY: 'recovery'
});

const ACTION_ALIASES = new Map([
  ['create', HISTORY_ACTIONS.TAX_VALUE_CREATED],
  ['creation', HISTORY_ACTIONS.TAX_VALUE_CREATED],
  ['tax-value-creation', HISTORY_ACTIONS.TAX_VALUE_CREATED],
  ['edit', HISTORY_ACTIONS.TAX_VALUE_EDITED],
  ['tax-value-edit', HISTORY_ACTIONS.TAX_VALUE_EDITED],
  ['import', HISTORY_ACTIONS.TAX_VALUE_IMPORTED],
  ['tax-value-import', HISTORY_ACTIONS.TAX_VALUE_IMPORTED],
  ['parser-correction', HISTORY_ACTIONS.PARSER_CORRECTED],
  ['delete', HISTORY_ACTIONS.TAX_VALUE_DELETED],
  ['deletion', HISTORY_ACTIONS.TAX_VALUE_DELETED],
  ['tax-value-deletion', HISTORY_ACTIONS.TAX_VALUE_DELETED],
  ['wizard-answer', HISTORY_ACTIONS.WIZARD_ANSWER_RECORDED],
  ['settings-mutation', HISTORY_ACTIONS.SETTINGS_MUTATED],
  ['discard', HISTORY_ACTIONS.DISCARDED],
  ...Object.values(HISTORY_ACTIONS).map((action) => [action, action])
]);

const HISTORY_RECOVERY = Object.freeze({
  RETRY: 'Retry the operation. No unrecorded state change was accepted.',
  RESTORE_CREDENTIAL: 'Restore the matching Windows credential before opening this history.',
  RESTORE_REPOSITORY: 'Restore the local history repository from backup before changing tax data.',
  CHOOSE_EXPORT_DESTINATION: 'Choose a writable destination outside the history repository and retry.',
  COMPLETE_SUPER_CONFIRMATION: 'Complete both confirmation keys and the full confirmation slider, then retry.',
  PRESERVE_PATHS: 'Preserve the live-state file and history repository, then use the recovery details shown by the application.'
});

class LocalHistoryError extends Error {
  constructor(code, message, recovery = HISTORY_RECOVERY.PRESERVE_PATHS, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'LocalHistoryError';
    this.code = code;
    this.recovery = recovery;
  }
}

function normalizeAction(action) {
  if (typeof action !== 'string') {
    throw new LocalHistoryError('INVALID_HISTORY_ACTION', 'A history action is required.', HISTORY_RECOVERY.RETRY);
  }
  const normalized = ACTION_ALIASES.get(action.trim().toLowerCase());
  if (!normalized) {
    throw new LocalHistoryError(
      'INVALID_HISTORY_ACTION',
      'The requested change does not use a recognized local history action.',
      HISTORY_RECOVERY.RETRY
    );
  }
  return normalized;
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function assertPlainSerializable(value, name) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new LocalHistoryError('HISTORY_VALUE_NOT_SERIALIZABLE', `${name} must be JSON-serializable.`, HISTORY_RECOVERY.RETRY, error);
  }
  if (serialized === undefined) {
    throw new LocalHistoryError('HISTORY_VALUE_NOT_SERIALIZABLE', `${name} must contain a JSON value.`, HISTORY_RECOVERY.RETRY);
  }
  return serialized;
}

function isWithin(parentPath, candidatePath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(candidatePath));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function atomicWrite(filePath, bytes) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = path.join(directory, `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
  const backup = path.join(directory, `.${path.basename(filePath)}.${crypto.randomUUID()}.previous`);
  let movedPrevious = false;

  try {
    const descriptor = fs.openSync(temporary, 'wx', 0o600);
    try {
      fs.writeFileSync(descriptor, bytes);
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }

    if (fs.existsSync(filePath)) {
      fs.renameSync(filePath, backup);
      movedPrevious = true;
    }
    fs.renameSync(temporary, filePath);
    if (movedPrevious) fs.rmSync(backup, { force: true });
  } catch (error) {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
    if (movedPrevious && !fs.existsSync(filePath) && fs.existsSync(backup)) {
      fs.renameSync(backup, filePath);
    }
    throw error;
  }
}

function directoryBytes(rootPath) {
  if (!fs.existsSync(rootPath)) return 0;
  const queue = [rootPath];
  let total = 0;
  while (queue.length > 0) {
    const current = queue.pop();
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(current)) queue.push(path.join(current, child));
    } else {
      total += stat.size;
    }
  }
  return total;
}

function flattenDiff(before, after, currentPath = '$', changes = []) {
  if (Object.is(before, after)) return changes;
  const beforeObject = before && typeof before === 'object' && !Array.isArray(before);
  const afterObject = after && typeof after === 'object' && !Array.isArray(after);
  if (beforeObject && afterObject) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of [...keys].sort()) {
      flattenDiff(before[key], after[key], `${currentPath}.${key}`, changes);
    }
    return changes;
  }
  changes.push({
    path: currentPath,
    kind: before === undefined ? 'added' : after === undefined ? 'removed' : 'changed',
    before: cloneJson(before),
    after: cloneJson(after)
  });
  return changes;
}

class LocalHistoryService {
  constructor({ repositoryPath, liveStatePath, credentialTarget, keyVault, maxSnapshotBytes = MAX_SNAPSHOT_BYTES }) {
    if (!path.isAbsolute(repositoryPath) || !path.isAbsolute(liveStatePath)) {
      throw new TypeError('repositoryPath and liveStatePath must be absolute paths in stable application data.');
    }
    if (isWithin(repositoryPath, liveStatePath)) {
      throw new TypeError('liveStatePath must remain outside the local history Git repository.');
    }

    this.repositoryPath = path.resolve(repositoryPath);
    this.liveStatePath = path.resolve(liveStatePath);
    this.credentialTarget = credentialTarget;
    this.entriesPath = path.join(this.repositoryPath, 'entries');
    this.runtimePath = path.join(this.repositoryPath, '.runtime');
    this.journalPath = path.join(this.runtimePath, 'pending-transaction.json');
    this.maxSnapshotBytes = maxSnapshotBytes;
    this.keyVault = keyVault || new HistoryKeyVault({ credentialTarget });
    this.key = null;
    this.initialized = false;
  }

  initialize() {
    this.#assertSafeRepositoryLocation();
    fs.mkdirSync(this.repositoryPath, { recursive: true });
    fs.mkdirSync(this.entriesPath, { recursive: true });
    fs.mkdirSync(this.runtimePath, { recursive: true });

    const newRepository = !fs.existsSync(path.join(this.repositoryPath, '.git'));
    if (newRepository) {
      this.#git(['init']);
      this.#git(['symbolic-ref', 'HEAD', 'refs/heads/main']);
      this.#git(['config', '--local', 'user.name', 'Material Tax Reporting Local History']);
      this.#git(['config', '--local', 'user.email', 'local-history@localhost']);
      this.#git(['config', '--local', 'commit.gpgsign', 'false']);
      this.#git(['config', '--local', 'core.hooksPath', '.git/history-hooks-disabled']);
      fs.mkdirSync(path.join(this.repositoryPath, '.git', 'history-hooks-disabled'), { recursive: true });

      atomicWrite(path.join(this.repositoryPath, '.gitignore'), Buffer.from('.runtime/\n', 'utf8'));
      atomicWrite(
        path.join(this.repositoryPath, 'history-schema.json'),
        Buffer.from(`${JSON.stringify({ schemaVersion: SCHEMA_VERSION, encryptedSnapshots: true }, null, 2)}\n`, 'utf8')
      );
      this.#git(['add', '--', '.gitignore', 'history-schema.json']);
      this.#commit('history: initialize encrypted local repository');
    }

    this.#assertNoRemote();

    const hasHistoryEntries = fs.readdirSync(this.entriesPath).some((name) => name.endsWith('.json'));
    try {
      this.key = this.keyVault.getOrCreateKey({ allowCreate: !hasHistoryEntries });
    } catch (error) {
      if (error instanceof HistoryKeyVaultError) {
        throw new LocalHistoryError(error.code, error.message, error.recovery, error);
      }
      throw error;
    }

    const hadPendingTransaction = fs.existsSync(this.journalPath);
    this.initialized = true;
    this.#recoverPendingTransaction();
    return {
      initialized: true,
      repositoryPath: this.repositoryPath,
      liveStatePath: this.liveStatePath,
      remoteConfigured: false,
      recoveredPendingTransaction: hadPendingTransaction
    };
  }

  loadLiveState(defaultState) {
    this.#requireInitialized();
    if (!fs.existsSync(this.liveStatePath)) return cloneJson(defaultState);
    try {
      const envelope = JSON.parse(fs.readFileSync(this.liveStatePath, 'utf8'));
      return this.#decrypt(envelope).state;
    } catch (error) {
      throw new LocalHistoryError(
        'LIVE_STATE_UNREADABLE',
        'The encrypted live tax state could not be read.',
        'Preserve the live-state file and restore a known revision from local history.',
        error
      );
    }
  }

  transact({ action, stableId, summary = '', nextState, metadata = {} }) {
    this.#requireInitialized();
    const normalizedAction = normalizeAction(action);
    if (typeof stableId !== 'string' || stableId.length === 0 || stableId.length > 512) {
      throw new LocalHistoryError('INVALID_STABLE_ID', 'A bounded stable record identifier is required.', HISTORY_RECOVERY.RETRY);
    }
    if (typeof summary !== 'string' || summary.length > 2048) {
      throw new LocalHistoryError('INVALID_HISTORY_SUMMARY', 'History summary text must be 2,048 characters or fewer.', HISTORY_RECOVERY.RETRY);
    }

    const stateJson = assertPlainSerializable(nextState, 'nextState');
    const metadataJson = assertPlainSerializable(metadata, 'metadata');
    if (Buffer.byteLength(stateJson) > this.maxSnapshotBytes) {
      throw new LocalHistoryError(
        'HISTORY_SNAPSHOT_TOO_LARGE',
        `The encrypted snapshot exceeds the ${this.maxSnapshotBytes}-byte safety limit.`,
        HISTORY_RECOVERY.RETRY
      );
    }
    if (Buffer.byteLength(metadataJson) > 1024 * 1024) {
      throw new LocalHistoryError('HISTORY_METADATA_TOO_LARGE', 'History metadata exceeds the 1 MiB safety limit.', HISTORY_RECOVERY.RETRY);
    }

    const revisionId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const stableIdToken = this.#stableIdToken(stableId);
    const payload = {
      stableId,
      summary,
      metadata: cloneJson(metadata),
      state: cloneJson(nextState)
    };
    const envelope = this.#encrypt(payload, { stableIdToken, revisionId, purpose: 'history-snapshot' });
    const entry = {
      schemaVersion: SCHEMA_VERSION,
      revisionId,
      createdAt,
      action: normalizedAction,
      stableIdToken,
      encryptedSnapshot: envelope
    };
    const entryRelativePath = `entries/${revisionId}.json`;
    const entryPath = path.join(this.repositoryPath, ...entryRelativePath.split('/'));
    const liveEnvelope = this.#encrypt(
      { state: cloneJson(nextState), sourceRevisionId: revisionId },
      { stableIdToken: this.#stableIdToken('application-live-state'), revisionId, purpose: 'live-state' }
    );
    const journal = {
      schemaVersion: SCHEMA_VERSION,
      revisionId,
      entryRelativePath,
      liveEnvelope
    };

    atomicWrite(this.journalPath, Buffer.from(`${JSON.stringify(journal)}\n`, 'utf8'));
    atomicWrite(entryPath, Buffer.from(`${JSON.stringify(entry)}\n`, 'utf8'));

    try {
      this.#git(['add', '--', entryRelativePath]);
      this.#commit(this.#commitMessage(normalizedAction));
    } catch (error) {
      this.#gitBestEffort(['reset', '--quiet', '--', entryRelativePath]);
      fs.rmSync(entryPath, { force: true });
      fs.rmSync(this.journalPath, { force: true });
      throw new LocalHistoryError(
        'HISTORY_COMMIT_FAILED',
        'The value change was refused because its encrypted history revision could not be committed.',
        HISTORY_RECOVERY.RETRY,
        error
      );
    }

    try {
      atomicWrite(this.liveStatePath, Buffer.from(`${JSON.stringify(liveEnvelope)}\n`, 'utf8'));
      fs.rmSync(this.journalPath, { force: true });
    } catch (error) {
      // A failed live-state replacement must not be replayed as successful on restart.
      fs.rmSync(this.journalPath, { force: true });
      this.#appendRecoveryRevision({ failedRevisionId: revisionId, previousState: this.#readPreviousState(revisionId) });
      throw new LocalHistoryError(
        'LIVE_STATE_COMMIT_FAILED',
        'The encrypted history revision was preserved, but the live value was not changed.',
        'Use the recovery revision recorded in local history, then retry the value change.',
        error
      );
    }

    return { revisionId, createdAt, action: normalizedAction, committed: true, stateApplied: true };
  }

  query({ text = '', from, to, actions = [] } = {}) {
    this.#requireInitialized();
    const fromTime = from ? Date.parse(from) : Number.NEGATIVE_INFINITY;
    const toTime = to ? Date.parse(to) : Number.POSITIVE_INFINITY;
    if (Number.isNaN(fromTime) || Number.isNaN(toTime)) {
      throw new LocalHistoryError('INVALID_HISTORY_DATE_FILTER', 'History date filters must be valid dates.', HISTORY_RECOVERY.RETRY);
    }
    const actionSet = new Set((actions || []).map(normalizeAction));
    const needle = String(text || '').trim().toLocaleLowerCase();
    const commitMap = this.#entryCommitMap();
    const rows = [];
    const labels = new Map();

    for (const entry of this.#readAllEntries()) {
      const payload = this.#decrypt(entry.encryptedSnapshot);
      if (entry.action === HISTORY_ACTIONS.LABEL && payload.metadata?.targetRevisionId) {
        labels.set(payload.metadata.targetRevisionId, payload.metadata.label || '');
      }
      rows.push({ entry, payload });
    }

    return rows
      .filter(({ entry, payload }) => {
        const time = Date.parse(entry.createdAt);
        if (time < fromTime || time > toTime) return false;
        if (actionSet.size > 0 && !actionSet.has(entry.action)) return false;
        if (!needle) return true;
        const searchable = JSON.stringify({
          action: entry.action,
          summary: payload.summary,
          metadata: payload.metadata,
          label: labels.get(entry.revisionId) || ''
        }).toLocaleLowerCase();
        return searchable.includes(needle);
      })
      .sort((left, right) => right.entry.createdAt.localeCompare(left.entry.createdAt))
      .map(({ entry, payload }) => ({
        revisionId: entry.revisionId,
        commitSha: commitMap.get(`entries/${entry.revisionId}.json`) || null,
        createdAt: entry.createdAt,
        action: entry.action,
        summary: payload.summary,
        metadata: cloneJson(payload.metadata),
        label: labels.get(entry.revisionId) || null,
        stableId: payload.stableId
      }));
  }

  readDiff(fromRevision, toRevision) {
    this.#requireInitialized();
    const from = this.#readRevision(fromRevision);
    const to = this.#readRevision(toRevision);
    return {
      fromRevision,
      toRevision,
      changes: flattenDiff(from.payload.state, to.payload.state)
    };
  }

  restore(revisionId, kind = HISTORY_ACTIONS.RESTORE) {
    this.#requireInitialized();
    const action = normalizeAction(kind);
    if (![HISTORY_ACTIONS.RESTORE, HISTORY_ACTIONS.UNDO, HISTORY_ACTIONS.REDO].includes(action)) {
      throw new LocalHistoryError('INVALID_RESTORE_KIND', 'Restore kind must be restore, undo, or redo.', HISTORY_RECOVERY.RETRY);
    }
    const target = this.#readRevision(revisionId);
    return this.transact({
      action,
      stableId: target.payload.stableId,
      summary: `${action} from a selected local revision`,
      nextState: target.payload.state,
      metadata: { sourceRevisionId: revisionId }
    });
  }

  label(revisionId, label) {
    this.#requireInitialized();
    if (typeof label !== 'string' || label.length === 0 || label.length > 256) {
      throw new LocalHistoryError('INVALID_HISTORY_LABEL', 'A history label must contain 1 to 256 characters.', HISTORY_RECOVERY.RETRY);
    }
    this.#readRevision(revisionId);
    const currentState = this.loadLiveState({});
    return this.transact({
      action: HISTORY_ACTIONS.LABEL,
      stableId: `history-label:${revisionId}`,
      summary: 'Label a local history revision',
      nextState: currentState,
      metadata: { targetRevisionId: revisionId, label }
    });
  }

  storage() {
    this.#requireInitialized();
    const repositoryBytes = directoryBytes(this.repositoryPath);
    const liveStateBytes = fs.existsSync(this.liveStatePath) ? fs.statSync(this.liveStatePath).size : 0;
    return {
      repositoryBytes,
      liveStateBytes,
      totalBytes: repositoryBytes + liveStateBytes,
      revisionCount: this.#readAllEntries().length,
      automaticExpiry: false,
      revisionLimit: null,
      pruningRequiresSuperConfirmation: true
    };
  }

  exportRedacted(destination) {
    this.#requireInitialized();
    const destinationPath = path.resolve(destination);
    if (isWithin(this.repositoryPath, destinationPath) || destinationPath === this.liveStatePath) {
      throw new LocalHistoryError(
        'INVALID_HISTORY_EXPORT_DESTINATION',
        'The redacted export must be written outside the history repository and live-state file.',
        HISTORY_RECOVERY.CHOOSE_EXPORT_DESTINATION
      );
    }
    const commitMap = this.#entryCommitMap();
    const revisions = this.#readAllEntries().map((entry) => ({
      revisionId: entry.revisionId,
      commitSha: commitMap.get(`entries/${entry.revisionId}.json`) || null,
      createdAt: entry.createdAt,
      action: entry.action
    }));
    const exported = {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      redacted: true,
      redactions: [
        'taxpayer values and calculations',
        'encrypted snapshots and encryption material',
        'stable record identifiers',
        'user labels, summaries, and metadata',
        'file paths and credential identifiers'
      ],
      repositoryRemoteConfigured: false,
      automaticExpiry: false,
      revisionCount: revisions.length,
      revisions
    };
    atomicWrite(destinationPath, Buffer.from(`${JSON.stringify(exported, null, 2)}\n`, 'utf8'));
    return { destination: destinationPath, revisionCount: revisions.length, redacted: true };
  }

  prune(request = {}) {
    this.#requireInitialized();
    this.#assertSuperConfirmation(request.superConfirmation);
    if (!Array.isArray(request.revisionIds) || request.revisionIds.length === 0) {
      throw new LocalHistoryError('PRUNE_SELECTION_REQUIRED', 'Select at least one history revision to prune.', HISTORY_RECOVERY.RETRY);
    }

    const selected = new Set(request.revisionIds.map(String));
    const allEntries = this.#readAllEntries();
    const existingIds = new Set(allEntries.map((entry) => entry.revisionId));
    for (const revisionId of selected) {
      if (!existingIds.has(revisionId)) {
        throw new LocalHistoryError('HISTORY_REVISION_NOT_FOUND', 'A selected prune revision no longer exists.', HISTORY_RECOVERY.RETRY);
      }
    }
    if (selected.size >= allEntries.length) {
      throw new LocalHistoryError(
        'PRUNE_WOULD_REMOVE_ALL_HISTORY',
        'At least one restorable history revision must remain after pruning.',
        HISTORY_RECOVERY.RETRY
      );
    }

    const beforeBytes = directoryBytes(this.repositoryPath);
    const currentState = this.loadLiveState({});
    const audit = this.transact({
      action: HISTORY_ACTIONS.PRUNE_AUTHORIZED,
      stableId: 'local-history-pruning',
      summary: 'User authorized local history pruning through super confirmation',
      nextState: currentState,
      metadata: {
        selectedRevisionCount: selected.size,
        selectionDigest: crypto.createHash('sha256').update([...selected].sort().join('\n')).digest('hex')
      }
    });

    const compactPath = `${this.repositoryPath}.compact-${crypto.randomUUID()}`;
    const backupPath = `${this.repositoryPath}.replaced-${crypto.randomUUID()}`;
    try {
      fs.mkdirSync(path.join(compactPath, 'entries'), { recursive: true });
      atomicWrite(path.join(compactPath, '.gitignore'), Buffer.from('.runtime/\n', 'utf8'));
      fs.copyFileSync(path.join(this.repositoryPath, 'history-schema.json'), path.join(compactPath, 'history-schema.json'));
      for (const entry of this.#readAllEntries()) {
        if (!selected.has(entry.revisionId)) {
          fs.copyFileSync(
            path.join(this.entriesPath, `${entry.revisionId}.json`),
            path.join(compactPath, 'entries', `${entry.revisionId}.json`)
          );
        }
      }

      this.#initializeCompactedRepository(compactPath);
      fs.renameSync(this.repositoryPath, backupPath);
      try {
        fs.renameSync(compactPath, this.repositoryPath);
      } catch (error) {
        fs.renameSync(backupPath, this.repositoryPath);
        throw error;
      }
      fs.rmSync(backupPath, { recursive: true, force: true });
      fs.mkdirSync(this.runtimePath, { recursive: true });
    } catch (error) {
      if (fs.existsSync(compactPath)) fs.rmSync(compactPath, { recursive: true, force: true });
      throw new LocalHistoryError(
        'HISTORY_PRUNE_FAILED',
        'Local history pruning did not complete; the existing repository was preserved when recovery was possible.',
        HISTORY_RECOVERY.PRESERVE_PATHS,
        error
      );
    }

    const afterBytes = directoryBytes(this.repositoryPath);
    return {
      auditRevisionId: audit.revisionId,
      prunedRevisionCount: selected.size,
      beforeBytes,
      afterBytes,
      reclaimedBytes: Math.max(0, beforeBytes - afterBytes),
      automaticExpiry: false
    };
  }

  #initializeCompactedRepository(compactPath) {
    this.#gitAt(compactPath, ['init']);
    this.#gitAt(compactPath, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
    this.#gitAt(compactPath, ['config', '--local', 'user.name', 'Material Tax Reporting Local History']);
    this.#gitAt(compactPath, ['config', '--local', 'user.email', 'local-history@localhost']);
    this.#gitAt(compactPath, ['config', '--local', 'commit.gpgsign', 'false']);
    this.#gitAt(compactPath, ['config', '--local', 'core.hooksPath', '.git/history-hooks-disabled']);
    fs.mkdirSync(path.join(compactPath, '.git', 'history-hooks-disabled'), { recursive: true });
    this.#gitAt(compactPath, ['add', '--', '.gitignore', 'history-schema.json', 'entries']);
    this.#gitAt(compactPath, ['commit', '--no-gpg-sign', '-F', '-'], {
      input: 'history: compact after authorized pruning\n'
    });
    if (this.#gitAt(compactPath, ['remote']).trim()) {
      throw new LocalHistoryError('HISTORY_REMOTE_CONFIGURED', 'Compacted history unexpectedly contains a remote.');
    }
  }

  #assertSuperConfirmation(confirmation) {
    const accepted = confirmation
      && confirmation.firstKey === true
      && confirmation.secondKey === true
      && confirmation.sliderPercent === 100
      && confirmation.acknowledgedIrreversible === true;
    if (!accepted) {
      throw new LocalHistoryError(
        'SUPER_CONFIRMATION_REQUIRED',
        'Pruning requires both confirmation keys, the full slider, and explicit acknowledgement.',
        HISTORY_RECOVERY.COMPLETE_SUPER_CONFIRMATION
      );
    }
  }

  #recoverPendingTransaction() {
    if (!fs.existsSync(this.journalPath)) return;
    let journal;
    try {
      journal = JSON.parse(fs.readFileSync(this.journalPath, 'utf8'));
      const committed = this.#git(['log', '--format=%H', '--', journal.entryRelativePath]).trim().length > 0;
      if (committed) {
        atomicWrite(this.liveStatePath, Buffer.from(`${JSON.stringify(journal.liveEnvelope)}\n`, 'utf8'));
      }
      fs.rmSync(this.journalPath, { force: true });
    } catch (error) {
      throw new LocalHistoryError(
        'PENDING_HISTORY_RECOVERY_FAILED',
        'An interrupted value change could not be recovered automatically.',
        HISTORY_RECOVERY.PRESERVE_PATHS,
        error
      );
    }
  }

  #appendRecoveryRevision({ failedRevisionId, previousState }) {
    const revisionId = crypto.randomUUID();
    const stableId = 'local-history-recovery';
    const stableIdToken = this.#stableIdToken(stableId);
    const entry = {
      schemaVersion: SCHEMA_VERSION,
      revisionId,
      createdAt: new Date().toISOString(),
      action: HISTORY_ACTIONS.RECOVERY,
      stableIdToken,
      encryptedSnapshot: this.#encrypt(
        {
          stableId,
          summary: 'Record recovery after live-state write failure',
          metadata: { failedRevisionId },
          state: previousState
        },
        { stableIdToken, revisionId, purpose: 'history-snapshot' }
      )
    };
    const relative = `entries/${revisionId}.json`;
    atomicWrite(path.join(this.repositoryPath, ...relative.split('/')), Buffer.from(`${JSON.stringify(entry)}\n`, 'utf8'));
    this.#git(['add', '--', relative]);
    this.#commit('history: record transactional recovery');
  }

  #readPreviousState(excludeRevisionId) {
    const entries = this.#readAllEntries()
      .filter((entry) => entry.revisionId !== excludeRevisionId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    if (entries.length === 0) return {};
    return this.#decrypt(entries[0].encryptedSnapshot).state;
  }

  #readAllEntries() {
    if (!fs.existsSync(this.entriesPath)) return [];
    return fs.readdirSync(this.entriesPath)
      .filter((name) => /^[0-9a-f-]{36}\.json$/i.test(name))
      .map((name) => {
        try {
          const entry = JSON.parse(fs.readFileSync(path.join(this.entriesPath, name), 'utf8'));
          if (entry.schemaVersion !== SCHEMA_VERSION || entry.revisionId !== name.slice(0, -5)) throw new Error('Schema mismatch.');
          return entry;
        } catch (error) {
          throw new LocalHistoryError(
            'HISTORY_ENTRY_UNREADABLE',
            'A local history revision is corrupt or uses an unsupported schema.',
            HISTORY_RECOVERY.RESTORE_REPOSITORY,
            error
          );
        }
      });
  }

  #readRevision(revisionId) {
    if (typeof revisionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(revisionId)) {
      throw new LocalHistoryError('INVALID_REVISION_ID', 'A valid local revision identifier is required.', HISTORY_RECOVERY.RETRY);
    }
    const filePath = path.join(this.entriesPath, `${revisionId}.json`);
    if (!fs.existsSync(filePath)) {
      throw new LocalHistoryError('HISTORY_REVISION_NOT_FOUND', 'The requested local history revision was not found.', HISTORY_RECOVERY.RETRY);
    }
    const entry = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return { entry, payload: this.#decrypt(entry.encryptedSnapshot) };
  }

  #entryCommitMap() {
    const output = this.#git(['log', '--format=@@%H', '--name-only', '--', 'entries']);
    const map = new Map();
    let currentSha = null;
    for (const line of output.split(/\r?\n/)) {
      if (line.startsWith('@@')) currentSha = line.slice(2);
      else if (currentSha && line.startsWith('entries/') && !map.has(line)) map.set(line, currentSha);
    }
    return map;
  }

  #stableIdToken(stableId) {
    return crypto.createHmac('sha256', this.key).update(HISTORY_NAMESPACE).update('\0').update(stableId).digest('hex');
  }

  #encrypt(payload, { stableIdToken, revisionId, purpose }) {
    const plaintext = Buffer.from(assertPlainSerializable(payload, 'snapshot'), 'utf8');
    const iv = crypto.randomBytes(12);
    const aad = Buffer.from(`${HISTORY_NAMESPACE}\0${purpose}\0${stableIdToken}\0${revisionId}`, 'utf8');
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    plaintext.fill(0);
    return {
      schemaVersion: SCHEMA_VERSION,
      algorithm: SNAPSHOT_ALGORITHM,
      purpose,
      stableIdToken,
      revisionId,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: ciphertext.toString('base64')
    };
  }

  #decrypt(envelope) {
    if (!envelope || envelope.schemaVersion !== SCHEMA_VERSION || envelope.algorithm !== SNAPSHOT_ALGORITHM) {
      throw new LocalHistoryError('UNSUPPORTED_HISTORY_ENVELOPE', 'An encrypted history envelope is unsupported.', HISTORY_RECOVERY.RESTORE_REPOSITORY);
    }
    try {
      const aad = Buffer.from(
        `${HISTORY_NAMESPACE}\0${envelope.purpose}\0${envelope.stableIdToken}\0${envelope.revisionId}`,
        'utf8'
      );
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(envelope.iv, 'base64'));
      decipher.setAAD(aad);
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
        decipher.final()
      ]);
      try {
        return JSON.parse(plaintext.toString('utf8'));
      } finally {
        plaintext.fill(0);
      }
    } catch (error) {
      throw new LocalHistoryError(
        'HISTORY_DECRYPTION_FAILED',
        'An encrypted local history snapshot could not be authenticated or decrypted.',
        HISTORY_RECOVERY.RESTORE_CREDENTIAL,
        error
      );
    }
  }

  #assertSafeRepositoryLocation() {
    let current = path.dirname(this.repositoryPath);
    while (current !== path.dirname(current)) {
      if (fs.existsSync(path.join(current, '.git'))) {
        throw new LocalHistoryError(
          'UNSAFE_HISTORY_LOCATION',
          'The local history repository must not be created inside an application source repository.',
          'Choose the stable per-user application-data location.'
        );
      }
      current = path.dirname(current);
    }
  }

  #commitMessage(action) {
    const safeMessages = {
      [HISTORY_ACTIONS.TAX_VALUE_CREATED]: 'history: record tax value creation',
      [HISTORY_ACTIONS.TAX_VALUE_EDITED]: 'history: record tax value edit',
      [HISTORY_ACTIONS.TAX_VALUE_IMPORTED]: 'history: record tax value import',
      [HISTORY_ACTIONS.PARSER_CORRECTED]: 'history: record parser correction',
      [HISTORY_ACTIONS.TAX_VALUE_DELETED]: 'history: record tax value deletion',
      [HISTORY_ACTIONS.WIZARD_ANSWER_RECORDED]: 'history: record wizard answer',
      [HISTORY_ACTIONS.SETTINGS_MUTATED]: 'history: record settings change',
      [HISTORY_ACTIONS.DISCARDED]: 'history: record discarded work',
      [HISTORY_ACTIONS.UNDO]: 'history: record undo',
      [HISTORY_ACTIONS.REDO]: 'history: record redo',
      [HISTORY_ACTIONS.RESTORE]: 'history: record restore',
      [HISTORY_ACTIONS.LABEL]: 'history: record revision label',
      [HISTORY_ACTIONS.PRUNE_AUTHORIZED]: 'history: record authorized pruning',
      [HISTORY_ACTIONS.RECOVERY]: 'history: record transactional recovery'
    };
    return safeMessages[action];
  }

  #commit(message) {
    this.#git(['commit', '--no-gpg-sign', '-F', '-'], { input: `${message}\n` });
  }

  #git(args, options = {}) {
    return this.#gitAt(this.repositoryPath, args, options);
  }

  #gitBestEffort(args) {
    try {
      this.#git(args);
    } catch {
      // The primary operation will report the original failure.
    }
  }

  #gitAt(cwd, args, { input } = {}) {
    const result = spawnSync('git', args, {
      cwd,
      input,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 30_000,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GCM_INTERACTIVE: 'Never'
      }
    });
    if (result.error || result.status !== 0) {
      throw new LocalHistoryError(
        'LOCAL_GIT_OPERATION_FAILED',
        'The isolated local history repository could not record the requested operation.',
        HISTORY_RECOVERY.PRESERVE_PATHS,
        result.error
      );
    }
    return result.stdout || '';
  }

  #requireInitialized() {
    if (!this.initialized || !this.key) {
      throw new LocalHistoryError('HISTORY_NOT_INITIALIZED', 'Initialize local history before using it.', HISTORY_RECOVERY.RETRY);
    }
    this.#assertNoRemote();
  }

  #assertNoRemote() {
    if (this.#git(['remote']).trim().length > 0) {
      throw new LocalHistoryError(
        'HISTORY_REMOTE_CONFIGURED',
        'Local history is unavailable because its isolated repository has a remote configured.',
        'Preserve the local files, remove every remote from the isolated history repository, and retry.'
      );
    }
  }
}

module.exports = {
  HISTORY_ACTIONS,
  HISTORY_RECOVERY,
  LocalHistoryError,
  LocalHistoryService,
  SCHEMA_VERSION
};
