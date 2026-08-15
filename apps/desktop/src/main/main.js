'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { HistoryStore } = require('./history-store');
const { KeyVault, atomicWrite } = require('./key-vault');
const {
  ProjectBundleError,
  createPortableKey,
  encryptAttachment,
  readBundle,
  saveBundle,
  storeProjectMetadata,
  validateEncryptedAttachment,
} = require('./project-bundle');
const { PreferencesStore } = require('./preferences-store');
const { VocabularyStore } = require('./vocabulary-store');
const { NotificationLog } = require('./notification-log');
const { ElementLocks } = require('./element-locks');
const { Authenticator } = require('./totp');
const { SupportTickets } = require('./support-tickets');
const { FileConverter } = require('./converter');
const { DocsLibrary } = require('./docs-library');
const { ChangelogLibrary } = require('./changelog-library');
const { OllamaSuite } = require('./ollama-bridge');
const { TransferCoordinator } = require('./transfer-progress');
const { buildExport, writeExport } = require('./exports');
const { editorStatus, openInEditor, revealInFolder } = require('./editor-handoff');
const scheduleSettings = require('./settings-schedule');
const {
  APPEARANCE_PROPERTIES,
  contrastRatio,
  createSearchState,
  exportAppearancePreset,
  importAppearancePreset,
  parseColor,
  resolveDisplayName,
  setAppearanceProperty,
  validateLogoUpload,
} = require('@material-tax-reporting/surface-kernel');

const APP_NAME = 'Material Tax Reporting';
const PROJECT_EXTENSION = 'mtrproject';
const MAX_ATTACHMENT_BYTES = 96 * 1024 * 1024;
const ALLOWED_FIELDS = new Map([
  ['profile.fullName', { type: 'string', max: 200 }],
  ['profile.socialInsuranceNumber', { type: 'sin' }],
  ['profile.dateOfBirth', { type: 'date' }],
  ['residency.province', { type: 'enum', values: ['ON'] }],
  ['residency.address', { type: 'string', max: 500 }],
  ['income.reviewedAllDocuments', { type: 'boolean' }],
  ['deductions.notes', { type: 'string', max: 4000 }],
  ['delivery.mailingDestination', { type: 'string', max: 500 }],
  ['review.forms', { type: 'boolean' }],
  ['review.calculations', { type: 'boolean' }],
  ['review.attachments', { type: 'boolean' }],
  ['review.mailingDestination', { type: 'boolean' }],
  ['review.signatureFields', { type: 'boolean' }],
]);

let mainWindow = null;
let session = null;
let pendingImport = null;
let vault = null;
let instancesRoot = null;
let preferences = null;
let vocabulary = null;
let notifications = null;
let locks = null;
let authenticator = null;
let tickets = null;
let converter = null;
let docsLibrary = null;
let changelogLibrary = null;
let ollamaSuite = null;
let transfers = null;

/**
 * Elements that carry a required disclosure. An appearance override is refused
 * when it would make one of them unreadable, and a lock may never cover them.
 */
const PROTECTED_DISCLOSURE_ELEMENTS = new Set([
  'wizard-validation',
  'wizard-boundary-statement',
  'welcome-boundary-statement',
  'review-boundary-statement',
]);

const MIN_DISCLOSURE_CONTRAST = 4.5;
const MIN_DISCLOSURE_FONT_PX = 12;
const MAX_LOGO_DIMENSION = 512;

function initialState(taxYear) {
  return {
    schemaVersion: 1,
    taxYear,
    profile: { fullName: '', socialInsuranceNumber: '', dateOfBirth: '' },
    residency: { province: '', address: '' },
    income: { reviewedAllDocuments: false },
    deductions: { notes: '' },
    delivery: { mailingDestination: '' },
    attachments: [],
    review: { forms: false, calculations: false, attachments: false, mailingDestination: false, signatureFields: false },
  };
}

function officialSources() {
  const retrievedAt = new Date().toISOString();
  return [
    {
      title: 'Completing a tax return',
      url: 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return.html',
      retrievedAt,
    },
    {
      title: 'Ontario personal income tax',
      url: 'https://www.ontario.ca/page/personal-income-tax',
      retrievedAt,
    },
  ];
}

function publicError(error, fallback = {}) {
  if (error instanceof ProjectBundleError) return { code: error.code, message: error.message, recovery: error.recovery };
  return {
    code: fallback.code || 'OPERATION_FAILED',
    message: fallback.message || 'The requested local operation did not complete.',
    recovery: fallback.recovery || 'Keep the current project open and retry.',
  };
}

function envelope(work, fallback) {
  try { return { ok: true, data: work() }; } catch (error) { return { ok: false, error: publicError(error, fallback) }; }
}

function clone(value) {
  return structuredClone(value);
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactObject(value, keys) {
  if (!plainObject(value)) throw new Error('Project state contains an invalid object.');
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error('Project state contains unexpected fields.');
}

function validateStateShape(candidate, metadata, projectRoot, { verifyAttachments = false, dataKey = null } = {}) {
  exactObject(candidate, ['schemaVersion', 'taxYear', 'profile', 'residency', 'income', 'deductions', 'delivery', 'attachments', 'review']);
  if (candidate.schemaVersion !== 1 || candidate.taxYear !== metadata.taxYear) throw new Error('Project state tax-year metadata does not match.');
  exactObject(candidate.profile, ['fullName', 'socialInsuranceNumber', 'dateOfBirth']);
  exactObject(candidate.residency, ['province', 'address']);
  exactObject(candidate.income, ['reviewedAllDocuments']);
  exactObject(candidate.deductions, ['notes']);
  exactObject(candidate.delivery, ['mailingDestination']);
  exactObject(candidate.review, ['forms', 'calculations', 'attachments', 'mailingDestination', 'signatureFields']);
  if (typeof candidate.profile.fullName !== 'string' || candidate.profile.fullName.length > 200
    || typeof candidate.profile.socialInsuranceNumber !== 'string' || (candidate.profile.socialInsuranceNumber && !/^\d{9}$/.test(candidate.profile.socialInsuranceNumber))
    || typeof candidate.profile.dateOfBirth !== 'string' || (candidate.profile.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(candidate.profile.dateOfBirth))
    || !['', 'ON'].includes(candidate.residency.province) || typeof candidate.residency.address !== 'string' || candidate.residency.address.length > 500
    || typeof candidate.income.reviewedAllDocuments !== 'boolean' || typeof candidate.deductions.notes !== 'string' || candidate.deductions.notes.length > 4000
    || typeof candidate.delivery.mailingDestination !== 'string' || candidate.delivery.mailingDestination.length > 500) {
    throw new Error('Project state contains an invalid answer.');
  }
  for (const value of Object.values(candidate.review)) if (typeof value !== 'boolean') throw new Error('Project review state is invalid.');
  if (!Array.isArray(candidate.attachments) || candidate.attachments.length > 10_000) throw new Error('Project attachment state exceeds its limit.');
  const ids = new Set();
  for (const attachment of candidate.attachments) {
    exactObject(attachment, ['id', 'displayName', 'bytes', 'addedAt', 'parserConfirmed']);
    if (!/^[0-9a-f-]{36}$/i.test(attachment.id) || ids.has(attachment.id) || typeof attachment.displayName !== 'string'
      || attachment.displayName.length < 1 || attachment.displayName.length > 260 || !Number.isSafeInteger(attachment.bytes)
      || attachment.bytes < 1 || attachment.bytes > MAX_ATTACHMENT_BYTES || typeof attachment.parserConfirmed !== 'boolean'
      || new Date(attachment.addedAt).toISOString() !== attachment.addedAt) throw new Error('Project attachment metadata is invalid.');
    ids.add(attachment.id);
    const encryptedPath = path.join(projectRoot, 'attachments', `${attachment.id}.enc`);
    const stat = fs.statSync(encryptedPath);
    if (!stat.isFile() || stat.size < 1 || stat.size > Math.ceil(MAX_ATTACHMENT_BYTES * 1.5)) throw new Error('An encrypted project attachment is missing or invalid.');
    if (verifyAttachments) validateEncryptedAttachment(dataKey, attachment.id, fs.readFileSync(encryptedPath), attachment.bytes);
  }
  const confirmations = new Set(metadata.parserConfirmations.map((entry) => entry.attachmentId));
  if (confirmations.size !== metadata.parserConfirmations.length) throw new Error('Parser confirmation metadata is duplicated.');
  for (const attachment of candidate.attachments) {
    if (attachment.parserConfirmed !== confirmations.has(attachment.id)) throw new Error('Parser confirmation metadata does not match the encrypted state.');
  }
  for (const id of confirmations) if (!ids.has(id)) throw new Error('Parser confirmation metadata references a missing attachment.');
  return candidate;
}

function synchronizeParserConfirmations(active, restoredState) {
  const confirmedIds = new Set(restoredState.attachments.filter((attachment) => attachment.parserConfirmed).map((attachment) => attachment.id));
  const byId = new Map(active.metadata.parserConfirmations.map((entry) => [entry.attachmentId, entry]));
  active.metadata.parserConfirmations = [...confirmedIds].map((attachmentId) => byId.get(attachmentId) || {
    attachmentId,
    parserId: 'history-restore-manual-confirmation-v1',
    confirmedAt: new Date().toISOString(),
  });
}

function ensureSession() {
  if (!session) throw new Error('Open or create a project first.');
  return session;
}

function ensureProjectFilePath(filePath) {
  const resolved = path.resolve(filePath);
  if (path.extname(resolved).toLowerCase() !== `.${PROJECT_EXTENSION}`) return `${resolved}.${PROJECT_EXTENSION}`;
  return resolved;
}

function metadataFor(projectId, taxYear, currentRevisionId, state, existing = null) {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    projectId,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    taxYear,
    ruleSources: existing?.ruleSources || officialSources(),
    parserConfirmations: existing?.parserConfirmations || [],
    pdfReview: clone(state.review),
    currentRevisionId,
  };
}

