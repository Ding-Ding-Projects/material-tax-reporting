const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { LocalHistoryService } = require('./history');
const { ProjectArchiveManager } = require('./project');
const { SlipParserAdapter } = require('./slips/slip-parser-adapter.cjs');
const { PackageExportAdapter } = require('./package-export-adapter.cjs');

const DEFAULT_STATE = Object.freeze({
  schemaVersion: 1,
  wizard: { currentStepId: 'start', answers: {}, completedSteps: [], lastSavedAt: null },
  settings: {
    language: 'en', englishFunnyLevel: 1, cantoneseFunnyLevel: 1,
    theme: 'system', showDialogEmoji: true,
  },
  parserCorrections: {},
  imports: [],
  review: { forms: false, calculations: false, attachments: false, mailingAddress: false, signatures: false },
});

let mainWindow;
let history = null;
let state = structuredClone(DEFAULT_STATE);
let startupFailure = null;
let pendingPreviewToken = null;
const slipParser = new SlipParserAdapter();
const packageExport = new PackageExportAdapter();
const projectManager = new ProjectArchiveManager({
  scratchRoot: path.join(os.tmpdir(), 'material-tax-reporting-projects'),
});

function projectStatus() {
  const snapshot = projectManager.getActiveProjectSnapshot();
  if (!snapshot) return { open: false };
  return {
    open: true,
    displayName: path.basename(snapshot.projectPath),
    taxYear: snapshot.metadata.taxYear,
  };
}

function publicState() {
  return {
    ...state,
    historyAvailable: Boolean(history) && !startupFailure,
    historyFailure: startupFailure,
    projectOpen: projectStatus().open,
  };
}

function safeError(error, fallbackCode, fallbackMessage, fallbackRecovery) {
  return {
    code: typeof error?.code === 'string' ? error.code : fallbackCode,
    message: typeof error?.message === 'string' && (error.name === 'LocalHistoryError' || error.name === 'ProjectArchiveError')
      ? error.message : fallbackMessage,
    recovery: typeof error?.recovery === 'string' ? error.recovery : fallbackRecovery,
  };
}

async function resultEnvelope(operation, fallback = {}) {
  try { return { ok: true, data: await operation() }; }
  catch (error) {
    return { ok: false, error: safeError(
      error,
      fallback.code || 'OPERATION_FAILED',
      fallback.message || 'The operation did not complete.',
      fallback.recovery || 'Preserve the project file and retry.',
    ) };
  }
}

function requireProject() {
  if (!projectManager.getActiveProjectSnapshot() || !history) {
    const error = new Error('Project required');
    error.code = 'PROJECT_REQUIRED';
    throw error;
  }
}

function makeMemoryKeyVault() {
  return {
    getOrCreateKey() {
      const key = projectManager.getActiveDataKey();
      if (!key) throw new Error('Project key unavailable');
      return key;
    },
  };
}

function projectMetadata(nextState, existing) {
  return {
    ...existing,
    parserConfirmations: Array.isArray(existing.parserConfirmations) ? existing.parserConfirmations : [],
    pdfReviewChecklist: structuredClone(nextState.review),
  };
}

function createInitialState(taxYear) {
  const initial = structuredClone(DEFAULT_STATE);
  initial.wizard.answers.start = taxYear;
  initial.wizard.completedSteps = ['start'];
  initial.wizard.currentStepId = 'residence';
  initial.wizard.lastSavedAt = new Date().toISOString();
  return initial;
}

async function initializeActiveHistory({ initialState } = {}) {
  const snapshot = projectManager.getActiveProjectSnapshot();
  if (!snapshot) throw new Error('No active project');
  history = new LocalHistoryService({
    repositoryPath: snapshot.gitPath,
    liveStatePath: snapshot.liveStatePath,
    credentialTarget: 'MaterialTaxReporting.ProjectHistory.v1',
    keyVault: makeMemoryKeyVault(),
  });
  history.initialize();
  if (initialState) {
    history.transact({
      action: 'create', stableId: 'project:initial-state',
      summary: 'Created the encrypted project state', nextState: initialState,
      metadata: { surface: 'project-create' },
    });
    state = initialState;
  } else {
    state = history.loadLiveState(structuredClone(DEFAULT_STATE));
  }
  startupFailure = null;
}

function persistActiveProject(nextState, metadataOverride) {
  const snapshot = projectManager.getActiveProjectSnapshot();
  projectManager.updateMetadata(metadataOverride || projectMetadata(nextState, snapshot.metadata));
  projectManager.save();
}

