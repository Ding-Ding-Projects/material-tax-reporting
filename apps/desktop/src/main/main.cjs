const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('node:path');
const { LocalHistoryError, LocalHistoryService } = require('./history');
const { SlipParserAdapter } = require('./slips/slip-parser-adapter.cjs');
const { PackageExportAdapter } = require('./package-export-adapter.cjs');

const DEFAULT_STATE = Object.freeze({
  schemaVersion: 1,
  wizard: { currentStepId: 'start', answers: {}, completedSteps: [], lastSavedAt: null },
  settings: {
    language: 'en',
    englishFunnyLevel: 1,
    cantoneseFunnyLevel: 1,
    theme: 'system',
    showDialogEmoji: true,
  },
  parserCorrections: {},
  imports: [],
  review: {
    forms: false,
    calculations: false,
    attachments: false,
    mailingAddress: false,
    signatures: false,
  },
});

let mainWindow;
let history;
let state = structuredClone(DEFAULT_STATE);
let startupFailure = null;
const slipParser = new SlipParserAdapter();
const packageExport = new PackageExportAdapter();

function publicState() {
  return { ...state, historyAvailable: !startupFailure, historyFailure: startupFailure };
}

async function initializeHistory() {
  const root = path.join(app.getPath('userData'), 'local-history');
  history = new LocalHistoryService({
    repositoryPath: path.join(root, 'repository'),
    liveStatePath: path.join(root, 'live-state.enc'),
    credentialTarget: 'MaterialTaxReporting.LocalHistory.v1',
  });
  try {
    await history.initialize();
    state = await history.loadLiveState(structuredClone(DEFAULT_STATE));
  } catch (error) {
    startupFailure = 'Local history could not be opened. Changes are disabled until recovery succeeds.';
    console.error('Local history initialization failed without accepting any tax values.');
  }
}

async function transact(request) {
  if (startupFailure) return { ok: false, code: 'HISTORY_UNAVAILABLE', message: startupFailure };
  const nextState = structuredClone(request.nextState);
  try {
    const revision = await history.transact({
      action: request.action,
      stableId: request.stableId,
      summary: request.summary,
      nextState,
      metadata: request.metadata || {},
    });
    state = nextState;
    return { ok: true, revision, state: publicState() };
  } catch (error) {
    return {
      ok: false,
      code: 'HISTORY_TRANSACTION_FAILED',
      message: 'The change was not accepted because its local history revision could not be recorded.',
    };
  }
}

function safeHistoryError(error) {
  if (error instanceof LocalHistoryError) {
    return {
      code: typeof error.code === 'string' ? error.code : 'HISTORY_OPERATION_FAILED',
      message:
        typeof error.message === 'string'
          ? error.message
          : 'The local history operation could not be completed.',
      recovery:
        typeof error.recovery === 'string'
          ? error.recovery
          : 'Preserve the local history files and retry the operation.',
    };
  }
  return {
    code: 'HISTORY_OPERATION_FAILED',
    message: 'The local history operation could not be completed.',
    recovery: 'Preserve the local history files and retry the operation.',
  };
}

async function historyResult(operation, { refreshState = false } = {}) {
  if (startupFailure || !history) {
    return {
      ok: false,
      error: {
        code: 'HISTORY_UNAVAILABLE',
        message: 'Local history is unavailable, so this operation was not performed.',
        recovery: 'Recover the local history repository and encryption credential, then restart the application.',
      },
    };
  }
  try {
    const result = await operation();
    if (!refreshState) return { ok: true, data: result };
    state = await history.loadLiveState(structuredClone(DEFAULT_STATE));
    return { ok: true, data: { result, state: publicState() } };
  } catch (error) {
    return { ok: false, error: safeHistoryError(error) };
  }
}

function registerIpc() {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return;
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());

  ipcMain.handle('state:load', () => publicState());
  ipcMain.handle('state:mutate', (_event, request) => transact(request));
  ipcMain.handle('state:discard', (_event, request) =>
    transact({
      action: 'discard',
      stableId: request.stableId,
      summary: 'Discarded an unsaved local edit',
      nextState: request.nextState,
      metadata: { source: 'desktop' },
    }),
  );

  ipcMain.handle('slips:status', () => slipParser.status);
  ipcMain.handle('slips:parse', async (_event, request) => {
    const byteLength = Array.isArray(request.bytes) ? request.bytes.length : 0;
    if (byteLength > 20 * 1024 * 1024) {
      return { ok: false, code: 'FILE_TOO_LARGE', message: 'Choose a slip file no larger than 20 MB.' };
    }
    return slipParser.parse(request);
  });

  ipcMain.handle('history:query', (_event, filters) =>
    historyResult(() => history.query(filters || {})),
  );
  ipcMain.handle('history:diff', (_event, fromRevision, toRevision) =>
    historyResult(() => history.readDiff(fromRevision, toRevision)),
  );
  ipcMain.handle('history:restore', (_event, revisionId, kind) =>
    historyResult(() => history.restore(revisionId, kind), { refreshState: true }),
  );
  ipcMain.handle('history:label', (_event, revisionId, label) =>
    historyResult(() => history.label(revisionId, label)),
  );
  ipcMain.handle('history:storage', () => historyResult(() => history.storage()));
  ipcMain.handle('history:export-redacted', () =>
    historyResult(async () => {
      const selection = await dialog.showSaveDialog(mainWindow, {
        title: 'Export redacted local history',
        defaultPath: 'tax-history-redacted.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (selection.canceled || !selection.filePath) {
        throw new LocalHistoryError(
          'CANCELLED',
          'The redacted history export was cancelled. No file was written.',
          'Choose Export again when a destination is ready.',
        );
      }
      return history.exportRedacted(selection.filePath);
    }),
  );
  ipcMain.handle('history:prune', (_event, request) =>
    historyResult(() => history.prune(request)),
  );

  ipcMain.handle('package:status', () => packageExport.status);
  ipcMain.handle('package:export-reviewed', async (_event, review) => {
    const result = await packageExport.exportReviewedPackage({ review, state });
    if (!result.ok) return result;
    return result;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 760,
    minHeight: 620,
    frame: false,
    backgroundColor: '#f7f2fa',
    title: 'Material Tax Reporting',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(async () => {
  await initializeHistory();
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
