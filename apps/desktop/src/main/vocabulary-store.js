'use strict';

/**
 * Personal vocabulary storage.
 *
 * A person may supply a small local JSON file that renames wording in the
 * interface. The document is validated by the shared kernel validator, and the
 * accepted map plus its derived cache stay in the application data directory:
 * never in a project bundle, never in a history record, never in an export,
 * log or notification body.
 *
 * A rejected document never replaces an accepted one, so the wording a person
 * already relies on cannot be changed by a malformed file.
 */

const fs = require('node:fs');
const path = require('node:path');
const { atomicWrite } = require('./key-vault');
const {
  MAX_VOCABULARY_BYTES,
  applyVocabulary,
  compileReplacements,
  validateVocabularyDocument,
} = require('@material-tax-reporting/surface-kernel');

/**
 * Wording that must survive substitution because it names an official concept
 * or a product boundary a person has to be able to recognize.
 */
const IMMUTABLE_SPANS = [
  'CRA',
  'Ontario',
  'Social Insurance Number',
  'mail-in',
  'NETFILE',
  'EFILE',
];

class VocabularyStore {
  constructor(rootPath, preferences) {
    this.filePath = path.join(path.resolve(rootPath), 'vocabulary.json');
    this.preferences = preferences;
    this.compiled = null;
    this.replacements = null;
  }

  /** Loads the accepted document from disk into the derived cache. */
  load() {
    this.compiled = null;
    this.replacements = null;
    try {
      const stat = fs.statSync(this.filePath);
      if (!stat.isFile() || stat.size > MAX_VOCABULARY_BYTES * 2) return this.status();
      const stored = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      const verdict = validateVocabularyDocument(JSON.stringify({ version: 1, replacements: stored.replacements }));
      if (!verdict.ok) return this.status();
      this.replacements = verdict.replacements;
      this.compiled = compileReplacements(verdict.replacements);
    } catch {
      this.compiled = null;
      this.replacements = null;
    }
    return this.status();
  }

  status() {
    const pointer = this.preferences.vocabularyPointer();
    const active = Boolean(this.compiled) && pointer.active && !pointer.sharedModeActive;
    return {
      available: Boolean(this.compiled),
      active,
      entryCount: this.replacements ? Object.keys(this.replacements).length : 0,
      sourceName: pointer.sourceName,
      acceptedAt: pointer.acceptedAt,
      sharedModeName: pointer.sharedModeName,
      sharedModeActive: pointer.sharedModeActive,
      schemaSummary:
        'A version 1 object with one replacements map. Every key is 1 to 80 characters, every value is a string of at most 200 characters, and at most 200 replacements are accepted. Nothing else is read from the file.',
      confidentiality:
        'The file and its derived cache stay in the application data directory. Vocabulary content is never written into a project file, a history record, an export, a log, or a notification body.',
    };
  }

  /** Accepts a candidate document, or reports why it was refused. */
  accept(rawText, sourceName) {
    const verdict = validateVocabularyDocument(rawText);
    if (!verdict.ok) return { ok: false, reason: verdict.reason };
    const entryCount = Object.keys(verdict.replacements).length;
    atomicWrite(this.filePath, Buffer.from(`${JSON.stringify({ schemaVersion: 1, replacements: verdict.replacements })}\n`, 'utf8'));
    this.replacements = verdict.replacements;
    this.compiled = compileReplacements(verdict.replacements);
    this.preferences.writeVocabularyPointer({
      ...this.preferences.vocabularyPointer(),
      active: true,
      sourceName,
      acceptedAt: new Date().toISOString(),
      entryCount,
    });
    return { ok: true, status: this.status(), entryCount };
  }

  clear() {
    if (fs.existsSync(this.filePath)) fs.rmSync(this.filePath, { force: true });
    this.compiled = null;
    this.replacements = null;
    this.preferences.writeVocabularyPointer({
      ...this.preferences.vocabularyPointer(),
      active: false,
      sourceName: '',
      acceptedAt: null,
      entryCount: 0,
    });
    return this.status();
  }

  setSharedMode(active, name) {
    const pointer = this.preferences.vocabularyPointer();
    this.preferences.writeVocabularyPointer({
      ...pointer,
      sharedModeActive: active === true,
      sharedModeName: typeof name === 'string' && name.trim().length > 0 ? name.trim() : pointer.sharedModeName,
    });
    return this.status();
  }

  /** The accepted map, or null when nothing has been accepted. */
  activeReplacements() {
    const status = this.status();
    return status.active ? this.replacements : null;
  }

  /** Applies the accepted map to one string, preserving the immutable spans. */
  apply(text) {
    if (!this.status().active || !this.compiled) return text;
    return applyVocabulary(text, this.compiled, { immutableSpans: IMMUTABLE_SPANS });
  }
}

module.exports = { IMMUTABLE_SPANS, VocabularyStore };