function abandonUnpersistedScratch() {
  history?.dispose();
  projectManager.close();
  history = null;
  state = structuredClone(DEFAULT_STATE);
  startupFailure = 'The project file could not be replaced atomically. The unpersisted scratch state was discarded; reopen the unchanged project file.';
}

async function transact(request) {
  try {
    requireProject();
    const nextState = structuredClone(request.nextState);
    const revision = history.transact({
      action: request.action, stableId: request.stableId, summary: request.summary,
      nextState, metadata: request.metadata || {},
    });
    try { persistActiveProject(nextState); }
    catch { abandonUnpersistedScratch(); throw new Error('Project archive save failed'); }
    state = nextState;
    return { ok: true, revision, state: publicState(), status: projectStatus() };
  } catch (error) {
    return {
      ok: false,
      code: error.code || 'HISTORY_TRANSACTION_FAILED',
      message: startupFailure || 'The change was not accepted because its history and project file could not both be recorded.',
      recovery: 'Preserve the project file, reopen it when required, and retry the change.',
    };
  }
}

function projectOperationError(error) {
  return safeError(
    error, 'PROJECT_OPERATION_FAILED',
    'The project file operation failed without replacing live state.',
    'Preserve every .mtrproject file, check the chosen destination, and retry.',
  );
}

