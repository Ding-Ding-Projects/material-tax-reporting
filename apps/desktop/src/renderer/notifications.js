'use strict';

/**
 * The notifications destination.
 *
 * The existing toast region stays exactly where it is; this adds the permanent
 * log behind it. Every entry keeps its severity, message, the recovery
 * sentence the privileged boundary produces, the timestamp and the originating
 * action. A body never carries an answer value: only the field path is
 * recorded.
 *
 * Failure notices persist until they are acknowledged.
 */

import { el, announce, confirmDialog } from './dom.js';
import { createSearchField } from './regex-builder.js';

const SEVERITIES = ['success', 'error', 'progress', 'info'];

export function createNotificationsView({ api, container, notify }) {
  let data = { entries: [], totalCount: 0, visibleCount: 0, unreadCount: 0 };
  let selected = new Set();
  let kinds = new Set();
  let range = { from: '', to: '' };

  const search = createSearchField({
    id: 'notifications-search',
    label: 'Search notices',
    placeholder: 'Type part of a title, body or severity',
    onChange: () => refresh(),
  });

  const summary = el('p', { class: 'supporting', 'aria-live': 'polite' });
  const list = el('div', { class: 'notification-log', role: 'list' });
  const scopePreview = el('p', { class: 'supporting', 'aria-live': 'polite' });

  const severityFilters = el('fieldset', {}, [
    el('legend', { text: 'Severity' }),
    ...SEVERITIES.map((kind) => el('label', { class: 'inline-check', for: `notification-kind-${kind}` }, [
      el('input', {
        id: `notification-kind-${kind}`,
        type: 'checkbox',
        onChange: (event) => { if (event.target.checked) kinds.add(kind); else kinds.delete(kind); refresh(); },
      }),
      el('span', { text: kind }),
    ])),
  ]);

  const fromInput = el('input', { id: 'notifications-from', type: 'date', onChange: (event) => { range.from = event.target.value ? `${event.target.value}T00:00:00.000Z` : ''; refresh(); } });
  const toInput = el('input', { id: 'notifications-to', type: 'date', onChange: (event) => { range.to = event.target.value ? `${event.target.value}T23:59:59.999Z` : ''; refresh(); } });

  async function refresh() {
    const result = await api.notifications.list({
      filter: { kinds: [...kinds], from: range.from, to: range.to },
      search: search.state,
    });
    if (!result?.ok) return;
    data = result.data;
    search.reportCounts(data.visibleCount, data.totalCount);
    summary.textContent = `${data.visibleCount} of ${data.totalCount} notice${data.totalCount === 1 ? '' : 's'} shown. ${data.unreadCount} unread.`;
    render();
  }

  function render() {
    list.replaceChildren(...(data.entries.length === 0
      ? [el('div', { class: 'empty card', text: 'No notice matches the current filter.' })]
      : data.entries.map((entry) => el('article', {
        class: `notification-row ${entry.kind}${entry.read ? '' : ' unread'}`,
        role: 'listitem',
        id: `notification-${entry.id}`,
        'data-appearance-id': 'notification-row',
      }, [
        el('label', { class: 'inline-check', for: `notification-select-${entry.id}` }, [
          el('input', {
            id: `notification-select-${entry.id}`,
            type: 'checkbox',
            checked: selected.has(entry.id),
            'aria-label': `Select the notice ${entry.title}`,
            onChange: (event) => { if (event.target.checked) selected.add(entry.id); else selected.delete(entry.id); updateScopePreview(); },
          }),
          el('span', { class: 'visually-hidden', text: 'Select' }),
        ]),
        el('div', {}, [
          el('strong', { text: entry.title }),
          el('p', { text: entry.body }),
          entry.recovery ? el('p', { class: 'supporting', text: `Recovery: ${entry.recovery}` }) : null,
          el('div', { class: 'history-meta' }, [
            el('span', { text: entry.kind }),
            el('time', { text: entry.createdAt }),
            entry.action ? el('span', { text: entry.action }) : null,
            entry.persistent ? el('span', { text: 'Stays until acknowledged' }) : null,
          ]),
        ]),
        el('div', { class: 'history-actions' }, [
          el('button', {
            type: 'button',
            class: 'text-button',
            onClick: async () => { await api.notifications.update({ type: entry.read ? 'mark-unread' : 'mark-read', id: entry.id }); refresh(); },
          }, entry.read ? 'Mark unread' : 'Acknowledge'),
          el('button', {
            type: 'button',
            class: 'text-button',
            onClick: async () => { await api.notifications.update({ type: 'dismiss', id: entry.id }); selected.delete(entry.id); refresh(); },
          }, 'Remove'),
        ]),
      ]))));
    updateScopePreview();
  }

  async function previewScope(mode) {
    const result = await api.notifications.preview({
      selection: mode === 'selected' ? { mode: 'selected', ids: [...selected] } : { mode },
      filter: { kinds: [...kinds], from: range.from, to: range.to },
      search: search.state,
    });
    return result?.ok ? result.data : [];
  }

  async function updateScopePreview() {
    scopePreview.textContent = selected.size === 0
      ? 'Nothing is selected. A bulk action always previews its exact scope before it runs.'
      : `${selected.size} notice${selected.size === 1 ? '' : 's'} selected.`;
  }

  async function runBulk(mode, action) {
    const scope = await previewScope(mode);
    if (scope.length === 0) { announce('That bulk action matches no notice.'); return; }
    const filterDescription = `severity ${kinds.size === 0 ? 'any' : [...kinds].join(', ')}; ${search.describe()}${range.from ? `; from ${range.from}` : ''}${range.to ? `; to ${range.to}` : ''}`;
    const confirmed = await confirmDialog({
      title: action === 'delete' ? 'Remove these notices?' : 'Acknowledge these notices?',
      body: `${scope.length} notice${scope.length === 1 ? '' : 's'} are covered by this filter: ${filterDescription}. The first few are: ${scope.slice(0, 5).map((entry) => entry.title).join(', ')}.`,
      confirmLabel: action === 'delete' ? `Remove ${scope.length}` : `Acknowledge ${scope.length}`,
      destructive: action === 'delete',
    });
    if (!confirmed) return;
    if (action === 'delete') await api.notifications.delete({ ids: scope.map((entry) => entry.id) });
    else for (const entry of scope) await api.notifications.update({ type: 'mark-read', id: entry.id });
    selected.clear();
    notify('Bulk action complete', `${scope.length} notice${scope.length === 1 ? '' : 's'} were ${action === 'delete' ? 'removed' : 'acknowledged'}.`);
    refresh();
  }

  container.replaceChildren(
    el('div', { class: 'page-heading' }, [
      el('div', {}, [el('p', { class: 'eyebrow', text: 'Local notice log' }), el('h1', { id: 'notifications-heading', text: 'Notifications' })]),
    ]),
    el('div', { class: 'card', id: 'notifications-tools', 'data-appearance-id': 'notifications-tools' }, [
      search.element,
      severityFilters,
      el('div', { class: 'builder-row' }, [
        el('label', { for: 'notifications-from' }, ['From', fromInput]),
        el('label', { for: 'notifications-to' }, ['To', toInput]),
      ]),
      summary,
      scopePreview,
      el('div', { class: 'button-row' }, [
        el('button', { type: 'button', class: 'text-button', onClick: () => runBulk('filtered', 'acknowledge') }, 'Acknowledge everything in this filter'),
        el('button', { type: 'button', class: 'text-button', onClick: () => runBulk('selected', 'acknowledge') }, 'Acknowledge the selection'),
        el('button', { type: 'button', class: 'text-button', onClick: () => runBulk('filtered', 'delete') }, 'Remove everything in this filter'),
        el('button', { type: 'button', class: 'text-button', onClick: () => runBulk('selected', 'delete') }, 'Remove the selection'),
      ]),
    ]),
    list,
  );

  return { refresh, currentRows: () => data.entries, filterDescription: () => `severity ${kinds.size === 0 ? 'any' : [...kinds].join(', ')}; ${search.describe()}` };
}
