'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

/**
 * The only channels the renderer may subscribe to. Progress, model streaming,
 * notification pushes and applied schedules are pushed from the privileged
 * boundary; there is no wildcard channel and no way to register another.
 */
const SUBSCRIBABLE_CHANNELS = Object.freeze([
  'transfer:progress',
  'ollama:stream',
  'notification:push',
  'schedule:applied',
]);

/** Subscribes to one allowlisted channel and returns an unsubscribe function. */
function subscribe(channel, listener) {
  if (!SUBSCRIBABLE_CHANNELS.includes(channel)) {
    throw new Error('That channel is not one of the allowlisted subscription channels.');
  }
  if (typeof listener !== 'function') throw new Error('A subscription needs a listener function.');
  const wrapped = (_event, payload) => listener(payload);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

contextBridge.exposeInMainWorld('taxDesktop', Object.freeze({
  channels: SUBSCRIBABLE_CHANNELS,
  subscribe,
  window: Object.freeze({
    minimize: invoke('window:minimize'),
    maximize: invoke('window:maximize'),
    close: invoke('window:close'),
  }),
  project: Object.freeze({
    status: invoke('project:status'),
    create: invoke('project:create'),
    previewImport: invoke('project:preview-import'),
    activateImport: invoke('project:activate-import'),
    discardPreview: invoke('project:discard-preview'),
    save: invoke('project:save'),
    saveCopy: invoke('project:save-copy'),
    close: invoke('project:close'),
  }),
  state: Object.freeze({
    load: invoke('state:load'),
    mutate: invoke('state:mutate'),
  }),
  attachment: Object.freeze({
    add: invoke('attachment:add'),
    confirm: invoke('attachment:confirm'),
    remove: invoke('attachment:remove'),
  }),
  ocr: Object.freeze({
    runtimeStatus: invoke('ocr:runtime-status'),
  }),
  history: Object.freeze({
    query: invoke('history:query'),
    diff: invoke('history:diff'),
    restore: invoke('history:restore'),
    undo: invoke('history:undo'),
    label: invoke('history:label'),
    verify: invoke('history:verify'),
  }),
  settings: Object.freeze({
    load: invoke('settings:load'),
    update: invoke('settings:update'),
    resetAppearance: invoke('settings:reset-appearance'),
    importPreset: invoke('settings:import-preset'),
    exportPreset: invoke('settings:export-preset'),
    saveTabs: invoke('settings:save-tabs'),
    chooseLogo: invoke('logo:choose'),
  }),
  vocabulary: Object.freeze({
    choose: invoke('vocabulary:choose'),
    status: invoke('vocabulary:status'),
    clear: invoke('vocabulary:clear'),
    sharedMode: invoke('vocabulary:shared-mode'),
  }),
  schedules: Object.freeze({
    evaluate: invoke('schedule:evaluate'),
    save: invoke('schedule:save'),
    readExternal: invoke('schedule:read-external'),
    applyExternal: invoke('schedule:apply-external'),
  }),
  converter: Object.freeze({
    catalog: invoke('converter:catalog'),
    preview: invoke('converter:preview'),
    run: invoke('converter:run'),
    cancel: invoke('converter:cancel'),
  }),
  ollama: Object.freeze({
    runtimeStatus: invoke('ollama:runtime-status'),
    catalogRefresh: invoke('ollama:catalog-refresh'),
    fit: invoke('ollama:fit'),
    cartAdd: invoke('ollama:cart-add'),
    cartCommit: invoke('ollama:cart-commit'),
    queueCancel: invoke('ollama:queue-cancel'),
    chatSend: invoke('ollama:chat-send'),
    harnessPreflight: invoke('ollama:harness-preflight'),
    harnessLaunch: invoke('ollama:harness-launch'),
    harnessRollback: invoke('ollama:harness-rollback'),
    harnessRestore: invoke('ollama:harness-restore'),
    action: invoke('ollama:action'),
  }),
  locks: Object.freeze({
    list: invoke('locks:list'),
    create: invoke('locks:create'),
    attempt: invoke('locks:attempt'),
    release: invoke('locks:release'),
    reset: invoke('locks:reset'),
  }),
  totp: Object.freeze({
    status: invoke('totp:status'),
    register: invoke('totp:register'),
    confirm: invoke('totp:confirm'),
    current: invoke('totp:current'),
    remove: invoke('totp:remove'),
  }),
  tickets: Object.freeze({
    list: invoke('tickets:list'),
    create: invoke('tickets:create'),
    advance: invoke('tickets:advance'),
    remove: invoke('tickets:remove'),
  }),
  notifications: Object.freeze({
    list: invoke('notifications:list'),
    append: invoke('notifications:append'),
    update: invoke('notifications:update'),
    preview: invoke('notifications:preview-scope'),
    delete: invoke('notifications:delete'),
  }),
  docs: Object.freeze({
    list: invoke('docs:list'),
    read: invoke('docs:read'),
  }),
  changelog: Object.freeze({
    load: invoke('changelog:load'),
    openCommit: invoke('changelog:open-commit'),
  }),
  exports: Object.freeze({
    run: invoke('export:run'),
    editorStatus: invoke('export:editor-status'),
    reveal: invoke('export:reveal'),
    openInEditor: invoke('export:open-in-editor'),
  }),
  transfers: Object.freeze({
    plan: invoke('transfer:plan'),
    commit: invoke('transfer:commit'),
    cancel: invoke('transfer:cancel'),
  }),
}));
