'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('taxDesktop', Object.freeze({
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
}));
