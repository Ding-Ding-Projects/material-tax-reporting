const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('taxDesktop', {
  window: {
    minimize: invoke('window:minimize'),
    maximize: invoke('window:maximize'),
    close: invoke('window:close'),
  },
  appState: {
    load: invoke('state:load'),
    mutate: invoke('state:mutate'),
    discard: invoke('state:discard'),
  },
  project: {
    status: invoke('project:status'),
    create: invoke('project:create'),
    previewOpen: invoke('project:preview-open'),
    activatePreview: invoke('project:activate-preview'),
    discardPreview: invoke('project:discard-preview'),
    save: invoke('project:save'),
    saveCopy: invoke('project:save-copy'),
    close: invoke('project:close'),
  },
  slips: {
    status: invoke('slips:status'),
    parse: invoke('slips:parse'),
  },
  history: {
    query: invoke('history:query'),
    diff: invoke('history:diff'),
    restore: invoke('history:restore'),
    label: invoke('history:label'),
    storage: invoke('history:storage'),
    exportRedacted: invoke('history:export-redacted'),
    prune: invoke('history:prune'),
  },
  packageExport: {
    status: invoke('package:status'),
    exportReviewed: invoke('package:export-reviewed'),
  },
});
