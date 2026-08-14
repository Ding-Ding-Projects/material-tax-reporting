'use strict';

/**
 * App-level preference storage.
 *
 * This is the record every other application-level surface depends on: the
 * personalization preferences, per-element appearance overrides, the tab
 * layout, presentation schedules, lock metadata, and the pointers to the
 * notification log and the accepted personal vocabulary.
 *
 * Two rules are structural rather than conventional:
 *
 *   - the record lives beside the app-private instances root and the key
 *     vault, never inside an encrypted project bundle and never inside a
 *     history record, so sharing a project file cannot disclose one person's
 *     settings; and
 *   - the document is bounded and validated with the exact-key idiom already
 *     used for project metadata, so an edited or corrupted file falls back to
 *     the shipped defaults instead of widening what the application accepts.
 */

const fs = require('node:fs');
const path = require('node:path');
const { atomicWrite } = require('./key-vault');
const {
  DEFAULT_PREFERENCES,
  STORAGE_KEYS,
  applyPreferencePatch,
  validatePreferences,
} = require('@material-tax-reporting/surface-kernel');

const DOCUMENT_SCHEMA_VERSION = 1;
const MAX_ENTRIES = 48;
const MAX_KEY_LENGTH = 160;
const MAX_VALUE_BYTES = 256 * 1024;
const MAX_DOCUMENT_BYTES = 1024 * 1024;

const DEFAULT_TABS = {
  tabs: [],
  groups: [],
  activeId: null,
};

const DEFAULT_SCHEDULES = {
  timeZone: 'America/Toronto',
  rules: [],
  manualOverrides: {},
  external: {
    enabled: false,
    allowedOrigins: [],
    url: '',
    lastReceivedAt: null,
    lastAppliedAt: null,
    lastVerdict: null,
    lastValues: null,
  },
};

const DEFAULT_VOCABULARY_POINTER = {
  active: false,
  sourceName: '',
  acceptedAt: null,
  entryCount: 0,
  sharedModeName: 'Shared computer mode',
  sharedModeActive: false,
};

const DEFAULT_NOTIFICATION_POINTER = { lastId: null, count: 0 };

