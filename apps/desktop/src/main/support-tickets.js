'use strict';

/**
 * Local support tickets.
 *
 * A ticket is a private note about a problem. There is no network, no email
 * and no server-side recovery: a ticket stays on this computer. Bodies are
 * redacted by the shared kernel before they are stored, so an identifier, a
 * monetary amount or an absolute path that was pasted in never reaches disk.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { atomicWrite } = require('./key-vault');
const {
  MAX_TICKET_BODY_LENGTH,
  MAX_TICKET_TITLE_LENGTH,
  advanceTicket,
  createSearchState,
  createTicket,
  filterTickets,
} = require('@material-tax-reporting/surface-kernel');

const MAX_TICKETS = 200;
const MAX_FILE_BYTES = 512 * 1024;
const SEVERITIES = new Set(['low', 'medium', 'high']);
const STATES = new Set(['open', 'in-progress', 'resolved']);

class SupportTickets {
  constructor(rootPath) {
    this.filePath = path.join(path.resolve(rootPath), 'support-tickets.json');
    this.tickets = null;
  }

  read() {
    if (this.tickets) return this.tickets;
    this.tickets = [];
    try {
      const stat = fs.statSync(this.filePath);
      if (stat.isFile() && stat.size <= MAX_FILE_BYTES) {
        const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        if (parsed && parsed.schemaVersion === 1 && Array.isArray(parsed.tickets)) {
          this.tickets = parsed.tickets
            .filter((ticket) => ticket && typeof ticket.id === 'string' && SEVERITIES.has(ticket.severity) && STATES.has(ticket.state))
            .slice(0, MAX_TICKETS);
        }
      }
    } catch {
      this.tickets = [];
    }
    return this.tickets;
  }

  persist() {
    atomicWrite(this.filePath, Buffer.from(`${JSON.stringify({ schemaVersion: 1, tickets: this.read() })}\n`, 'utf8'));
  }

  list(searchState) {
    const state = searchState && typeof searchState === 'object' ? { ...createSearchState(), ...searchState } : createSearchState();
    const all = this.read();
    const visible = filterTickets(all, state);
    return { tickets: visible, totalCount: all.length, visibleCount: visible.length };
  }

  create({ title, body, severity }) {
    if (this.read().length >= MAX_TICKETS) throw new Error('The local ticket limit has been reached. Resolve and remove an older ticket first.');
    const normalizedTitle = String(title ?? '').trim();
    if (normalizedTitle.length < 1) throw new Error('A ticket needs a short title.');
    const result = createTicket({
      id: crypto.randomUUID(),
      title: normalizedTitle.slice(0, MAX_TICKET_TITLE_LENGTH),
      body: String(body ?? '').slice(0, MAX_TICKET_BODY_LENGTH),
      severity: SEVERITIES.has(severity) ? severity : 'low',
      createdAt: new Date().toISOString(),
    });
    this.tickets = [result.ticket, ...this.read()];
    this.persist();
    return { ticket: result.ticket, redacted: result.redacted };
  }

  advance(id, next) {
    const ticket = this.read().find((entry) => entry.id === id);
    if (!ticket) throw new Error('That ticket no longer exists.');
    if (!STATES.has(next)) throw new Error('Choose one of the listed ticket states.');
    const advanced = advanceTicket(ticket, next, new Date().toISOString());
    if (advanced === ticket) throw new Error(`A ticket that is ${ticket.state} cannot move directly to ${next}.`);
    this.tickets = this.read().map((entry) => (entry.id === id ? advanced : entry));
    this.persist();
    return advanced;
  }

  remove(id) {
    const before = this.read().length;
    this.tickets = this.read().filter((entry) => entry.id !== id);
    if (this.tickets.length === before) throw new Error('That ticket no longer exists.');
    this.persist();
    return { id };
  }
}

module.exports = { MAX_TICKETS, SupportTickets };