function registerProjectIpc() {
  ipcMain.handle('project:status', () => ({ ok: true, data: projectStatus() }));
  ipcMain.handle('project:create', async (_event, request) => {
    if (projectManager.getActiveProjectSnapshot()) {
      return { ok: false, error: { code: 'PROJECT_ALREADY_OPEN', message: 'Close the current project before creating another one.', recovery: 'Save or save a copy, then close the open project.' } };
    }
    const selection = await dialog.showSaveDialog(mainWindow, {
      title: 'Create encrypted tax project', defaultPath: 'tax-report.mtrproject',
      filters: [{ name: 'Material Tax Reporting project', extensions: ['mtrproject'] }],
    });
    if (selection.canceled || !selection.filePath) return { ok: false, error: { code: 'CANCELLED', message: 'Project creation was cancelled.', recovery: 'Choose Create project when ready.' } };
    try {
      const password = request.password;
      request.password = null;
      if (fs.existsSync(selection.filePath)) throw new Error('Destination exists');
      const taxYear = Number(request.taxYear);
      const metadata = {
        taxYear,
        ruleSource: { references: Array.isArray(request.ruleSources) ? request.ruleSources : [] },
        parserConfirmations: [],
        pdfReviewChecklist: structuredClone(DEFAULT_STATE.review),
        historyRepositoryPath: 'history/repository',
        liveStatePath: 'state/live-state.enc',
        encryptedAttachments: [],
      };
      projectManager.create({ destinationPath: selection.filePath, password, metadata });
      const initial = createInitialState(taxYear);
      await initializeActiveHistory({ initialState: initial });
      persistActiveProject(initial);
      return { ok: true, data: { state: publicState(), status: projectStatus() } };
    } catch (error) {
      history?.dispose(); projectManager.close(); history = null; state = structuredClone(DEFAULT_STATE);
      return { ok: false, error: projectOperationError(error) };
    }
  });

  ipcMain.handle('project:preview-open', async (_event, request) => {
    const selection = await dialog.showOpenDialog(mainWindow, {
      title: 'Open encrypted tax project', properties: ['openFile'],
      filters: [{ name: 'Material Tax Reporting project', extensions: ['mtrproject'] }],
    });
    if (selection.canceled || !selection.filePaths[0]) return { ok: false, error: { code: 'CANCELLED', message: 'Project import was cancelled.', recovery: 'Choose Open or import when ready.' } };
    try {
      const password = request.password;
      request.password = null;
      projectManager.discardPreview();
      const preview = projectManager.preview({ projectPath: selection.filePaths[0], password });
      pendingPreviewToken = preview.previewToken;
      return { ok: true, data: { preview: {
        displayName: path.basename(preview.projectPath), taxYear: preview.metadata.taxYear,
        revisionCount: preview.revisionCount, attachmentCount: preview.attachmentCount,
        memberCount: preview.memberCount, reconcileEligible: preview.reconcileEligible,
        reconcileIneligibility: preview.reconcileIneligibilityReason,
      } } };
    } catch (error) { return { ok: false, error: projectOperationError(error) }; }
  });

  ipcMain.handle('project:activate-preview', async (_event, request) => {
    let activated = false;
    try {
      const password = request.password;
      request.password = null;
      if (!pendingPreviewToken) throw new Error('No preview');
      let destinationPath;
      if (request.strategy === 'create-copy') {
        const selection = await dialog.showSaveDialog(mainWindow, {
          title: 'Create validated project copy', defaultPath: 'tax-report-copy.mtrproject',
          filters: [{ name: 'Material Tax Reporting project', extensions: ['mtrproject'] }],
        });
        if (selection.canceled || !selection.filePath) return { ok: false, error: { code: 'CANCELLED', message: 'Project copy creation was cancelled.', recovery: 'The validated preview remains available.' } };
        destinationPath = selection.filePath;
      }
      const previousHistory = history;
      projectManager.activatePreview({
        previewToken: pendingPreviewToken, strategy: request.strategy,
        destinationPath, password,
      });
      activated = true;
      previousHistory?.dispose();
      history = null;
      pendingPreviewToken = null;
      await initializeActiveHistory();
      return { ok: true, data: { state: publicState(), status: projectStatus() } };
    } catch (error) {
      if (activated) {
        history?.dispose(); projectManager.close(); history = null;
        state = structuredClone(DEFAULT_STATE); startupFailure = 'The validated project could not initialize local history and was not activated.';
      }
      return { ok: false, error: projectOperationError(error) };
    }
  });

  ipcMain.handle('project:discard-preview', () => {
    projectManager.discardPreview(); pendingPreviewToken = null;
    return { ok: true, data: {} };
  });
  ipcMain.handle('project:save', () => resultEnvelope(() => {
    requireProject(); persistActiveProject(state); return { status: projectStatus() };
  }, { code: 'PROJECT_SAVE_FAILED', message: 'The project file was not replaced.', recovery: 'Preserve the existing project file and retry Save.' }));
  ipcMain.handle('project:save-copy', async (_event, request) => {
    const selection = await dialog.showSaveDialog(mainWindow, {
      title: 'Save encrypted project copy', defaultPath: 'tax-report-copy.mtrproject',
      filters: [{ name: 'Material Tax Reporting project', extensions: ['mtrproject'] }],
    });
    if (selection.canceled || !selection.filePath) return { ok: false, error: { code: 'CANCELLED', message: 'Save copy was cancelled.', recovery: 'The open project is unchanged.' } };
    return resultEnvelope(() => {
      const password = request.password;
      request.password = null;
      requireProject(); projectManager.saveCopy({ destinationPath: selection.filePath, password });
      return { destinationSelected: true };
    }, { code: 'PROJECT_COPY_FAILED', message: 'The project copy was not created.', recovery: 'Choose a new non-existing .mtrproject destination and retry.' });
  });
  ipcMain.handle('project:close', () => resultEnvelope(() => {
    if (projectManager.getActiveProjectSnapshot()) projectManager.save();
    history?.dispose(); projectManager.discardPreview(); pendingPreviewToken = null;
    projectManager.close(); history = null; state = structuredClone(DEFAULT_STATE); startupFailure = null;
    return { state: publicState(), status: projectStatus() };
  }, { code: 'PROJECT_CLOSE_FAILED', message: 'The project could not be saved and closed.', recovery: 'Keep the application open and retry Save before closing.' }));
}

async function parseAndAttachSlip(request) {
  requireProject();
  const byteLength = Array.isArray(request.bytes) ? request.bytes.length : 0;
  if (byteLength > 20 * 1024 * 1024) return { ok: false, code: 'FILE_TOO_LARGE', message: 'Choose a slip file no larger than 20 MB.' };
  const parsed = await slipParser.parse(request);
  if (!parsed.ok) return parsed;
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mtr-slip-incoming-'));
  const incomingPath = path.join(tempRoot, 'attachment.bin');
  const recordId = crypto.randomUUID();
  const importedAt = new Date().toISOString();
  try {
    fs.writeFileSync(incomingPath, Buffer.from(request.bytes));
    const attachmentPath = projectManager.addAttachment({ sourcePath: incomingPath, archivePath: `attachments/${recordId}.bin` });
    const nextState = structuredClone(state);
    nextState.imports.push({
      id: recordId, kind: 'slip-parser-draft', importedAt,
      status: 'correction-required', valueCount: parsed.values.length, attachmentPath,
    });
    history.transact({
      action: 'import', stableId: `slip-import:${recordId}`,
      summary: 'Imported a local slip draft for manual correction', nextState,
      metadata: { source: 'slip-parser', requiresCorrection: true },
    });
    const snapshot = projectManager.getActiveProjectSnapshot();
    const metadata = projectMetadata(nextState, snapshot.metadata);
    metadata.parserConfirmations.push({
      recordId, attachmentPath, status: 'correction-required', importedAt,
    });
    persistActiveProject(nextState, metadata);
    state = nextState;
    return { ...parsed, state: publicState() };
  } catch (error) {
    abandonUnpersistedScratch();
    return { ok: false, code: 'SLIP_IMPORT_NOT_PERSISTED', message: 'The slip import was not accepted because the project file could not be saved.', recovery: 'Reopen the unchanged project file and retry.' };
  } finally { fs.rmSync(tempRoot, { recursive: true, force: true }); }
}

