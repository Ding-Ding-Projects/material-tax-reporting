'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
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

function persistSession() {
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
    if (request.strategy === 'create-copy') {
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
    return envelope(() => {
      const active = ensureSession();
      const selectedPath = selected.filePaths[0];
      const stat = fs.statSync(selectedPath);
      if (!stat.isFile() || stat.size < 1 || stat.size > MAX_ATTACHMENT_BYTES) throw new Error('Choose a regular file between 1 byte and 96 MB.');
      const attachmentId = crypto.randomUUID();
      const bytes = fs.readFileSync(selectedPath);
      try {
        const encrypted = encryptAttachment(active.dataKey, attachmentId, bytes);
        atomicWrite(path.join(active.projectRoot, 'attachments', `${attachmentId}.enc`), encrypted);
      } finally { bytes.fill(0); }
      const nextState = clone(active.state);
      nextState.attachments.push({ id: attachmentId, displayName: path.basename(selectedPath), bytes: stat.size, addedAt: new Date().toISOString(), parserConfirmed: false });
      validateStateShape(nextState, active.metadata, active.projectRoot);
      const revision = active.history.transact({ action: 'attachment-add', stableId: `attachment:${attachmentId}`, summary: 'Added an encrypted local attachment for manual parser confirmation', state: nextState });
      active.state = nextState; persistSession();
      return { state: clone(active.state), revision };
    }, { code: 'ATTACHMENT_NOT_ADDED', message: 'The document was not attached.', recovery: 'The project remains unchanged; choose a smaller local file and retry.' });
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
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1260,
    height: 840,
    minWidth: 760,
    minHeight: 620,
    frame: false,
    backgroundColor: '#fff8fb',
    title: APP_NAME,
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
  registerIpc();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('before-quit', () => { discardPendingImport(); closeSession(); });
app.on('window-all-closed', () => app.quit());