const DEFAULT_LOCKS_META = { count: 0, updatedAt: null };

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactObject(value, keys) {
  if (!plainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function emptyDocument() {
  return { schemaVersion: DOCUMENT_SCHEMA_VERSION, updatedAt: null, entries: {} };
}

function validateDocument(candidate) {
  if (!exactObject(candidate, ['schemaVersion', 'updatedAt', 'entries'])) return emptyDocument();
  if (candidate.schemaVersion !== DOCUMENT_SCHEMA_VERSION) return emptyDocument();
  if (candidate.updatedAt !== null && (typeof candidate.updatedAt !== 'string' || new Date(candidate.updatedAt).toISOString() !== candidate.updatedAt)) return emptyDocument();
  if (!plainObject(candidate.entries)) return emptyDocument();
  const names = Object.keys(candidate.entries);
  if (names.length > MAX_ENTRIES) return emptyDocument();
  const entries = {};
  for (const name of names) {
    const value = candidate.entries[name];
    if (name === '__proto__' || name.length < 1 || name.length > MAX_KEY_LENGTH) continue;
    if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > MAX_VALUE_BYTES) continue;
    entries[name] = value;
  }
  return { schemaVersion: DOCUMENT_SCHEMA_VERSION, updatedAt: candidate.updatedAt, entries };
}

function bounded(list, cap) {
  return Array.isArray(list) ? list.slice(0, cap) : [];
}

function readTabs(raw) {
  if (!plainObject(raw)) return { ...DEFAULT_TABS };
  const tabs = bounded(raw.tabs, 60)
    .filter((tab) => plainObject(tab) && typeof tab.id === 'string' && tab.id.length > 0 && tab.id.length <= 80)
    .map((tab) => ({
      id: tab.id,
      order: Number.isFinite(tab.order) ? Math.trunc(tab.order) : 0,
      pinned: tab.pinned === true,
      groupId: typeof tab.groupId === 'string' && tab.groupId.length <= 80 ? tab.groupId : null,
      closable: tab.closable !== false,
    }));
  const groups = bounded(raw.groups, 20)
    .filter((group) => plainObject(group) && typeof group.id === 'string' && group.id.length > 0 && group.id.length <= 80)
    .map((group) => ({
      id: group.id,
      name: typeof group.name === 'string' ? group.name.slice(0, 60) : group.id,
      accent: /^#[0-9a-fA-F]{6}$/.test(String(group.accent)) ? String(group.accent).toLowerCase() : '#4355b9',
      collapsed: group.collapsed === true,
    }));
  const activeId = typeof raw.activeId === 'string' && tabs.some((tab) => tab.id === raw.activeId) ? raw.activeId : (tabs[0]?.id ?? null);
  return { tabs, groups, activeId };
}

function readSchedules(raw) {
  if (!plainObject(raw)) return structuredClone(DEFAULT_SCHEDULES);
  const external = plainObject(raw.external) ? raw.external : {};
  return {
    timeZone: typeof raw.timeZone === 'string' && raw.timeZone.length > 0 && raw.timeZone.length <= 80 ? raw.timeZone : DEFAULT_SCHEDULES.timeZone,
    rules: bounded(raw.rules, 40)
      .filter((rule) => plainObject(rule) && typeof rule.id === 'string' && rule.id.length > 0 && rule.id.length <= 80)
      .map((rule) => ({
        id: rule.id,
        enabled: rule.enabled === true,
        weekdays: bounded(rule.weekdays, 7).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
        startTime: typeof rule.startTime === 'string' ? rule.startTime.slice(0, 5) : '00:00',
        endTime: typeof rule.endTime === 'string' ? rule.endTime.slice(0, 5) : '00:00',
        target: typeof rule.target === 'string' ? rule.target.slice(0, 60) : 'theme',
        value: typeof rule.value === 'string' || typeof rule.value === 'number' || typeof rule.value === 'boolean' ? rule.value : '',
      })),
    manualOverrides: plainObject(raw.manualOverrides) ? Object.fromEntries(Object.entries(raw.manualOverrides).slice(0, 40)
      .filter(([, value]) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) : {},
    external: {
      enabled: external.enabled === true,
      allowedOrigins: bounded(external.allowedOrigins, 8).filter((origin) => typeof origin === 'string' && /^https:\/\/[^\s/]+$/i.test(origin)).map((origin) => origin.toLowerCase()),
      url: typeof external.url === 'string' && external.url.length <= 500 ? external.url : '',
      lastReceivedAt: typeof external.lastReceivedAt === 'string' ? external.lastReceivedAt : null,
      lastAppliedAt: typeof external.lastAppliedAt === 'string' ? external.lastAppliedAt : null,
      lastVerdict: typeof external.lastVerdict === 'string' ? external.lastVerdict.slice(0, 400) : null,
      lastValues: plainObject(external.lastValues) ? external.lastValues : null,
    },
  };
}

function readAppearance(raw) {
  if (!plainObject(raw)) return {};
  const store = {};
  for (const [elementId, properties] of Object.entries(raw).slice(0, 200)) {
    if (elementId === '__proto__' || elementId.length > 120 || !plainObject(properties)) continue;
    const accepted = {};
    for (const [property, value] of Object.entries(properties)) {
      if (typeof value === 'string' && value.length > 0 && value.length <= 120) accepted[property] = value;
    }
    if (Object.keys(accepted).length > 0) store[elementId] = accepted;
  }
  return store;
}

function readVocabularyPointer(raw) {
  if (!plainObject(raw)) return { ...DEFAULT_VOCABULARY_POINTER };
  return {
    active: raw.active === true,
    sourceName: typeof raw.sourceName === 'string' ? raw.sourceName.slice(0, 260) : '',
    acceptedAt: typeof raw.acceptedAt === 'string' ? raw.acceptedAt : null,
    entryCount: Number.isInteger(raw.entryCount) && raw.entryCount >= 0 ? Math.min(raw.entryCount, 200) : 0,
    sharedModeName: typeof raw.sharedModeName === 'string' && raw.sharedModeName.trim().length > 0
      ? raw.sharedModeName.slice(0, 60)
      : DEFAULT_VOCABULARY_POINTER.sharedModeName,
    sharedModeActive: raw.sharedModeActive === true,
  };
}

/** Bounded, schema-validated preference storage implementing `KeyValueStore`. */
class PreferencesStore {
  constructor(rootPath) {
    this.rootPath = path.resolve(rootPath);
    this.documentPath = path.join(this.rootPath, 'preferences.json');
    this.document = null;
  }

  read() {
    if (this.document) return this.document;
    let candidate = null;
    try {
      const stat = fs.statSync(this.documentPath);
      if (stat.isFile() && stat.size <= MAX_DOCUMENT_BYTES) {
        candidate = JSON.parse(fs.readFileSync(this.documentPath, 'utf8'));
      }
    } catch {
      candidate = null;
    }
    this.document = validateDocument(candidate);
    return this.document;
  }

  persist() {
    const document = this.read();
    document.updatedAt = new Date().toISOString();
    const bytes = Buffer.from(`${JSON.stringify(document)}\n`, 'utf8');
    if (bytes.length > MAX_DOCUMENT_BYTES) throw new Error('The preference record exceeds its local size limit.');
    atomicWrite(this.documentPath, bytes);
  }

  // --- KeyValueStore -------------------------------------------------------

  async get(key) {
    const document = this.read();
    return Object.prototype.hasOwnProperty.call(document.entries, key) ? document.entries[key] : null;
  }

  async set(key, value) {
    if (typeof key !== 'string' || key.length < 1 || key.length > MAX_KEY_LENGTH || key === '__proto__') {
      throw new Error('A preference key must be a safe bounded string.');
    }
    if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > MAX_VALUE_BYTES) {
      throw new Error('A preference value must be a bounded string.');
    }
    const document = this.read();
    if (!Object.prototype.hasOwnProperty.call(document.entries, key) && Object.keys(document.entries).length >= MAX_ENTRIES) {
      throw new Error('The preference record already holds its maximum number of entries.');
    }
    document.entries[key] = value;
    this.persist();
  }

  async delete(key) {
    const document = this.read();
    if (Object.prototype.hasOwnProperty.call(document.entries, key)) {
      delete document.entries[key];
      this.persist();
    }
  }

  async keys(prefix) {
    const document = this.read();
    return Object.keys(document.entries).filter((key) => key.startsWith(prefix)).sort();
  }

  // --- Typed sections ------------------------------------------------------

  readJson(key, fallback) {
    const document = this.read();
    const raw = document.entries[key];
    if (typeof raw !== 'string') return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  writeJson(key, value) {
    const document = this.read();
    document.entries[key] = JSON.stringify(value);
    this.persist();
  }

  preferences() {
    return validatePreferences(this.readJson(STORAGE_KEYS.preferences, null));
  }

  updatePreferences(patch) {
    const next = applyPreferencePatch(this.preferences(), patch && typeof patch === 'object' ? patch : {});
    this.writeJson(STORAGE_KEYS.preferences, next);
    return next;
  }

  appearance() {
    return readAppearance(this.readJson(STORAGE_KEYS.appearance, {}));
  }

  writeAppearance(store) {
    this.writeJson(STORAGE_KEYS.appearance, readAppearance(store));
    return this.appearance();
  }

  tabs() {
    return readTabs(this.readJson(STORAGE_KEYS.tabs, null));
  }

  writeTabs(state) {
    this.writeJson(STORAGE_KEYS.tabs, readTabs(state));
    return this.tabs();
  }

  schedules() {
    return readSchedules(this.readJson(STORAGE_KEYS.schedules, null));
  }

  writeSchedules(state) {
    this.writeJson(STORAGE_KEYS.schedules, readSchedules(state));
    return this.schedules();
  }

  vocabularyPointer() {
    return readVocabularyPointer(this.readJson(STORAGE_KEYS.vocabulary, null));
  }

  writeVocabularyPointer(pointer) {
    this.writeJson(STORAGE_KEYS.vocabulary, readVocabularyPointer(pointer));
    return this.vocabularyPointer();
  }

  notificationPointer() {
    const raw = this.readJson(STORAGE_KEYS.notifications, null);
    if (!plainObject(raw)) return { ...DEFAULT_NOTIFICATION_POINTER };
    return {
      lastId: typeof raw.lastId === 'string' ? raw.lastId.slice(0, 80) : null,
      count: Number.isInteger(raw.count) && raw.count >= 0 ? raw.count : 0,
    };
  }

  writeNotificationPointer(pointer) {
    this.writeJson(STORAGE_KEYS.notifications, {
      lastId: typeof pointer?.lastId === 'string' ? pointer.lastId.slice(0, 80) : null,
      count: Number.isInteger(pointer?.count) && pointer.count >= 0 ? pointer.count : 0,
    });
    return this.notificationPointer();
  }

  locksMeta() {
    const raw = this.readJson(STORAGE_KEYS.locks, null);
    if (!plainObject(raw)) return { ...DEFAULT_LOCKS_META };
    return {
      count: Number.isInteger(raw.count) && raw.count >= 0 ? raw.count : 0,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
    };
  }

  writeLocksMeta(meta) {
    this.writeJson(STORAGE_KEYS.locks, {
      count: Number.isInteger(meta?.count) && meta.count >= 0 ? meta.count : 0,
      updatedAt: new Date().toISOString(),
    });
    return this.locksMeta();
  }

  /** The composed record a settings surface renders. */
  snapshot() {
    return {
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      preferences: this.preferences(),
      appearance: this.appearance(),
      tabs: this.tabs(),
      schedules: this.schedules(),
      vocabulary: this.vocabularyPointer(),
      notifications: this.notificationPointer(),
      locks: this.locksMeta(),
    };
  }
}

module.exports = {
  DEFAULT_PREFERENCES,
  DOCUMENT_SCHEMA_VERSION,
  MAX_DOCUMENT_BYTES,
  MAX_ENTRIES,
  PreferencesStore,
};
