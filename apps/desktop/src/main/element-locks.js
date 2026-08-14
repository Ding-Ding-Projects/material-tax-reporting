'use strict';

/**
 * Presentation locks over individual elements and appearance properties.
 *
 * The renderer never holds a comparison secret: it sends a candidate answer,
 * the privileged boundary derives the verifier with the shared kernel
 * implementation and answers only "accepted" or "not accepted". The stored
 * record is sealed with the operating system's protected storage using the
 * same pattern as the project key vault, so no second protected-storage
 * mechanism exists in this application.
 *
 * These locks guard against accidental edits in the interface. They are not a
 * security control, and the surface copy has to say so.
 */

const fs = require('node:fs');
const path = require('node:path');
const { safeStorage } = require('electron');
const { atomicWrite } = require('./key-vault');
const {
  LOCK_DISCLOSURE,
  createLock,
  isMutationBlocked,
  lockExpiry,
  systemClock,
  verifyLock,
} = require('@material-tax-reporting/surface-kernel');

const MAX_LOCKS = 60;
const MAX_FAILURES_BEFORE_COOLDOWN = 5;
const COOLDOWN_MS = 60_000;

/** Elements a lock may never cover, because they carry a required disclosure. */
const UNLOCKABLE_ELEMENT_IDS = new Set([
  'wizard-validation',
  'wizard-boundary-statement',
  'welcome-boundary-statement',
  'review-boundary-statement',
  'project-save',
  'project-close',
]);

class ElementLocks {
  constructor(rootPath, preferences) {
    this.filePath = path.join(path.resolve(rootPath), 'element-locks.bin');
    this.preferences = preferences;
    this.records = null;
    this.cooldowns = new Map();
  }

  read() {
    if (this.records) return this.records;
    this.records = [];
    try {
      if (fs.existsSync(this.filePath) && safeStorage.isEncryptionAvailable()) {
        const parsed = JSON.parse(safeStorage.decryptString(fs.readFileSync(this.filePath)));
        if (parsed && parsed.schemaVersion === 1 && Array.isArray(parsed.records)) {
          this.records = parsed.records.slice(0, MAX_LOCKS).filter((record) => record
            && typeof record.id === 'string' && typeof record.verifierSalt === 'string' && typeof record.verifierHash === 'string');
        }
      }
    } catch {
      this.records = [];
    }
    return this.records;
  }

  persist() {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Operating-system protected storage is unavailable, so a lock cannot be stored.');
    const payload = JSON.stringify({ schemaVersion: 1, records: this.read() });
    atomicWrite(this.filePath, safeStorage.encryptString(payload));
    this.preferences.writeLocksMeta({ count: this.read().length });
  }

  /** Lock metadata only: no salt and no verifier ever leave this module. */
  list() {
    return this.read().map((record) => ({
      id: record.id,
      elementId: record.scope.elementId,
      property: record.scope.property ?? null,
      hint: record.hint,
      lockedAt: record.lockedAt,
      credential: record.credential,
      unlockedUntil: lockExpiry(record, systemClock),
      failureCount: record.failureCount,
      recovery: record.recovery,
    }));
  }

  disclosure() {
    return LOCK_DISCLOSURE;
  }

  blocked(elementId, property) {
    return isMutationBlocked(this.read(), property ? { elementId, property } : { elementId }, systemClock);
  }

  async create({ elementId, property, answer, hint, credential, recovery }) {
    if (typeof elementId !== 'string' || elementId.length < 1 || elementId.length > 120) {
      throw new Error('Choose an element before creating a lock.');
    }
    if (UNLOCKABLE_ELEMENT_IDS.has(elementId)) {
      throw new Error('This element carries a required disclosure or a project action and cannot be locked.');
    }
    if (this.read().length >= MAX_LOCKS) throw new Error('The local lock limit has been reached.');
    const scope = property ? { elementId, property } : { elementId };
    const record = await createLock(scope, String(answer ?? ''), String(hint ?? ''), systemClock);
    record.credential = credential === 'authenticator' ? 'authenticator' : 'password';
    record.recovery = String(recovery ?? 'Reset this lock from the locks list; resetting removes the lock and records the reset in the project history.').slice(0, 240);
    this.records = [...this.read().filter((existing) => !(existing.scope.elementId === elementId && (existing.scope.property ?? null) === (property ?? null))), record];
    this.persist();
    return { id: record.id, elementId, property: property ?? null };
  }

  async attempt(id, answer) {
    const record = this.read().find((entry) => entry.id === id);
    if (!record) throw new Error('That lock no longer exists.');
    const cooldownUntil = this.cooldowns.get(id) ?? 0;
    if (Date.now() < cooldownUntil) {
      return { ok: false, cooldownUntil: new Date(cooldownUntil).toISOString(), message: 'Too many incorrect answers. Wait for the cooldown to end and try again.' };
    }
    const verdict = await verifyLock(record, String(answer ?? ''), systemClock);
    this.records = this.read().map((entry) => (entry.id === id ? { ...verdict.record, credential: record.credential, recovery: record.recovery } : entry));
    this.persist();
    if (!verdict.ok) {
      if (verdict.record.failureCount >= MAX_FAILURES_BEFORE_COOLDOWN) this.cooldowns.set(id, Date.now() + COOLDOWN_MS);
      return { ok: false, cooldownUntil: null, message: 'That answer was not accepted.' };
    }
    this.cooldowns.delete(id);
    return { ok: true, unlockedUntil: verdict.record.unlockedUntil, message: 'The element is editable until the grace period ends.' };
  }

  release(id) {
    const record = this.read().find((entry) => entry.id === id);
    if (!record) throw new Error('That lock no longer exists.');
    this.records = this.read().map((entry) => (entry.id === id ? { ...entry, unlockedUntil: null } : entry));
    this.persist();
    return { id, elementId: record.scope.elementId, property: record.scope.property ?? null };
  }

  reset(id) {
    const record = this.read().find((entry) => entry.id === id);
    if (!record) throw new Error('That lock no longer exists.');
    this.records = this.read().filter((entry) => entry.id !== id);
    this.cooldowns.delete(id);
    this.persist();
    return { id, elementId: record.scope.elementId, property: record.scope.property ?? null };
  }
}

module.exports = { COOLDOWN_MS, ElementLocks, MAX_FAILURES_BEFORE_COOLDOWN, UNLOCKABLE_ELEMENT_IDS };