function serializeSessionStatus() {
  if (!session) return { open: false };
  return {
    open: true,
    projectId: session.metadata.projectId,
    instanceId: session.instanceId,
    taxYear: session.metadata.taxYear,
    projectFileName: path.basename(session.filePath),
    historyHead: session.history.verify().head,
    manualPdfReviewComplete: Object.values(session.state.review).every(Boolean),
    transmission: 'mail-in PDF only; no electronic submission or automatic filing',
  };
}

function persistSession(progress = null) {
  const active = ensureSession();
  active.metadata = metadataFor(
    active.metadata.projectId,
    active.metadata.taxYear,
    active.history.currentRevisionId(),
    active.state,
    active.metadata,
  );
  storeProjectMetadata(active.projectRoot, active.metadata, active.portableKey);
  const result = saveBundle({
    projectRoot: active.projectRoot,
    destinationPath: active.filePath,
    dataKey: active.dataKey,
    metadata: active.metadata,
    portableKey: active.portableKey,
    progress,
  });
  return { ...result, status: serializeSessionStatus() };
}

function setNested(object, dottedPath, value) {
  const segments = dottedPath.split('.');
  let cursor = object;
  for (const segment of segments.slice(0, -1)) cursor = cursor[segment];
  cursor[segments.at(-1)] = value;
}

