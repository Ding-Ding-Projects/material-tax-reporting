'use strict';

/**
 * Authenticator pairing and local support tickets.
 *
 * The pairing is generated on this computer and shown three ways: a QR matrix
 * painted here from the shared kernel's encoder, the raw pairing address, and
 * the manual base32 secret. Nothing leaves the machine.
 *
 * A ticket is a private local note. There is no network, no email and no
 * server-side recovery, and a ticket body is redacted before it is stored.
 */

import { announce, confirmDialog, el } from './dom.js';
import { createSearchField } from './regex-builder.js';

const QR_MODULE_SIZE = 6;
const QR_QUIET_ZONE = 4;

/** Paints a QR matrix as inline vector shapes; nothing is fetched. */
function renderQr(matrix, label) {
  const size = matrix.length;
  const total = (size + QR_QUIET_ZONE * 2) * QR_MODULE_SIZE;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${total} ${total}`);
  svg.setAttribute('width', String(Math.min(total, 260)));
  svg.setAttribute('height', String(Math.min(total, 260)));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  svg.classList.add('qr-code');
  const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  background.setAttribute('width', String(total));
  background.setAttribute('height', String(total));
  background.setAttribute('fill', '#ffffff');
  svg.append(background);
  let path = '';
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (!matrix[row][column]) continue;
      const x = (column + QR_QUIET_ZONE) * QR_MODULE_SIZE;
      const y = (row + QR_QUIET_ZONE) * QR_MODULE_SIZE;
      path += `M${x} ${y}h${QR_MODULE_SIZE}v${QR_MODULE_SIZE}h-${QR_MODULE_SIZE}z`;
    }
  }
  const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  shape.setAttribute('d', path);
  shape.setAttribute('fill', '#000000');
  svg.append(shape);
  return svg;
}

export function createAuthenticatorView({ api, container, notify, exportRows }) {
  let status = null;
  let pairing = null;
  let tickets = { tickets: [], totalCount: 0, visibleCount: 0 };
  let countdownTimer = null;

  const pairingArea = el('div', { class: 'card', id: 'authenticator-card', 'data-appearance-id': 'authenticator-card' });
  const codeArea = el('p', { class: 'supporting', 'aria-live': 'polite' });
  const ticketList = el('div', { class: 'ticket-list', role: 'list' });

  const ticketSearch = createSearchField({
    id: 'tickets-search',
    label: 'Search tickets',
    placeholder: 'Type part of a title, body, severity or state',
    onChange: () => refreshTickets(),
  });

  const accountInput = el('input', { id: 'authenticator-account', maxlength: '60', value: 'local-account' });
  const titleInput = el('input', { id: 'ticket-title', maxlength: '120' });
  const bodyInput = el('textarea', { id: 'ticket-body', maxlength: '4000', rows: '4' });
  const severitySelect = el('select', { id: 'ticket-severity' }, ['low', 'medium', 'high'].map((severity) => el('option', { value: severity, text: severity })));

  async function refreshStatus() {
    const result = await api.totp.status();
    status = result?.ok ? result.data : null;
    renderPairing();
  }

  async function refreshTickets() {
    const result = await api.tickets.list({ search: ticketSearch.state });
    if (!result?.ok) return;
    tickets = result.data;
    ticketSearch.reportCounts(tickets.visibleCount, tickets.totalCount);
    renderTickets();
  }

  async function register() {
    const account = accountInput.value.trim() || 'local-account';
    const result = await api.totp.register({ account });
    if (!result?.ok) { notify('No pairing was generated', result.error.message, 'error'); return; }
    pairing = result.data;
    renderPairing();
  }

  async function confirmPairing(code) {
    const result = await api.totp.confirm({ code });
    if (!result?.ok) { notify('Pairing not confirmed', result.error.message, 'error'); return; }
    if (!result.data.ok) { announce(result.data.message); notify('Code not accepted', result.data.message, 'error'); return; }
    pairing = null;
    status = result.data.status;
    notify('Authenticator paired', 'The pairing is confirmed. The shared secret is not shown again.');
    renderPairing();
  }

  async function tick() {
    if (!status?.confirmed) { codeArea.textContent = ''; return; }
    const result = await api.totp.current();
    if (!result?.ok) { codeArea.textContent = result?.error?.message || 'No current code is available.'; return; }
    codeArea.textContent = `Current code ${result.data.code}, ${result.data.secondsRemaining} second${result.data.secondsRemaining === 1 ? '' : 's'} left in this window. Next code ${result.data.next}.`;
  }

  function renderPairing() {
    const children = [
      el('h2', { text: 'Authenticator' }),
      el('p', { class: 'supporting', text: 'This is a standards utility. It is bound to no account here, it grants access to nothing, and it performs no network access.' }),
    ];
    if (!status?.registered && !pairing) {
      children.push(
        el('label', { for: 'authenticator-account' }, ['Account label', accountInput]),
        el('button', { type: 'button', class: 'filled', onClick: register }, 'Generate a pairing'),
      );
    }
    if (pairing) {
      const confirmInput = el('input', { id: 'authenticator-confirm', inputmode: 'numeric', maxlength: '6', autocomplete: 'one-time-code' });
      children.push(
        el('p', { text: pairing.note }),
        renderQr(pairing.matrix, 'Pairing code for an authenticator application'),
        el('p', { class: 'supporting' }, [el('strong', { text: 'Pairing address: ' }), el('code', { text: pairing.uri })]),
        el('p', { class: 'supporting' }, [el('strong', { text: 'Manual secret: ' }), el('code', { text: pairing.secret })]),
        el('p', { class: 'supporting', text: `${pairing.digits} digits, one new code every ${pairing.periodSeconds} seconds.` }),
        el('label', { for: 'authenticator-confirm' }, ['Enter the current code to confirm', confirmInput]),
        el('button', { type: 'button', class: 'filled', onClick: () => confirmPairing(confirmInput.value) }, 'Confirm the pairing'),
      );
    }
    if (status?.registered) {
      children.push(
        el('p', { class: 'supporting', text: `Paired for ${status.account} on ${status.createdAt}. ${status.confirmed ? `Confirmed on ${status.confirmedAt}.` : 'Not confirmed yet.'}` }),
        codeArea,
        el('p', { class: 'supporting', text: status.recovery }),
        el('button', {
          type: 'button',
          class: 'text-button',
          onClick: async () => {
            const confirmed = await confirmDialog({
              title: 'Remove this pairing?',
              body: 'There is no network, no email and no server-side recovery. Removing the pairing means registering again from the beginning.',
              confirmLabel: 'Remove the pairing',
              destructive: true,
            });
            if (!confirmed) return;
            const result = await api.totp.remove();
            if (result?.ok) { status = result.data; pairing = null; renderPairing(); }
          },
        }, 'Remove the pairing'),
      );
    }
    pairingArea.replaceChildren(...children);
    if (countdownTimer) window.clearInterval(countdownTimer);
    if (status?.confirmed) { tick(); countdownTimer = window.setInterval(tick, 1000); }
  }

  function renderTickets() {
    ticketList.replaceChildren(...(tickets.tickets.length === 0
      ? [el('div', { class: 'empty card', text: tickets.totalCount === 0 ? 'No local ticket has been created.' : 'No ticket matches this search.' })]
      : tickets.tickets.map((ticket) => el('article', { class: 'ticket-row', role: 'listitem', 'data-appearance-id': 'ticket-row' }, [
        el('div', {}, [
          el('strong', { text: ticket.title }),
          el('p', { text: ticket.body }),
          el('div', { class: 'history-meta' }, [
            el('span', { text: ticket.severity }),
            el('span', { text: ticket.state }),
            el('time', { text: ticket.updatedAt }),
          ]),
        ]),
        el('div', { class: 'history-actions' }, ['open', 'in-progress', 'resolved']
          .filter((next) => next !== ticket.state)
          .map((next) => el('button', {
            type: 'button',
            class: 'text-button',
            onClick: async () => { const result = await api.tickets.advance({ id: ticket.id, state: next }); if (result?.ok) refreshTickets(); else notify('Ticket unchanged', result.error.message, 'error'); },
          }, `Move to ${next}`))),
      ]))));
  }

  async function createTicket() {
    const result = await api.tickets.create({ title: titleInput.value, body: bodyInput.value, severity: severitySelect.value });
    if (!result?.ok) { notify('Ticket not created', result.error.message, 'error'); return; }
    bodyInput.value = '';
    const redacted = result.data.redacted;
    notify('Ticket created', redacted.length > 0 ? `Stored locally. These were removed from the body before storage: ${redacted.join(', ')}.` : 'Stored locally on this computer only.');
    refreshTickets();
  }

  container.replaceChildren(
    el('div', { class: 'page-heading' }, [
      el('div', {}, [el('p', { class: 'eyebrow', text: 'Local only' }), el('h1', { id: 'support-heading', text: 'Authenticator and support tickets' })]),
    ]),
    pairingArea,
    el('div', { class: 'card', id: 'tickets-card', 'data-appearance-id': 'tickets-card' }, [
      el('h2', { text: 'Support tickets' }),
      el('p', { class: 'supporting', text: 'A ticket stays on this computer. There is no network, no email and no server-side recovery. The Social Insurance Number, an address and project answers are never placed in a ticket, and anything shaped like one is removed from the body before it is stored.' }),
      el('label', { for: 'ticket-title' }, ['Short title', titleInput]),
      el('label', { for: 'ticket-body' }, ['What happened', bodyInput]),
      el('label', { for: 'ticket-severity' }, ['Severity', severitySelect]),
      el('button', { type: 'button', class: 'filled', onClick: createTicket }, 'Create the ticket'),
      ticketSearch.element,
      el('button', { type: 'button', class: 'tonal', onClick: () => exportRows(tickets.tickets, ticketSearch.describe()) }, 'Export the filtered tickets'),
    ]),
    ticketList,
  );

  return { refresh: async () => { await refreshStatus(); await refreshTickets(); }, currentTickets: () => tickets.tickets };
}
