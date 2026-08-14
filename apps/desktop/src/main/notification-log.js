'use strict';

/**
 * The local notification log behind the notifications destination.
 *
 * Entries keep the severity, message, the recovery sentence the privileged
 * boundary already produces, the timestamp, and the action that raised them.
 * A body never carries an answer value: only the field path is recorded, the
 * same way a project mutation is summarized.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { atomicWrite } = require('./key-vault');
const {
  DEFAULT_NOTIFICATION_CAP,
  createNotification,
  filterNotifications,
  reduceNotifications,
  selectBulkScope,
} = require('@material-tax-reporting/surface-kernel');

const MAX_LOG_BYTES = 512 * 1024;
const MAX_TITLE_LENGTH = 160;
const MAX_BODY_LENGTH = 600;
const SEVERITIES = new Set(['success', 'error', 'progress', 'info']);

function sanitize(value, limit) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

class NotificationLog {
  constructor(rootPath, preferences) {
    this.filePath = path.join(path.resolve(rootPath), 'notifications.json');
    this.preferences = preferences;
    this.entries = null;
  }

  read() {
    if (this.entries) return this.entries;
    this.entries = [];
    try {
      const stat = fs.statSync(this.filePath);
      if (stat.isFile() && stat.size <= MAX_LOG_BYTES) {
        const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        if (parsed && parsed.schemaVersion === 1 && Array.isArray(parsed.entries)) {
          this.entries = parsed.entries
            .filter((entry) => entry && typeof entry.id === 'string' && SEVERITIES.has(entry.kind))
            .slice(0, DEFAULT_NOTIFICATION_CAP)
            .map((entry) => ({
              id: entry.id.slice(0, 80),
              kind: entry.kind,
              title: sanitize(entry.title, MAX_TITLE_LENGTH),
              body: sanitize(entry.body, MAX_BODY_LENGTH),
              createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date(0).toISOString(),
              read: entry.read === true,
              persistent: entry.persistent === true,
              action: sanitize(entry.action, 80),
              recovery: sanitize(entry.recovery, MAX_BODY_LENGTH),
            }));
        }
      }
    } catch {
      this.entries = [];
    }
    return this.entries;
  }

  persist() {
    const entries = this.read();
    const bytes = Buffer.from(`${JSON.stringify({ schemaVersion: 1, entries })}\n`, 'utf8');
    if (bytes.length > MAX_LOG_BYTES) {
      this.entries = entries.slice(0, Math.floor(entries.length / 2));
      return this.persist();
    }
    atomicWrite(this.filePath, bytes);
    this.preferences.writeNotificationPointer({ lastId: entries[0]?.id ?? null, count: entries.length });
    return entries;
  }

  /** Appends one entry. `body` must never contain an answer value. */
  append({ kind, title, body, action, recovery }) {
    const severity = SEVERITIES.has(kind) ? kind : 'info';
    const notification = createNotification({
      id: crypto.randomUUID(),
      kind: severity,
      title: sanitize(title, MAX_TITLE_LENGTH),
      body: sanitize(body, MAX_BODY_LENGTH),
      createdAt: new Date().toISOString(),
    });
    const entry = { ...notification, action: sanitize(action, 80), recovery: sanitize(recovery, MAX_BODY_LENGTH) };
    this.entries = reduceNotifications(this.read(), { type: 'add', notification: entry });
    this.persist();
    return entry;
  }

  list(filter, searchState) {
    const entries = this.read();
    const visible = filterNotifications(entries, filter || {}, searchState);
    return {
      entries: visible,
      totalCount: entries.length,
      visibleCount: visible.length,
      unreadCount: entries.filter((entry) => !entry.read).length,
    };
  }

  update(action) {
    this.entries = reduceNotifications(this.read(), action);
    this.persist();
    return this.read();
  }

  /** Resolves the exact rows a bulk action covers, before it runs. */
  previewScope(selection, filter, searchState) {
    const source = selection?.mode === 'filtered'
      ? filterNotifications(this.read(), filter || {}, searchState)
      : this.read();
    const scope = selection?.mode === 'filtered'
      ? source
      : selectBulkScope(source, selection || { mode: 'all' });
    return scope.map((entry) => ({ id: entry.id, title: entry.title, kind: entry.kind, createdAt: entry.createdAt }));
  }

  deleteScope(ids) {
    const allowed = new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []);
    this.entries = reduceNotifications(this.read(), { type: 'dismiss-scope', ids: [...allowed] });
    this.persist();
    return allowed.size;
  }
}

module.exports = { MAX_LOG_BYTES, NotificationLog };