function normalizeValue(field, value) {
  const rule = ALLOWED_FIELDS.get(field);
  if (!rule) throw new Error('This project field is not writable.');
  if (rule.type === 'boolean') {
    if (typeof value !== 'boolean') throw new Error('This answer must be yes or no.');
    return value;
  }
  const normalized = String(value).trim();
  if (rule.type === 'string') {
    if (normalized.length > rule.max) throw new Error('This answer is longer than the allowed limit.');
    return normalized;
  }
  if (rule.type === 'sin') {
    const digits = normalized.replace(/[ -]/g, '');
    if (digits && !/^\d{9}$/.test(digits)) throw new Error('Enter all 9 digits, or leave this answer empty until ready.');
    return digits;
  }
  if (rule.type === 'date') {
    if (normalized && !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error('Use a complete date in YYYY-MM-DD form.');
    return normalized;
  }
  if (rule.type === 'enum') {
    if (!rule.values.includes(normalized)) throw new Error('Choose one of the listed values.');
    return normalized;
  }
  throw new Error('Unsupported answer type.');
}

function mutateField(request) {
  const active = ensureSession();
  if (!request || typeof request.field !== 'string') throw new Error('A project field is required.');
  const value = normalizeValue(request.field, request.value);
  const nextState = clone(active.state);
  setNested(nextState, request.field, value);
  validateStateShape(nextState, active.metadata, active.projectRoot);
  if (JSON.stringify(nextState) === JSON.stringify(active.state)) return { state: clone(active.state), unchanged: true, status: serializeSessionStatus() };
  const action = request.field.startsWith('review.') ? 'review' : 'answer';
  const revision = active.history.transact({
    action,
    stableId: request.field,
    summary: `Updated ${request.field}`,
    state: nextState,
  });
  active.state = nextState;
  persistSession();
  return { state: clone(active.state), revision, status: serializeSessionStatus() };
}

function closeSession({ preserveVault = true } = {}) {
  if (!session) return;
  session.history.dispose();
  session.dataKey.fill(0);
  if (!preserveVault) vault.remove(session.instanceId);
  session = null;
}

function discardPendingImport() {
  if (!pendingImport) return;
  pendingImport.dataKey.fill(0);
  fs.rmSync(pendingImport.scratchRoot, { recursive: true, force: true, maxRetries: 2, retryDelay: 25 });
  pendingImport = null;
}

function createProjectSession({ instanceId, projectRoot, filePath, dataKey, portableKey, metadata, history, state }) {
  return { instanceId, projectRoot, filePath, dataKey, portableKey, metadata, history, state };
}

function projectRootFor(instanceId) {
  return path.join(instancesRoot, instanceId);
}

function copyValidatedProject(source, destination) {
  if (fs.existsSync(destination)) throw new Error('The app-private project destination already exists.');
  fs.cpSync(source, destination, { recursive: true, errorOnExist: true, force: false });
}

function importedSession({ filePath, strategy }) {
  if (!pendingImport) throw new Error('No validated project preview is available.');
  const imported = pendingImport;
  const instanceId = crypto.randomUUID();
  const destination = projectRootFor(instanceId);
  copyValidatedProject(imported.projectRoot, destination);
  vault.put(instanceId, imported.dataKey);
  const history = new HistoryStore({
    repositoryPath: path.join(destination, 'history'),
    projectId: imported.metadata.projectId,
    dataKey: imported.dataKey,
  });
  history.initialize(initialState(imported.metadata.taxYear));
  const state = history.load();
  validateStateShape(state, imported.metadata, destination, { verifyAttachments: true, dataKey: imported.dataKey });
  const revision = history.transact({
    action: strategy === 'replace' ? 'replace' : 'import-copy',
    stableId: `import:${imported.metadata.projectId}`,
    summary: strategy === 'replace' ? 'Replaced the open local project from a validated project file' : 'Created a local copy from a validated project file',
    state,
  });
  const metadata = metadataFor(imported.metadata.projectId, imported.metadata.taxYear, revision.revisionId, state, imported.metadata);
  storeProjectMetadata(destination, metadata, imported.portableKey);
  return createProjectSession({
    instanceId,
    projectRoot: destination,
    filePath,
    dataKey: Buffer.from(imported.dataKey),
    portableKey: imported.portableKey,
    metadata,
    history,
    state,
  });
}

function copyNewHistoryRecords(importedHistoryPath, activeHistoryPath) {
  for (const directoryName of ['records', 'labels']) {
    const source = path.join(importedHistoryPath, directoryName);
    const destination = path.join(activeHistoryPath, directoryName);
    if (!fs.existsSync(source)) continue;
    fs.mkdirSync(destination, { recursive: true });
    for (const name of fs.readdirSync(source)) {
      const from = path.join(source, name);
      const to = path.join(destination, name);
      if (!fs.statSync(from).isFile()) throw new Error('Imported history contains an invalid record entry.');
      if (fs.existsSync(to)) {
        if (!crypto.timingSafeEqual(crypto.createHash('sha256').update(fs.readFileSync(from)).digest(), crypto.createHash('sha256').update(fs.readFileSync(to)).digest())) {
          throw new Error('Imported history reuses a record name with different content.');
        }
      } else fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
    }
  }
}

function reconcileImport() {
  const active = ensureSession();
  const imported = pendingImport;
  if (!imported || imported.metadata.projectId !== active.metadata.projectId
    || !crypto.timingSafeEqual(imported.dataKey, active.dataKey)) {
    throw new Error('Only another copy of this same encrypted project can be reconciled.');
  }
  const activeHistoryPath = path.join(active.projectRoot, 'history');
  const importedHistoryPath = path.join(imported.projectRoot, 'history');
  const importedState = new HistoryStore({ repositoryPath: importedHistoryPath, projectId: imported.metadata.projectId, dataKey: imported.dataKey });
  const state = importedState.load();
  validateStateShape(state, imported.metadata, imported.projectRoot, { verifyAttachments: true, dataKey: imported.dataKey });
  importedState.dispose();
  copyNewHistoryRecords(importedHistoryPath, activeHistoryPath);
  const fetch = spawnSync('git', ['-C', activeHistoryPath, 'fetch', '--no-tags', importedHistoryPath, 'main'], {
    encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 8 * 1024 * 1024,
  });
  if (fetch.error || fetch.status !== 0) throw new Error('The imported Git history could not be reconciled.');
  const importedHead = spawnSync('git', ['-C', activeHistoryPath, 'rev-parse', 'FETCH_HEAD'], { encoding: 'utf8', windowsHide: true }).stdout.trim();
  const revision = active.history.transact({
    action: 'reconcile',
    stableId: `reconcile:${imported.metadata.currentRevisionId}`,
    summary: 'Reconciled another validated copy while preserving both histories',
    state,
  });
  const localHead = active.history.verify().head;
  const tree = spawnSync('git', ['-C', activeHistoryPath, 'rev-parse', `${localHead}^{tree}`], { encoding: 'utf8', windowsHide: true }).stdout.trim();
  const merge = spawnSync('git', ['-C', activeHistoryPath, 'commit-tree', tree, '-p', localHead, '-p', importedHead, '-m', 'history: reconcile validated project histories'], {
    encoding: 'utf8', windowsHide: true,
    env: { ...process.env, GIT_AUTHOR_NAME: 'Material Tax Reporting History', GIT_AUTHOR_EMAIL: 'local-history@invalid', GIT_COMMITTER_NAME: 'Material Tax Reporting History', GIT_COMMITTER_EMAIL: 'local-history@invalid' },
  });
  if (merge.error || merge.status !== 0) throw new Error('The imported Git histories could not be joined.');
  const update = spawnSync('git', ['-C', activeHistoryPath, 'update-ref', 'refs/heads/main', merge.stdout.trim(), localHead], { encoding: 'utf8', windowsHide: true });
  if (update.error || update.status !== 0) throw new Error('The reconciled Git ref could not be updated.');
  active.state = state;
  active.metadata = metadataFor(active.metadata.projectId, active.metadata.taxYear, revision.revisionId, state, active.metadata);
  persistSession();
  return { state: clone(active.state), status: serializeSessionStatus() };
}

function resolveOfflineOcrRuntime() {
  const candidates = [
    path.join(process.resourcesPath, 'offline-ocr'),
    path.join(process.resourcesPath, 'resources', 'offline-ocr'),
    path.join(app.getAppPath(), 'resources', 'offline-ocr'),
    path.resolve(app.getAppPath(), '..', 'offline-ocr'),
  ].map((candidate) => path.resolve(candidate));
  const searchedLocations = [...new Set(candidates)];
  for (const root of searchedLocations) {
    const evidence = path.join(root, 'offline-ocr-assets.lock.json');
    const modules = path.join(root, 'node_modules');
    if (fs.existsSync(evidence) && fs.statSync(evidence).isFile() && fs.existsSync(modules) && fs.statSync(modules).isDirectory()) {
      return { available: true, resourceRoot: root, evidencePath: evidence, searchedLocations };
    }
  }
  return {
    available: false,
    resourceRoot: null,
    evidencePath: null,
    searchedLocations,
    missing: 'Bundled offline OCR assets were not found in any packaged resource location.',
  };
}

function sendToRenderer(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

/**
 * Records an application-level action in the project history when a project is
 * open. Preferences themselves are never written into a history record; only
 * the fact that a named setting changed is recorded.
 */
function recordAppAction(action, summary) {
  if (!session) return null;
  try {
    return session.history.transact({ action, stableId: `app:${action}`, summary: summary.slice(0, 200), state: session.state });
  } catch {
    return null;
  }
}

function searchStateFrom(raw) {
  return { ...createSearchState(), ...(raw && typeof raw === 'object' ? raw : {}) };
}

function resolvedColor(value, fallback) {
  const parsed = parseColor(String(value ?? ''));
  return 'error' in parsed ? parseColor(fallback) : parsed;
}

/**
 * Refuses an appearance override that would make a required disclosure
 * unreadable: too little contrast, or text below the readable floor.
 */
function guardAppearanceOverride(elementId, property, value) {
  if (!APPEARANCE_PROPERTIES.includes(property)) {
    return { ok: false, reason: `"${property}" is not one of the overridable appearance properties.` };
  }
  if (!PROTECTED_DISCLOSURE_ELEMENTS.has(elementId)) return { ok: true };
  if (property === '--element-font-size') {
    const pixels = Number.parseFloat(String(value));
    if (!Number.isFinite(pixels) || (String(value).includes('px') && pixels < MIN_DISCLOSURE_FONT_PX)) {
      return { ok: false, reason: `This element carries a required disclosure, so its text stays at least ${MIN_DISCLOSURE_FONT_PX} pixels.` };
    }
  }
  if (property === '--element-on-surface' || property === '--element-surface') {
    const current = preferences.appearance()[elementId] || {};
    const foreground = resolvedColor(property === '--element-on-surface' ? value : current['--element-on-surface'], '#1b1b1f');
    const background = resolvedColor(property === '--element-surface' ? value : current['--element-surface'], '#fdfbff');
    if ('error' in foreground || 'error' in background) {
      return { ok: false, reason: 'That colour could not be read, so the override was refused.' };
    }
    const ratio = contrastRatio(foreground, background);
    if (ratio < MIN_DISCLOSURE_CONTRAST) {
      return { ok: false, reason: `This element carries a required disclosure. The requested colours reach ${ratio.toFixed(2)} to 1, below the ${MIN_DISCLOSURE_CONTRAST} to 1 minimum.` };
    }
  }
  return { ok: true };
}

function applyIdentityToWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setTitle(resolveDisplayName(preferences.preferences(), APP_NAME));
}

/** The composed record the settings and appearance surfaces render. */
function settingsSnapshot() {
  const snapshot = preferences.snapshot();
  return {
    ...snapshot,
    identity: {
      displayName: snapshot.preferences.displayName,
      resolvedName: resolveDisplayName(snapshot.preferences, APP_NAME),
      shippedName: APP_NAME,
      logo: snapshot.preferences.logo,
      presentationOnly:
        `Renaming is presentation only. The package name, the .${PROJECT_EXTENSION} extension, the file-dialog filter labels and the application data location are unchanged, so a renamed application still opens the same project files.`,
    },
    vocabularyStatus: vocabulary.status(),
    lockRecords: locks.list(),
    lockDisclosure: locks.disclosure(),
    authenticator: authenticator.status(),
    schedule: scheduleSettings.evaluate(snapshot.preferences, snapshot.schedules),
    schedulableTargets: scheduleSettings.SCHEDULABLE_TARGETS,
    appearanceProperties: APPEARANCE_PROPERTIES,
    protectedElements: [...PROTECTED_DISCLOSURE_ELEMENTS],
  };
}

function addAttachmentFromPath(selectedPath) {
  const active = ensureSession();
  const stat = fs.statSync(selectedPath);
  if (!stat.isFile() || stat.size < 1 || stat.size > MAX_ATTACHMENT_BYTES) throw new Error('Choose a regular file between 1 byte and 96 MB.');
  const attachmentId = crypto.randomUUID();
  const bytes = fs.readFileSync(selectedPath);
  // Measured over the plaintext that was actually taken in, so a transfer
  // surface can name a digest the person can reproduce from the source file.
  let sha256;
  try {
    sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    const encrypted = encryptAttachment(active.dataKey, attachmentId, bytes);
    atomicWrite(path.join(active.projectRoot, 'attachments', `${attachmentId}.enc`), encrypted);
  } finally { bytes.fill(0); }
  const nextState = clone(active.state);
  nextState.attachments.push({ id: attachmentId, displayName: path.basename(selectedPath), bytes: stat.size, addedAt: new Date().toISOString(), parserConfirmed: false });
  validateStateShape(nextState, active.metadata, active.projectRoot);
  const revision = active.history.transact({ action: 'attachment-add', stableId: `attachment:${attachmentId}`, summary: 'Added an encrypted local attachment for manual parser confirmation', state: nextState });
  active.state = nextState;
  persistSession();
  return { state: clone(active.state), revision, bytes: stat.size, sha256 };
}

/**
 * Builds a transfer pre-flight plan. Every destination is chosen here, before
 * any bytes are written, so the Start surface can name the source, the exact
 * destination, the expected size and the unsigned status.
 */
async function planTransfer(request) {
  const kind = String(request?.kind || '');
  if (kind === 'project-save') {
    const active = ensureSession();
    let expectedBytes = null;
    try { expectedBytes = fs.statSync(active.filePath).size; } catch { expectedBytes = null; }
    return transfers.plan({ kind, sourceDescription: 'The open project in application-private storage', destinationPath: active.filePath, expectedBytes });
  }
  if (kind === 'project-save-copy' || kind === 'project-import-copy') {
    const selected = await dialog.showSaveDialog(mainWindow, {
      title: kind === 'project-save-copy' ? 'Save encrypted project copy' : 'Create validated project copy',
      defaultPath: `tax-report-copy.${PROJECT_EXTENSION}`,
      filters: [{ name: 'Material Tax Reporting project', extensions: [PROJECT_EXTENSION] }],
    });
    if (selected.canceled || !selected.filePath) return { cancelled: true };
    let expectedBytes = null;
    if (kind === 'project-save-copy' && session) {
      try { expectedBytes = fs.statSync(session.filePath).size; } catch { expectedBytes = null; }
    }
    return transfers.plan({
      kind,
      sourceDescription: kind === 'project-save-copy' ? 'The open project in application-private storage' : 'The validated project preview',
      destinationPath: ensureProjectFilePath(selected.filePath),
      expectedBytes,
    });
  }
  if (kind === 'attachment-intake') {
    const selected = await dialog.showOpenDialog(mainWindow, { title: 'Attach a local tax document', properties: ['openFile'] });
    if (selected.canceled || selected.filePaths.length !== 1) return { cancelled: true };
    const chosen = selected.filePaths[0];
    let expectedBytes = null;
    try { expectedBytes = fs.statSync(chosen).size; } catch { expectedBytes = null; }
    const planned = transfers.plan({ kind, sourceDescription: path.basename(chosen), destinationPath: null, expectedBytes });
    planned.plan.sourcePath = chosen;
    planned.plan.destinationName = 'Encrypted attachment inside the open project';
    return planned;
  }
  if (kind === 'converter-output') {
    const selected = await dialog.showOpenDialog(mainWindow, { title: 'Choose a destination folder for converted files', properties: ['openDirectory', 'createDirectory'] });
    if (selected.canceled || selected.filePaths.length !== 1) return { cancelled: true };
    const planned = transfers.plan({ kind, sourceDescription: 'Files staged for conversion', destinationPath: selected.filePaths[0], expectedBytes: null });
    planned.plan.jobId = String(request?.jobId || '');
    return planned;
  }
  if (kind === 'export') {
    const built = buildExport({ ...request.export, surface: APP_NAME });
    const selected = await dialog.showSaveDialog(mainWindow, { title: 'Save export', defaultPath: built.fileName });
    if (selected.canceled || !selected.filePath) return { cancelled: true };
    const planned = transfers.plan({
      kind,
      sourceDescription: `${built.manifest.rowCount} row${built.manifest.rowCount === 1 ? '' : 's'} from ${built.manifest.collection}`,
      destinationPath: selected.filePath,
      expectedBytes: Buffer.byteLength(built.body, 'utf8'),
    });
    planned.plan.manifest = built.manifest;
    planned.plan.identityIncluded = built.identityIncluded;
    planned.body = built.body;
    transfers.get(planned.plan.transferId).body = built.body;
    return { plan: planned.plan, state: planned.state, description: planned.description };
  }
  throw new Error('That transfer kind is not one this application performs.');
}

/** Performs a confirmed transfer, reporting progress and honest completion. */
async function commitTransfer(request) {
  const transferId = String(request?.transferId || '');
  const entry = transfers.get(transferId);
  const kind = entry.plan.kind;
  transfers.confirm(transferId);
  try {
    if (kind === 'project-save' || kind === 'project-save-copy') {
      const active = ensureSession();
      const progress = {
        signal: transfers.signal(transferId),
        onSize: (size) => transfers.begin(transferId, size),
        onBytes: (written) => transfers.report(transferId, written),
        onTemporaryPath: (cleanup) => transfers.registerCleanup(transferId, cleanup),
      };
      if (kind === 'project-save') {
        const result = persistSession(progress);
        const finished = transfers.finish(transferId, result.bytes, result.sha256);
        return { kind, finished, status: result.status, path: entry.plan.destinationPath, bytes: result.bytes, sha256: result.sha256 };
      }
      const destination = entry.plan.destinationPath;
      if (fs.existsSync(destination)) throw new Error('Choose a new file name; Save copy never overwrites.');
      const portableKey = createPortableKey(active.dataKey, String(request?.password || ''));
      const result = saveBundle({ projectRoot: active.projectRoot, destinationPath: destination, dataKey: active.dataKey, metadata: active.metadata, portableKey, progress });
      const finished = transfers.finish(transferId, result.bytes, result.sha256);
      return { kind, finished, path: destination, bytes: result.bytes, sha256: result.sha256 };
    }
    if (kind === 'attachment-intake') {
      transfers.begin(transferId, entry.plan.expectedBytes);
      const result = addAttachmentFromPath(entry.plan.sourcePath);
      transfers.report(transferId, result.bytes);
      const finished = transfers.finish(transferId, result.bytes, result.sha256);
      return { kind, finished, state: result.state, revision: result.revision, bytes: result.bytes, sha256: result.sha256 };
    }
    if (kind === 'converter-output') {
      // The output size is not knowable before the conversion runs, so the
      // total stays unknown and the surface reports bytes actually written.
      transfers.begin(transferId, null);
      const outcome = await converter.run(entry.plan.jobId, entry.plan.destinationPath, {
        signal: transfers.signal(transferId),
        onBytes: (written) => transfers.report(transferId, written),
      });
      const finished = outcome.bytes > 0
        ? transfers.finish(transferId, outcome.bytes, outcome.sha256)
        : transfers.fail(transferId, outcome.cancelled ? 'The conversion was cancelled, so nothing was written.' : 'No file was converted, so nothing was written.');
      recordAppAction('conversion', `Converted ${outcome.succeeded} file(s) with ${outcome.adapterId}`);
      return {
        kind,
        finished,
        outcome,
        folder: entry.plan.destinationPath,
        bytes: outcome.bytes,
        sha256: outcome.sha256,
        batchSha256: outcome.batchSha256,
        digestScope: outcome.digestScope,
      };
    }
    if (kind === 'export') {
      const body = entry.body;
      if (typeof body !== 'string') throw new Error('The export body is no longer available. Build the export again.');
      transfers.begin(transferId, Buffer.byteLength(body, 'utf8'));
      const written = writeExport(entry.plan.destinationPath, body);
      transfers.report(transferId, written.bytes);
      const finished = transfers.finish(transferId, written.bytes, crypto.createHash('sha256').update(body, 'utf8').digest('hex'));
      recordAppAction('export', `Exported ${entry.plan.manifest?.rowCount ?? 0} row(s) from ${entry.plan.manifest?.collection ?? 'a local collection'}`);
      return { kind, finished, path: written.path, fileName: written.fileName, bytes: written.bytes, manifest: entry.plan.manifest };
    }
    if (kind === 'project-import-copy') {
      // This step only chooses where the copy will go. The container itself is
      // written when the import is activated, and that write reports its own
      // measured size and digest, so nothing is claimed as transferred here.
      const notice = 'The destination was chosen. No bytes have been written yet; the encrypted copy is written when the import is activated.';
      const withdrawn = transfers.withdraw(transferId, notice);
      return { kind, destinationPath: entry.plan.destinationPath, plannedOnly: true, bytes: 0, notice, finished: withdrawn };
    }
    throw new Error('That transfer kind is not one this application performs.');
  } catch (error) {
    transfers.fail(transferId, error instanceof Error ? error.message : 'The transfer did not complete.');
    throw error;
  }
}

function registerIpc() {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => { if (mainWindow) mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('ocr:runtime-status', () => resolveOfflineOcrRuntime());

  ipcMain.handle('project:status', () => serializeSessionStatus());
  ipcMain.handle('project:create', async (_event, request) => {
    const selected = await dialog.showSaveDialog(mainWindow, {
      title: 'Create encrypted tax report project',
      defaultPath: `tax-report-${request.taxYear || ''}.${PROJECT_EXTENSION}`,
      filters: [{ name: 'Material Tax Reporting project', extensions: [PROJECT_EXTENSION] }],
    });
    if (selected.canceled || !selected.filePath) return { ok: false, error: { code: 'CANCELLED', message: 'Project creation was cancelled.', recovery: 'Choose Create project when ready.' } };
    return envelope(() => {
      if (!Number.isInteger(request.taxYear) || request.taxYear < 2025 || request.taxYear > 2100) throw new Error('Choose a supported tax year.');
      const filePath = ensureProjectFilePath(selected.filePath);
      if (fs.existsSync(filePath)) throw new Error('Choose a new file name; an existing project is never overwritten during creation.');
      closeSession();
      const instanceId = crypto.randomUUID();
      const projectId = crypto.randomUUID();
      const projectRoot = projectRootFor(instanceId);
      const dataKey = crypto.randomBytes(32);
      const portableKey = createPortableKey(dataKey, request.password);
      try {
        fs.mkdirSync(path.join(projectRoot, 'attachments'), { recursive: true });
        vault.put(instanceId, dataKey);
        const state = initialState(request.taxYear);
        const history = new HistoryStore({ repositoryPath: path.join(projectRoot, 'history'), projectId, dataKey });
        history.initialize(state);
        const metadata = metadataFor(projectId, request.taxYear, history.currentRevisionId(), state);
        storeProjectMetadata(projectRoot, metadata, portableKey);
        session = createProjectSession({ instanceId, projectRoot, filePath, dataKey, portableKey, metadata, history, state });
        persistSession();
        return { state: clone(state), status: serializeSessionStatus() };
      } catch (error) {
        dataKey.fill(0); vault.remove(instanceId); fs.rmSync(projectRoot, { recursive: true, force: true });
        throw error;
      }
    }, { code: 'PROJECT_CREATE_FAILED', message: 'The encrypted project was not created.', recovery: 'Choose a new destination and retry with a password of at least 12 characters.' });
  });

  ipcMain.handle('project:preview-import', async (_event, request) => {
    const selected = await dialog.showOpenDialog(mainWindow, { title: 'Preview encrypted tax report project', properties: ['openFile'], filters: [{ name: 'Material Tax Reporting project', extensions: [PROJECT_EXTENSION] }] });
    if (selected.canceled || selected.filePaths.length !== 1) return { ok: false, error: { code: 'CANCELLED', message: 'Project import was cancelled.', recovery: 'The open project is unchanged.' } };
    discardPendingImport();
    try {
      request.password = String(request.password || '');
      pendingImport = readBundle({ sourcePath: selected.filePaths[0], password: request.password });
      const previewHistory = new HistoryStore({
        repositoryPath: path.join(pendingImport.projectRoot, 'history'),
        projectId: pendingImport.metadata.projectId,
        dataKey: pendingImport.dataKey,
      });
      let previewState;
      try {
        if (previewHistory.currentRevisionId() !== pendingImport.metadata.currentRevisionId) throw new Error('The project metadata does not identify the embedded current revision.');
        previewState = previewHistory.load();
        validateStateShape(previewState, pendingImport.metadata, pendingImport.projectRoot, { verifyAttachments: true, dataKey: pendingImport.dataKey });
      } finally { previewHistory.dispose(); }
      const sameProject = Boolean(session && session.metadata.projectId === pendingImport.metadata.projectId);
      const sameKey = Boolean(session && crypto.timingSafeEqual(session.dataKey, pendingImport.dataKey));
      return { ok: true, data: {
        previewToken: crypto.createHash('sha256').update(`${pendingImport.metadata.projectId}\0${pendingImport.historyHead}`).digest('hex'),
        projectFileName: path.basename(selected.filePaths[0]),
        taxYear: pendingImport.metadata.taxYear,
        historyHead: pendingImport.historyHead,
        currentRevisionId: pendingImport.metadata.currentRevisionId,
        attachmentCount: previewState.attachments.length,
        pdfReview: pendingImport.metadata.pdfReview,
        choices: {
          createCopy: { enabled: true, explanation: 'Create a separate local instance and choose a new project file.' },
          reconcile: { enabled: sameProject && sameKey, explanation: sameProject && sameKey ? 'Preserve both complete histories and create a reconciliation commit.' : 'Reconcile requires another copy of the currently open encrypted project.' },
          replace: { enabled: Boolean(session), explanation: session ? 'Replace the open local instance only after explicit confirmation.' : 'Open a local project before choosing Replace.' },
        },
      } };
    } catch (error) {
      discardPendingImport();
      return { ok: false, error: publicError(error, { code: 'PROJECT_IMPORT_FAILED', message: 'The project could not be validated.', recovery: 'Check the password and choose an unchanged project file.' }) };
    } finally { request.password = null; }
  });

  ipcMain.handle('project:activate-import', async (_event, request) => {
    let selectedCopyPath = null;
    // A confirmed transfer plan may already carry the chosen destination, so
    // the person is not asked for the same path twice.
    if (request.strategy === 'create-copy' && typeof request.destinationPath === 'string' && request.destinationPath.length > 0) {
      selectedCopyPath = ensureProjectFilePath(request.destinationPath);
    } else if (request.strategy === 'create-copy') {
      const selected = await dialog.showSaveDialog(mainWindow, {
        title: 'Create validated project copy',
        defaultPath: `tax-report-copy.${PROJECT_EXTENSION}`,
        filters: [{ name: 'Material Tax Reporting project', extensions: [PROJECT_EXTENSION] }],
      });
      if (selected.canceled || !selected.filePath) return { ok: false, error: { code: 'CANCELLED', message: 'Project copy creation was cancelled.', recovery: 'The validated preview remains available.' } };
      selectedCopyPath = ensureProjectFilePath(selected.filePath);
    }
    return envelope(() => {
    if (!pendingImport) throw new Error('Preview the project before choosing an import action.');
    if (request.strategy === 'reconcile') {
      const result = reconcileImport(); discardPendingImport(); return result;
    }
    if (request.strategy !== 'create-copy' && request.strategy !== 'replace') throw new Error('Choose Create copy, Reconcile, or Replace.');
    if (request.strategy === 'replace' && request.confirmation !== 'REPLACE LOCAL PROJECT') throw new Error('Type REPLACE LOCAL PROJECT to confirm replacement.');
    let destinationPath = pendingImport.sourcePath;
    if (request.strategy === 'create-copy') {
      destinationPath = selectedCopyPath;
      if (fs.existsSync(destinationPath)) throw new Error('The project copy destination already exists.');
    }
    const next = importedSession({ filePath: destinationPath, strategy: request.strategy });
    if (request.strategy === 'replace') closeSession();
    else if (session) closeSession();
    session = next;
    persistSession();
    discardPendingImport();
    return { state: clone(session.state), status: serializeSessionStatus() };
    }, { code: 'PROJECT_IMPORT_ACTIVATION_FAILED', message: 'The validated project was not activated.', recovery: 'The existing project remains available; preview the file again and choose another action.' });
  });

  ipcMain.handle('project:discard-preview', () => { discardPendingImport(); return { ok: true, data: {} }; });
  ipcMain.handle('project:save', () => envelope(() => persistSession(), { code: 'PROJECT_SAVE_FAILED', message: 'The project file was not replaced.', recovery: 'Keep the application open and retry Save.' }));
  ipcMain.handle('project:save-copy', async (_event, request) => {
    const selected = await dialog.showSaveDialog(mainWindow, { title: 'Save encrypted project copy', defaultPath: `tax-report-copy.${PROJECT_EXTENSION}`, filters: [{ name: 'Material Tax Reporting project', extensions: [PROJECT_EXTENSION] }] });
    if (selected.canceled || !selected.filePath) return { ok: false, error: { code: 'CANCELLED', message: 'Save copy was cancelled.', recovery: 'The current project is unchanged.' } };
    return envelope(() => {
      const active = ensureSession();
      const destination = ensureProjectFilePath(selected.filePath);
      if (fs.existsSync(destination)) throw new Error('Choose a new file name; Save copy never overwrites.');
      const portableKey = createPortableKey(active.dataKey, request.password);
      request.password = null;
      return saveBundle({ projectRoot: active.projectRoot, destinationPath: destination, dataKey: active.dataKey, metadata: active.metadata, portableKey });
    }, { code: 'PROJECT_COPY_FAILED', message: 'The encrypted project copy was not created.', recovery: 'Choose a new destination and retry with a password of at least 12 characters.' });
  });
  ipcMain.handle('project:close', () => envelope(() => { persistSession(); closeSession(); return { status: serializeSessionStatus() }; }, { code: 'PROJECT_CLOSE_FAILED', message: 'The project could not be saved and closed.', recovery: 'Keep the application open and retry Save.' }));

  ipcMain.handle('state:load', () => session ? { ok: true, data: { state: clone(session.state), status: serializeSessionStatus() } } : { ok: true, data: { state: null, status: serializeSessionStatus() } });
  ipcMain.handle('state:mutate', (_event, request) => envelope(() => mutateField(request), { code: 'ANSWER_NOT_SAVED', message: 'The answer was not recorded.', recovery: 'The previous project revision is unchanged; correct the answer and retry.' }));

  ipcMain.handle('attachment:add', async () => {
    const selected = await dialog.showOpenDialog(mainWindow, { title: 'Attach a local tax document', properties: ['openFile'] });
    if (selected.canceled || selected.filePaths.length !== 1) return { ok: false, error: { code: 'CANCELLED', message: 'No attachment was added.', recovery: 'Choose Add document when ready.' } };
    return envelope(() => addAttachmentFromPath(selected.filePaths[0]), { code: 'ATTACHMENT_NOT_ADDED', message: 'The document was not attached.', recovery: 'The project remains unchanged; choose a smaller local file and retry.' });
  });

  ipcMain.handle('attachment:confirm', (_event, attachmentId) => envelope(() => {
    const active = ensureSession();
    const nextState = clone(active.state);
    const attachment = nextState.attachments.find((entry) => entry.id === attachmentId);
    if (!attachment) throw new Error('The attachment no longer exists.');
    if (attachment.parserConfirmed) return { state: clone(active.state), unchanged: true };
    attachment.parserConfirmed = true;
    const confirmedAt = new Date().toISOString();
    active.metadata.parserConfirmations.push({ attachmentId, parserId: 'manual-confirmation-v1', confirmedAt });
    validateStateShape(nextState, active.metadata, active.projectRoot);
    const revision = active.history.transact({ action: 'answer', stableId: `parser-confirmation:${attachmentId}`, summary: 'Confirmed parsed attachment values after manual review', state: nextState });
    active.state = nextState; persistSession();
    return { state: clone(active.state), revision };
  }, { code: 'PARSER_CONFIRMATION_NOT_SAVED', message: 'The parser confirmation was not saved.', recovery: 'Review the attachment again and retry confirmation.' }));

  ipcMain.handle('attachment:remove', (_event, attachmentId) => envelope(() => {
    const active = ensureSession();
    const nextState = clone(active.state);
    const index = nextState.attachments.findIndex((entry) => entry.id === attachmentId);
    if (index < 0) throw new Error('The attachment no longer exists.');
    nextState.attachments.splice(index, 1);
    const revision = active.history.transact({ action: 'attachment-remove', stableId: `attachment:${attachmentId}`, summary: 'Removed an encrypted local attachment', state: nextState });
    active.metadata.parserConfirmations = active.metadata.parserConfirmations.filter((entry) => entry.attachmentId !== attachmentId);
    validateStateShape(nextState, active.metadata, active.projectRoot);
    active.state = nextState; persistSession();
    return { state: clone(active.state), revision };
  }, { code: 'ATTACHMENT_NOT_REMOVED', message: 'The attachment was not removed.', recovery: 'The project remains open; retry removal.' }));

  ipcMain.handle('history:query', (_event, filters) => envelope(() => ensureSession().history.query(filters || {}), { code: 'HISTORY_QUERY_FAILED', message: 'Local history could not be listed.' }));
  ipcMain.handle('history:diff', (_event, from, to) => envelope(() => ensureSession().history.diff(from, to), { code: 'HISTORY_DIFF_FAILED', message: 'The selected revision difference could not be read.' }));
  ipcMain.handle('history:restore', (_event, revisionId) => envelope(() => {
    const active = ensureSession(); const result = active.history.restore(revisionId); synchronizeParserConfirmations(active, result.state); validateStateShape(result.state, active.metadata, active.projectRoot); active.state = result.state; persistSession(); return { result, state: clone(active.state), status: serializeSessionStatus() };
  }, { code: 'HISTORY_RESTORE_FAILED', message: 'The revision was not restored.', recovery: 'The current revision is unchanged; choose another revision or retry.' }));
  ipcMain.handle('history:undo', () => envelope(() => {
    const active = ensureSession(); const result = active.history.undo(); synchronizeParserConfirmations(active, result.state); validateStateShape(result.state, active.metadata, active.projectRoot); active.state = result.state; persistSession(); return { result, state: clone(active.state), status: serializeSessionStatus() };
  }, { code: 'HISTORY_UNDO_FAILED', message: 'The previous revision was not restored.', recovery: 'The current revision is unchanged.' }));
  ipcMain.handle('history:label', (_event, revisionId, label) => envelope(() => { const active = ensureSession(); const result = active.history.label(revisionId, label); persistSession(); return result; }, { code: 'HISTORY_LABEL_FAILED', message: 'The revision label was not saved.' }));
  ipcMain.handle('history:verify', () => envelope(() => ensureSession().history.verify(), { code: 'HISTORY_VERIFY_FAILED', message: 'The local Git history did not pass object-graph validation.', recovery: 'Keep the project open and use an earlier validated project copy.' }));

  // --- Settings, appearance and identity ----------------------------------

  ipcMain.handle('settings:load', () => envelope(() => settingsSnapshot(), { code: 'SETTINGS_LOAD_FAILED', message: 'The local settings record could not be read.', recovery: 'The shipped defaults are in use; change a setting to write a new record.' }));
  ipcMain.handle('settings:update', (_event, request) => envelope(() => {
    if (request && typeof request.preferences === 'object' && request.preferences !== null) {
      preferences.updatePreferences(request.preferences);
      recordAppAction('preference-change', `Changed the application preferences: ${Object.keys(request.preferences).join(', ')}`);
      applyIdentityToWindow();
    }
    if (Array.isArray(request?.appearance)) {
      let store = preferences.appearance();
      const refused = [];
      for (const change of request.appearance.slice(0, 60)) {
        const elementId = String(change?.elementId || '');
        const property = String(change?.property || '');
        const value = String(change?.value ?? '');
        const verdict = guardAppearanceOverride(elementId, property, value);
        if (!verdict.ok) { refused.push({ elementId, property, reason: verdict.reason }); continue; }
        store = setAppearanceProperty(store, elementId, property, value);
      }
      preferences.writeAppearance(store);
      recordAppAction('appearance-change', `Changed ${request.appearance.length} appearance override(s)`);
      return { ...settingsSnapshot(), refused };
    }
    return settingsSnapshot();
  }, { code: 'SETTINGS_NOT_SAVED', message: 'The setting was not saved.', recovery: 'The previous value is unchanged; correct the value and retry.' }));

  ipcMain.handle('settings:reset-appearance', (_event, request) => envelope(() => {
    let store = preferences.appearance();
    const elementId = String(request?.elementId || '');
    if (request?.property) {
      const current = { ...(store[elementId] || {}) };
      delete current[String(request.property)];
      store = { ...store, [elementId]: current };
      if (Object.keys(current).length === 0) delete store[elementId];
    } else if (elementId) {
      store = { ...store };
      delete store[elementId];
    } else {
      store = {};
    }
    preferences.writeAppearance(store);
    recordAppAction('appearance-reset', elementId ? `Reset appearance overrides for ${elementId}` : 'Reset every appearance override');
    return settingsSnapshot();
  }, { code: 'APPEARANCE_NOT_RESET', message: 'The appearance override was not reset.' }));

  ipcMain.handle('settings:export-preset', async (_event, request) => {
    const selected = await dialog.showSaveDialog(mainWindow, { title: 'Save appearance preset', defaultPath: 'appearance-preset.json', filters: [{ name: 'Appearance preset', extensions: ['json'] }] });
    if (selected.canceled || !selected.filePath) return { ok: false, error: { code: 'CANCELLED', message: 'The preset was not saved.', recovery: 'Choose Export preset when ready.' } };
    return envelope(() => {
      const body = exportAppearancePreset(preferences.appearance(), String(request?.name || 'Appearance preset'));
      atomicWrite(path.resolve(selected.filePath), Buffer.from(body, 'utf8'));
      return { fileName: path.basename(selected.filePath), bytes: Buffer.byteLength(body, 'utf8') };
    }, { code: 'PRESET_NOT_SAVED', message: 'The appearance preset was not written.' });
  });

  ipcMain.handle('settings:import-preset', async () => {
    const selected = await dialog.showOpenDialog(mainWindow, { title: 'Choose an appearance preset', properties: ['openFile'], filters: [{ name: 'Appearance preset', extensions: ['json'] }] });
    if (selected.canceled || selected.filePaths.length !== 1) return { ok: false, error: { code: 'CANCELLED', message: 'No preset was imported.', recovery: 'The current appearance is unchanged.' } };
    return envelope(() => {
      const raw = fs.readFileSync(selected.filePaths[0], 'utf8');
      const verdict = importAppearancePreset(raw);
      if (!verdict.ok) throw new Error(verdict.reason);
      let store = preferences.appearance();
      const refused = [];
      for (const [elementId, propertyMap] of Object.entries(verdict.store)) {
        for (const [property, value] of Object.entries(propertyMap)) {
          const guard = guardAppearanceOverride(elementId, property, value);
          if (!guard.ok) { refused.push({ elementId, property, reason: guard.reason }); continue; }
          store = setAppearanceProperty(store, elementId, property, value);
        }
      }
      preferences.writeAppearance(store);
      recordAppAction('appearance-change', 'Imported an appearance preset');
      return { ...settingsSnapshot(), refused };
    }, { code: 'PRESET_NOT_IMPORTED', message: 'The appearance preset was not accepted.', recovery: 'The current appearance is unchanged.' });
  });

  ipcMain.handle('settings:save-tabs', (_event, request) => envelope(() => preferences.writeTabs(request), { code: 'TABS_NOT_SAVED', message: 'The tab layout was not saved.' }));

  ipcMain.handle('logo:choose', async () => {
    const selected = await dialog.showOpenDialog(mainWindow, { title: 'Choose a logo image', properties: ['openFile'], filters: [{ name: 'Raster image', extensions: ['png', 'jpg', 'jpeg'] }] });
    if (selected.canceled || selected.filePaths.length !== 1) return { ok: false, error: { code: 'CANCELLED', message: 'No image was chosen.', recovery: 'The current logo is unchanged.' } };
    const chosen = selected.filePaths[0];
    try {
      const stat = fs.statSync(chosen);
      const declaredType = path.extname(chosen).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
      const bytes = fs.readFileSync(chosen);
      const verdict = await validateLogoUpload(
        { name: path.basename(chosen), byteLength: stat.size, read: async () => new Uint8Array(bytes) },
        declaredType,
      );
      if (!verdict.ok) throw new Error(verdict.reason);
      // The declared byte cap is enforced by the kernel; the pixel cap is a
      // presentation limit enforced here, where the header can be read.
      if (declaredType === 'image/png' && bytes.length > 24) {
        const width = bytes.readUInt32BE(16);
        const height = bytes.readUInt32BE(20);
        if (width > MAX_LOGO_DIMENSION || height > MAX_LOGO_DIMENSION) {
          throw new Error(`Choose an image no larger than ${MAX_LOGO_DIMENSION} by ${MAX_LOGO_DIMENSION} pixels.`);
        }
      }
      preferences.updatePreferences({ logo: { kind: 'local', dataUrl: `data:${verdict.type};base64,${bytes.toString('base64')}` } });
      recordAppAction('identity-change', 'Changed the application logo to a locally chosen image');
      return { ok: true, data: settingsSnapshot() };
    } catch (error) {
      return { ok: false, error: publicError(error, { code: 'LOGO_NOT_ACCEPTED', message: 'The image was not accepted as a logo.', recovery: 'Choose a PNG or JPEG image no larger than 256 KB.' }) };
    }
  });

  // --- Personal vocabulary -------------------------------------------------

  ipcMain.handle('vocabulary:status', () => envelope(() => vocabulary.status(), { code: 'VOCABULARY_STATUS_FAILED', message: 'The vocabulary status could not be read.' }));
  ipcMain.handle('vocabulary:choose', async () => {
    const selected = await dialog.showOpenDialog(mainWindow, { title: 'Choose a personal vocabulary file', properties: ['openFile'], filters: [{ name: 'Vocabulary document', extensions: ['json'] }] });
    if (selected.canceled || selected.filePaths.length !== 1) return { ok: false, error: { code: 'CANCELLED', message: 'No vocabulary file was chosen.', recovery: 'The current wording is unchanged.' } };
    return envelope(() => {
      const raw = fs.readFileSync(selected.filePaths[0], 'utf8');
      const result = vocabulary.accept(raw, path.basename(selected.filePaths[0]));
      if (!result.ok) throw new Error(result.reason);
      recordAppAction('vocabulary-import', `Accepted a personal vocabulary file with ${result.entryCount} replacement(s)`);
      return result.status;
    }, { code: 'VOCABULARY_NOT_ACCEPTED', message: 'The vocabulary file was not accepted.', recovery: 'The wording already in use is unchanged.' });
  });
  ipcMain.handle('vocabulary:clear', () => envelope(() => {
    const status = vocabulary.clear();
    recordAppAction('vocabulary-clear', 'Removed the accepted personal vocabulary');
    return status;
  }, { code: 'VOCABULARY_NOT_CLEARED', message: 'The vocabulary was not removed.' }));
  ipcMain.handle('vocabulary:shared-mode', (_event, request) => envelope(() => vocabulary.setSharedMode(request?.active === true, request?.name), { code: 'SHARED_MODE_NOT_CHANGED', message: 'The shared mode was not changed.' }));

  // --- Schedules and external presentation settings ------------------------

  ipcMain.handle('schedule:evaluate', () => envelope(() => scheduleSettings.evaluate(preferences.preferences(), preferences.schedules()), { code: 'SCHEDULE_EVALUATION_FAILED', message: 'The schedule could not be evaluated.' }));
  ipcMain.handle('schedule:save', (_event, request) => envelope(() => {
    const saved = preferences.writeSchedules(request);
    recordAppAction('schedule-change', 'Changed the presentation schedule rules');
    const evaluated = scheduleSettings.evaluate(preferences.preferences(), saved);
    sendToRenderer('schedule:applied', evaluated);
    return { schedules: saved, schedule: evaluated };
  }, { code: 'SCHEDULE_NOT_SAVED', message: 'The schedule was not saved.', recovery: 'The previous rules are unchanged.' }));
  ipcMain.handle('schedule:read-external', async () => {
    try {
      const outcome = await scheduleSettings.readExternalSettings(preferences.schedules());
      const schedules = preferences.schedules();
      preferences.writeSchedules({
        ...schedules,
        external: { ...schedules.external, lastReceivedAt: new Date().toISOString(), lastVerdict: outcome.message, lastValues: outcome.values },
      });
      return { ok: true, data: outcome };
    } catch {
      return { ok: false, error: { code: 'EXTERNAL_SETTINGS_FAILED', message: 'The external presentation settings could not be read.', recovery: 'The last applied local value stays in force.' } };
    }
  });
  ipcMain.handle('schedule:apply-external', () => envelope(() => {
    const schedules = preferences.schedules();
    const values = schedules.external.lastValues;
    if (!values || Object.keys(values).length === 0) throw new Error('No validated external document is waiting to be applied.');
    const saved = preferences.writeSchedules({
      ...schedules,
      manualOverrides: { ...schedules.manualOverrides, ...values },
      external: { ...schedules.external, lastAppliedAt: new Date().toISOString() },
    });
    recordAppAction('schedule-change', 'Applied a validated external presentation-settings document');
    const evaluated = scheduleSettings.evaluate(preferences.preferences(), saved);
    sendToRenderer('schedule:applied', evaluated);
    return { schedules: saved, schedule: evaluated };
  }, { code: 'EXTERNAL_SETTINGS_NOT_APPLIED', message: 'The external document was not applied.', recovery: 'The last applied local value stays in force.' }));

  // --- File converter ------------------------------------------------------

  ipcMain.handle('converter:catalog', () => envelope(() => converter.catalog(), { code: 'CONVERTER_CATALOG_FAILED', message: 'The converter catalogue could not be read.' }));
  ipcMain.handle('converter:preview', async (_event, request) => {
    const selected = await dialog.showOpenDialog(mainWindow, { title: 'Choose files to convert', properties: ['openFile', 'multiSelections'] });
    if (selected.canceled || selected.filePaths.length === 0) return { ok: false, error: { code: 'CANCELLED', message: 'No files were chosen.', recovery: 'Choose Preview files when ready.' } };
    return envelope(() => converter.preview(selected.filePaths, String(request?.adapterId || '')), { code: 'CONVERTER_PREVIEW_FAILED', message: 'The chosen files could not be inspected.' });
  });
  ipcMain.handle('converter:run', async (_event, request) => {
    try {
      return { ok: true, data: await commitTransfer(request) };
    } catch (error) {
      return { ok: false, error: publicError(error, { code: 'CONVERSION_FAILED', message: 'The conversion did not complete.', recovery: 'No source file was changed; correct the reported reason and retry.' }) };
    }
  });
  ipcMain.handle('converter:cancel', (_event, jobId) => envelope(() => converter.cancel(String(jobId || '')), { code: 'CONVERSION_NOT_CANCELLED', message: 'The conversion could not be cancelled.' }));

  // --- Local model suite ---------------------------------------------------

  const ollamaEnvelope = async (work, fallback) => {
    try {
      await ollamaSuite.ensureInitialized();
      const data = await work();
      return { ok: true, data: { result: data ?? null, state: ollamaSuite.snapshot(), descriptors: ollamaSuite.descriptors() } };
    } catch (error) {
      return { ok: false, error: publicError(error, fallback) };
    }
  };
  ipcMain.handle('ollama:runtime-status', () => ollamaEnvelope(() => ollamaSuite.controller.refreshRuntime(), { code: 'OLLAMA_RUNTIME_UNKNOWN', message: 'The local runtime status could not be read.' }));
  ipcMain.handle('ollama:catalog-refresh', () => ollamaEnvelope(() => ollamaSuite.controller.refreshCatalog(), { code: 'OLLAMA_CATALOG_UNAVAILABLE', message: 'The official catalogue could not be refreshed.' }));
  ipcMain.handle('ollama:fit', (_event, reference) => ollamaEnvelope(async () => ollamaSuite.snapshot().fitByReference[String(reference || '')] ?? null, { code: 'OLLAMA_FIT_UNKNOWN', message: 'The hardware fit could not be assessed.' }));
  ipcMain.handle('ollama:cart-add', (_event, reference) => ollamaEnvelope(() => ollamaSuite.controller.addToCart(String(reference || '')), { code: 'OLLAMA_CART_REFUSED', message: 'That model could not be added to the reviewed batch.' }));
  ipcMain.handle('ollama:cart-commit', () => ollamaEnvelope(() => ollamaSuite.controller.commitCart(), { code: 'OLLAMA_CART_NOT_COMMITTED', message: 'The reviewed batch was not committed.' }));
  ipcMain.handle('ollama:queue-cancel', (_event, id) => ollamaEnvelope(() => ollamaSuite.controller.cancelPull(String(id || '')), { code: 'OLLAMA_QUEUE_NOT_CANCELLED', message: 'That queued download was not cancelled.' }));
  ipcMain.handle('ollama:chat-send', (_event, request) => ollamaEnvelope(() => ollamaSuite.controller.sendChat({
    model: String(request?.model || ''),
    systemPrompt: String(request?.systemPrompt || ''),
    content: String(request?.content || ''),
    attachments: Array.isArray(request?.attachments) ? request.attachments.slice(0, 4) : [],
    containsTaxData: request?.containsTaxData === true,
    reviewedTaxData: request?.reviewedTaxData === true,
  }), { code: 'OLLAMA_CHAT_FAILED', message: 'The local chat message was not sent.' }));
  ipcMain.handle('ollama:harness-preflight', (_event, request) => ollamaEnvelope(() => ollamaSuite.controller.previewHarness({
    profileId: String(request?.profileId || ''),
    executableId: String(request?.executableId || ''),
    workingDirectory: String(request?.workingDirectory || ''),
    model: String(request?.model || ''),
  }), { code: 'OLLAMA_HARNESS_PREFLIGHT_FAILED', message: 'The harness pre-flight did not complete.' }));
  ipcMain.handle('ollama:harness-launch', () => ollamaEnvelope(() => ollamaSuite.controller.launchHarness(), { code: 'OLLAMA_HARNESS_LAUNCH_FAILED', message: 'The harness did not launch.' }));
  ipcMain.handle('ollama:harness-rollback', () => ollamaEnvelope(() => ollamaSuite.controller.refreshHarnessSnapshots(), { code: 'OLLAMA_HARNESS_ROLLBACK_FAILED', message: 'The recorded snapshots could not be listed.' }));
  ipcMain.handle('ollama:harness-restore', (_event, snapshotId) => ollamaEnvelope(() => ollamaSuite.controller.restoreHarnessSnapshot(String(snapshotId || '')), { code: 'OLLAMA_HARNESS_RESTORE_FAILED', message: 'That snapshot was not restored.' }));
  ipcMain.handle('ollama:action', (_event, request) => ollamaEnvelope(async () => {
    const name = String(request?.name || '');
    const controller = ollamaSuite.controller;
    if (name === 'select-tab') return controller.selectTab(request.tab);
    if (name === 'set-search') return controller.setSearch(request.scope, request.patch || {});
    if (name === 'insert-token') return controller.insertSearchToken(request.scope, request.token);
    if (name === 'set-facets') return controller.setCatalogFacets(request.selection || {});
    if (name === 'enqueue-pull') return controller.enqueuePull(String(request.reference || ''));
    if (name === 'remove-from-cart') return controller.removeFromCart(String(request.reference || ''));
    if (name === 'clear-cart') return controller.clearCart();
    if (name === 'pause-queue') return controller.pauseQueue();
    if (name === 'resume-queue') return controller.resumeQueue();
    if (name === 'retry-pull') return controller.retryPull(String(request.id || ''));
    if (name === 'delete-model') {
      if (request.confirmationOne !== true || request.confirmationTwo !== true || request.completion !== 1) {
        throw new Error('Deleting a model needs two separate confirmations and the completion control.');
      }
      return controller.deleteModel(String(request.reference || ''));
    }
    if (name === 'deletion-warning') return ollamaSuite.deletionWarning(request.reference);
    if (name === 'copy-model') return controller.copyModel(String(request.source || ''), String(request.destination || ''));
    if (name === 'select-chat-model') return controller.selectChatModel(String(request.reference || ''));
    if (name === 'stop-chat') return controller.stopChat();
    if (name === 'select-profile') return controller.selectHarnessProfile(String(request.profileId || ''));
    if (name === 'refresh-executables') return controller.refreshHarnessExecutables();
    if (name === 'select-executable') return controller.selectHarnessExecutable(String(request.executableId || ''));
    if (name === 'select-harness-model') return controller.selectHarnessModel(String(request.reference || ''));
    if (name === 'choose-working-directory') return controller.chooseWorkingDirectory();
    if (name === 'apply-recovery') return ollamaSuite.applyRecovery(request.recovery);
    throw new Error('That local model action is not one this application exposes.');
  }, { code: 'OLLAMA_ACTION_FAILED', message: 'That local model action did not complete.' }));

  // --- Element locks -------------------------------------------------------

  ipcMain.handle('locks:list', () => envelope(() => ({ records: locks.list(), disclosure: locks.disclosure() }), { code: 'LOCKS_LIST_FAILED', message: 'The lock list could not be read.' }));
  ipcMain.handle('locks:create', async (_event, request) => {
    try {
      if (request?.credential === 'authenticator' && !(await authenticator.verify(request?.answer))) {
        return { ok: false, error: { code: 'LOCK_NOT_CREATED', message: 'That authenticator code was not accepted.', recovery: 'Enter the current code from the paired authenticator.' } };
      }
      const created = await locks.create(request || {});
      recordAppAction('lock-create', `Created a presentation lock on ${created.elementId}`);
      return { ok: true, data: { created, records: locks.list(), disclosure: locks.disclosure() } };
    } catch (error) {
      return { ok: false, error: publicError(error, { code: 'LOCK_NOT_CREATED', message: 'The lock was not created.', recovery: 'The element is unchanged.' }) };
    }
  });
  ipcMain.handle('locks:attempt', async (_event, request) => {
    try {
      const result = await locks.attempt(String(request?.id || ''), request?.answer);
      recordAppAction(result.ok ? 'lock-release' : 'lock-create', result.ok ? 'Unlocked a presentation lock for the grace period' : 'Recorded an unsuccessful presentation-lock attempt');
      return { ok: true, data: { ...result, records: locks.list() } };
    } catch (error) {
      return { ok: false, error: publicError(error, { code: 'LOCK_ATTEMPT_FAILED', message: 'The unlock attempt did not complete.' }) };
    }
  });
  ipcMain.handle('locks:release', (_event, id) => envelope(() => {
    const released = locks.release(String(id || ''));
    recordAppAction('lock-release', `Relocked ${released.elementId}`);
    return { released, records: locks.list() };
  }, { code: 'LOCK_NOT_RELEASED', message: 'The lock was not relocked.' }));
  ipcMain.handle('locks:reset', (_event, id) => envelope(() => {
    const reset = locks.reset(String(id || ''));
    recordAppAction('lock-release', `Reset and removed the presentation lock on ${reset.elementId}`);
    return { reset, records: locks.list() };
  }, { code: 'LOCK_NOT_RESET', message: 'The lock was not reset.' }));

  // --- Authenticator and support tickets ----------------------------------

  ipcMain.handle('totp:status', () => envelope(() => authenticator.status(), { code: 'AUTHENTICATOR_STATUS_FAILED', message: 'The authenticator status could not be read.' }));
  ipcMain.handle('totp:register', (_event, request) => envelope(() => authenticator.register(request?.account), { code: 'AUTHENTICATOR_NOT_REGISTERED', message: 'A pairing could not be generated.' }));
  ipcMain.handle('totp:confirm', async (_event, request) => {
    try {
      return { ok: true, data: await authenticator.confirm(request?.code) };
    } catch (error) {
      return { ok: false, error: publicError(error, { code: 'AUTHENTICATOR_NOT_CONFIRMED', message: 'The pairing was not confirmed.' }) };
    }
  });
  ipcMain.handle('totp:current', async () => {
    try {
      return { ok: true, data: await authenticator.current() };
    } catch (error) {
      return { ok: false, error: publicError(error, { code: 'AUTHENTICATOR_CODE_UNAVAILABLE', message: 'No current code is available.' }) };
    }
  });
  ipcMain.handle('totp:remove', () => envelope(() => authenticator.remove(), { code: 'AUTHENTICATOR_NOT_REMOVED', message: 'The pairing was not removed.' }));

  ipcMain.handle('tickets:list', (_event, request) => envelope(() => tickets.list(searchStateFrom(request?.search)), { code: 'TICKETS_LIST_FAILED', message: 'The local tickets could not be listed.' }));
  ipcMain.handle('tickets:create', (_event, request) => envelope(() => {
    const created = tickets.create(request || {});
    recordAppAction('ticket-create', 'Created a local support ticket');
    return created;
  }, { code: 'TICKET_NOT_CREATED', message: 'The ticket was not created.' }));
  ipcMain.handle('tickets:advance', (_event, request) => envelope(() => {
    const advanced = tickets.advance(String(request?.id || ''), String(request?.state || ''));
    recordAppAction('ticket-advance', `Moved a local support ticket to ${advanced.state}`);
    return advanced;
  }, { code: 'TICKET_NOT_ADVANCED', message: 'The ticket state was not changed.' }));
  ipcMain.handle('tickets:remove', (_event, id) => envelope(() => tickets.remove(String(id || '')), { code: 'TICKET_NOT_REMOVED', message: 'The ticket was not removed.' }));

  // --- Notification centre -------------------------------------------------

  ipcMain.handle('notifications:list', (_event, request) => envelope(() => notifications.list(request?.filter || {}, searchStateFrom(request?.search)), { code: 'NOTIFICATIONS_LIST_FAILED', message: 'The notification log could not be read.' }));
  ipcMain.handle('notifications:append', (_event, request) => envelope(() => {
    const entry = notifications.append(request || {});
    sendToRenderer('notification:push', entry);
    return entry;
  }, { code: 'NOTIFICATION_NOT_RECORDED', message: 'The notice was not recorded.' }));
  ipcMain.handle('notifications:update', (_event, action) => envelope(() => notifications.update(action), { code: 'NOTIFICATION_NOT_UPDATED', message: 'The notice was not updated.' }));
  ipcMain.handle('notifications:preview-scope', (_event, request) => envelope(() => notifications.previewScope(request?.selection, request?.filter || {}, searchStateFrom(request?.search)), { code: 'NOTIFICATION_SCOPE_FAILED', message: 'The bulk scope could not be resolved.' }));
  ipcMain.handle('notifications:delete', (_event, request) => envelope(() => ({ removed: notifications.deleteScope(request?.ids) }), { code: 'NOTIFICATIONS_NOT_DELETED', message: 'The selected notices were not removed.' }));

  // --- Documentation and changelog ----------------------------------------

  ipcMain.handle('docs:list', () => envelope(() => docsLibrary.list(), { code: 'DOCS_LIST_FAILED', message: 'The packaged documentation could not be listed.' }));
  ipcMain.handle('docs:read', (_event, request) => envelope(() => docsLibrary.read(String(request?.area || ''), String(request?.slug || '')), { code: 'DOCS_READ_FAILED', message: 'That article could not be read.' }));
  ipcMain.handle('changelog:load', () => envelope(() => changelogLibrary.load(), { code: 'CHANGELOG_LOAD_FAILED', message: 'The packaged changelog record could not be read.' }));
  ipcMain.handle('changelog:open-commit', async (_event, request) => {
    const url = String(request?.url || '');
    if (request?.confirmed !== true) {
      return { ok: false, error: { code: 'CONFIRMATION_REQUIRED', message: 'Opening a commit link leaves this application.', recovery: 'Confirm that you want to open the link in your browser.' } };
    }
    if (!/^https:\/\/[^\s]+$/i.test(url)) {
      return { ok: false, error: { code: 'LINK_REFUSED', message: 'Only a complete https link can be opened.', recovery: 'The entry is shown exactly as generated; no link was opened.' } };
    }
    await shell.openExternal(url);
    return { ok: true, data: { opened: true } };
  });

  // --- Exports and handoff -------------------------------------------------

  ipcMain.handle('export:run', async (_event, request) => {
    try {
      const planned = await planTransfer({ kind: 'export', export: request });
      if (planned.cancelled) return { ok: false, error: { code: 'CANCELLED', message: 'The export was cancelled.', recovery: 'Nothing was written.' } };
      return { ok: true, data: planned };
    } catch (error) {
      return { ok: false, error: publicError(error, { code: 'EXPORT_NOT_PREPARED', message: 'The export was not prepared.', recovery: 'Nothing was written; correct the reported reason and retry.' }) };
    }
  });
  ipcMain.handle('export:editor-status', async (_event, request) => {
    try {
      return { ok: true, data: await editorStatus({ refresh: request?.refresh === true }) };
    } catch {
      return { ok: false, error: { code: 'EDITOR_STATUS_FAILED', message: 'Local editor detection did not complete.', recovery: 'Use Reveal in folder instead.' } };
    }
  });
  ipcMain.handle('export:reveal', async (_event, filePath) => {
    try {
      return { ok: true, data: await revealInFolder(String(filePath || '')) };
    } catch (error) {
      return { ok: false, error: publicError(error, { code: 'REVEAL_FAILED', message: 'That file could not be revealed.' }) };
    }
  });
  ipcMain.handle('export:open-in-editor', async (_event, filePath) => {
    try {
      return { ok: true, data: await openInEditor(String(filePath || '')) };
    } catch (error) {
      return { ok: false, error: publicError(error, { code: 'EDITOR_OPEN_FAILED', message: 'That file could not be opened in a detected editor.', recovery: 'Use Reveal in folder instead.' }) };
    }
  });

  // --- Transfer decision surfaces -----------------------------------------

  ipcMain.handle('transfer:plan', async (_event, request) => {
    try {
      const planned = await planTransfer(request || {});
      if (planned.cancelled) return { ok: false, error: { code: 'CANCELLED', message: 'No destination was chosen, so nothing was written.', recovery: 'Start the transfer again when ready.' } };
      return { ok: true, data: planned };
    } catch (error) {
      return { ok: false, error: publicError(error, { code: 'TRANSFER_NOT_PLANNED', message: 'The transfer pre-flight did not complete.', recovery: 'Nothing was written.' }) };
    }
  });
  ipcMain.handle('transfer:commit', async (_event, request) => {
    try {
      return { ok: true, data: await commitTransfer(request || {}) };
    } catch (error) {
      return { ok: false, error: publicError(error, { code: 'TRANSFER_FAILED', message: 'The transfer did not complete.', recovery: 'Any partial temporary file was removed and the destination was not replaced.' }) };
    }
  });
  ipcMain.handle('transfer:cancel', (_event, transferId) => envelope(() => transfers.cancel(String(transferId || '')), { code: 'TRANSFER_NOT_CANCELLED', message: 'The transfer could not be cancelled.' }));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1260,
    height: 840,
    minWidth: 760,
    minHeight: 620,
    frame: false,
    backgroundColor: '#fdfbff',
    title: preferences ? resolveDisplayName(preferences.preferences(), APP_NAME) : APP_NAME,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  const appDataRoot = path.join(app.getPath('userData'), 'private-project-data-v1');
  instancesRoot = path.join(appDataRoot, 'instances');
  fs.mkdirSync(instancesRoot, { recursive: true });
  vault = new KeyVault(path.join(appDataRoot, 'vault'));

  // Application-level records live beside the instances root and the key
  // vault. They are never written into an encrypted project bundle.
  const settingsRoot = path.join(appDataRoot, 'app-settings');
  fs.mkdirSync(settingsRoot, { recursive: true });
  preferences = new PreferencesStore(settingsRoot);
  vocabulary = new VocabularyStore(settingsRoot, preferences);
  vocabulary.load();
  notifications = new NotificationLog(settingsRoot, preferences);
  locks = new ElementLocks(settingsRoot, preferences);
  authenticator = new Authenticator(settingsRoot, APP_NAME);
  tickets = new SupportTickets(settingsRoot);
  converter = new FileConverter({ maxBytes: MAX_ATTACHMENT_BYTES, offlineOcrStatus: resolveOfflineOcrRuntime });
  docsLibrary = new DocsLibrary({ resourcesPath: process.resourcesPath, appPath: app.getAppPath() });
  changelogLibrary = new ChangelogLibrary({ resourcesPath: process.resourcesPath, appPath: app.getAppPath() });
  ollamaSuite = new OllamaSuite({ rootPath: path.join(settingsRoot, 'local-models'), send: sendToRenderer });
  transfers = new TransferCoordinator(sendToRenderer);

  registerIpc();
  createWindow();
  applyIdentityToWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('before-quit', () => { discardPendingImport(); closeSession(); ollamaSuite?.dispose(); });
app.on('window-all-closed', () => app.quit());