function registerIpc() {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => { if (mainWindow) mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); });
  ipcMain.handle('window:close', () => mainWindow?.close());
  registerProjectIpc();
  ipcMain.handle('state:load', () => publicState());
  ipcMain.handle('state:mutate', (_event, request) => transact(request));
  ipcMain.handle('state:discard', (_event, request) => transact({
    action: 'discard', stableId: request.stableId, summary: 'Discarded an unsaved local edit',
    nextState: request.nextState, metadata: { source: 'desktop' },
  }));
  ipcMain.handle('slips:status', () => slipParser.status);
  ipcMain.handle('slips:parse', (_event, request) => parseAndAttachSlip(request));

  ipcMain.handle('history:query', (_event, filters) => resultEnvelope(() => { requireProject(); return history.query(filters || {}); }, { code: 'HISTORY_QUERY_FAILED', message: 'Local history could not be queried.' }));
  ipcMain.handle('history:diff', (_event, from, to) => resultEnvelope(() => { requireProject(); return history.readDiff(from, to); }, { code: 'HISTORY_DIFF_FAILED', message: 'The selected revision difference could not be read.' }));
  ipcMain.handle('history:restore', (_event, revisionId, kind) => resultEnvelope(() => {
    requireProject(); const result = history.restore(revisionId, kind); const nextState = history.loadLiveState(structuredClone(DEFAULT_STATE));
    try { persistActiveProject(nextState); } catch { abandonUnpersistedScratch(); throw new Error('Project save failed'); }
    state = nextState; return { result, state: publicState(), status: projectStatus() };
  }, { code: 'HISTORY_RESTORE_FAILED', message: 'The selected revision was not restored.' }));
  ipcMain.handle('history:label', (_event, revisionId, label) => resultEnvelope(() => {
    requireProject(); const result = history.label(revisionId, label);
    try { persistActiveProject(state); } catch { abandonUnpersistedScratch(); throw new Error('Project save failed'); }
    return result;
  }, { code: 'HISTORY_LABEL_FAILED', message: 'The revision label was not recorded.' }));
  ipcMain.handle('history:storage', () => resultEnvelope(() => { requireProject(); return history.storage(); }, { code: 'HISTORY_STORAGE_FAILED', message: 'Local history storage use could not be read.' }));
  ipcMain.handle('history:export-redacted', async () => {
    const selection = await dialog.showSaveDialog(mainWindow, { title: 'Export redacted local history', defaultPath: 'tax-history-redacted.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (selection.canceled || !selection.filePath) return { ok: false, error: { code: 'CANCELLED', message: 'The redacted export was cancelled.', recovery: 'The project file is unchanged.' } };
    return resultEnvelope(() => { requireProject(); return history.exportRedacted(selection.filePath); }, { code: 'HISTORY_EXPORT_FAILED', message: 'The redacted history export was not written.' });
  });
  ipcMain.handle('history:prune', (_event, request) => resultEnvelope(() => {
    requireProject(); const result = history.prune(request);
    try { persistActiveProject(state); } catch { abandonUnpersistedScratch(); throw new Error('Project save failed'); }
    return result;
  }, { code: 'HISTORY_PRUNE_FAILED', message: 'Local history pruning did not complete.' }));

  ipcMain.handle('package:status', () => packageExport.status);
  ipcMain.handle('package:export-reviewed', (_event, review) => packageExport.exportReviewedPackage({ review, state }));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240, height: 820, minWidth: 760, minHeight: 620, frame: false,
    backgroundColor: '#f7f2fa', title: 'Material Tax Reporting',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  projectManager.cleanupStaleScratch();
  registerIpc(); createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('before-quit', () => { history?.dispose(); projectManager.discardPreview(); projectManager.close(); });
app.on('window-all-closed', () => app.quit());
