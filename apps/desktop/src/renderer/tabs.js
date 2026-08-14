'use strict';

/**
 * The tab strip.
 *
 * Ordering, pinning, grouping, keyboard movement, overflow and bulk close come
 * from the shared kernel tab model; this module owns the widget, its roles and
 * its focus behaviour. The layout is persisted through the application
 * preference record, so it survives a restart without ever entering the
 * encrypted project file.
 */

import {
  bulkCloseByQuery,
  computeOverflow,
  isVerticalDock,
  reduceTabs,
  resolveKeyboardMove,
  sortTabs,
} from '@material-tax-reporting/surface-kernel';
import { announce, confirmDialog, el, promptDialog } from './dom.js';
import { createSearchField } from './regex-builder.js';

const GROUP_ACCENTS = ['#4355b9', '#7b2f68', '#1d6b42', '#8a5a00'];

export function createTabStrip({ container, destinations, onActivate, onLayoutChange, initialState, dock = 'left' }) {
  const byId = new Map(destinations.map((destination) => [destination.id, destination]));
  let state = normalize(initialState, destinations);
  let currentDock = dock;
  let overflowOpen = false;

  const overflowFilter = createSearchField({
    id: 'tab-overflow-filter',
    label: 'Filter hidden destinations',
    placeholder: 'Type part of a destination name',
    onChange: () => renderOverflow(),
  });

  const bulkFilter = createSearchField({
    id: 'tab-bulk-close-filter',
    label: 'Close destinations matching',
    placeholder: 'Type part of a destination name',
    onChange: () => renderBulkPreview(),
  });

  const bulkPreview = el('p', { class: 'supporting', 'aria-live': 'polite' });
  const list = el('div', { class: 'tabstrip-list', role: 'tablist', 'aria-label': 'Open destinations' });
  const overflowButton = el('button', {
    type: 'button',
    class: 'tab-overflow-button',
    'aria-expanded': 'false',
    'aria-controls': 'tab-overflow-panel',
    onClick: () => { overflowOpen = !overflowOpen; render(); if (overflowOpen) overflowFilter.focus(); },
  }, 'More destinations');
  const overflowList = el('div', { class: 'overflow-list', role: 'group', 'aria-label': 'Hidden destinations' });
  const overflowPanel = el('div', { id: 'tab-overflow-panel', class: 'overflow-panel hidden' }, [
    overflowFilter.element,
    overflowList,
    el('h3', { text: 'Close several at once' }),
    bulkFilter.element,
    bulkPreview,
    el('button', { type: 'button', class: 'tonal', onClick: () => runBulkClose() }, 'Preview and close matches'),
  ]);

  container.replaceChildren(list, overflowButton, overflowPanel);

  function normalize(raw, available) {
    const known = new Set(available.map((destination) => destination.id));
    const tabs = (raw?.tabs || []).filter((tab) => known.has(tab.id));
    if (tabs.length === 0) {
      const seeded = available.filter((destination) => destination.defaultOpen);
      return {
        tabs: seeded.map((destination, index) => ({ id: destination.id, order: index, pinned: Boolean(destination.pinned), groupId: null, closable: destination.closable !== false })),
        groups: raw?.groups || [],
        activeId: seeded[0]?.id ?? null,
      };
    }
    return { tabs, groups: raw?.groups || [], activeId: known.has(raw?.activeId) ? raw.activeId : tabs[0].id };
  }

  function persist() {
    onLayoutChange({ tabs: state.tabs, groups: state.groups, activeId: state.activeId });
  }

  function apply(action) {
    state = reduceTabs(state, action);
    render();
    persist();
  }

  function labelOf(tab) {
    return byId.get(tab.id)?.label ?? tab.id;
  }

  function open(id) {
    const destination = byId.get(id);
    if (!destination) return;
    apply({ type: 'open', tab: { id, order: state.tabs.length, pinned: Boolean(destination.pinned), groupId: null, closable: destination.closable !== false } });
    onActivate(id);
  }

  function activate(id) {
    apply({ type: 'activate', id });
    onActivate(id);
  }

  function contextMenuFor(tab) {
    return [
      { label: tab.pinned ? 'Unpin this destination' : 'Pin this destination', run: () => apply({ type: 'pin', id: tab.id, pinned: !tab.pinned }) },
      { label: 'Move to a group', run: () => moveToGroup(tab) },
      { label: 'Remove from its group', run: () => apply({ type: 'ungroup', ids: [tab.id] }) },
      { label: 'Move earlier', run: () => apply({ type: 'move', id: tab.id, toIndex: Math.max(0, sortTabs(state.tabs).findIndex((entry) => entry.id === tab.id) - 1) }) },
      { label: 'Move later', run: () => apply({ type: 'move', id: tab.id, toIndex: sortTabs(state.tabs).findIndex((entry) => entry.id === tab.id) + 1 }) },
      { label: 'Edit appearance', run: () => window.dispatchEvent(new CustomEvent('appearance:edit', { detail: { elementId: `tab-${tab.id}` } })) },
    ];
  }

  async function moveToGroup(tab) {
    const name = await promptDialog({
      title: 'Move to a group',
      body: 'Groups collect related destinations in the strip. Enter an existing group name to join it, or a new name to create one.',
      label: 'Group name',
      value: state.groups.find((group) => group.id === tab.groupId)?.name ?? '',
      maxLength: 60,
      confirmLabel: 'Move',
    });
    if (name === null || name.trim().length === 0) return;
    const existing = state.groups.find((group) => group.name === name.trim());
    const group = existing ?? {
      id: `group-${state.groups.length + 1}`,
      name: name.trim(),
      accent: GROUP_ACCENTS[state.groups.length % GROUP_ACCENTS.length],
      collapsed: false,
    };
    apply({ type: 'group', ids: [tab.id], group });
    announce(`${labelOf(tab)} moved to the group ${group.name}.`);
  }

  function renderBulkPreview() {
    const matched = bulkCloseByQuery(state.tabs, bulkFilter.state, labelOf);
    bulkPreview.textContent = matched.length === 0
      ? 'No closable destination matches. Pinned destinations are never included.'
      : `${matched.length} destination${matched.length === 1 ? '' : 's'} would close: ${matched.map(labelOf).join(', ')}.`;
  }

  async function runBulkClose() {
    const matched = bulkCloseByQuery(state.tabs, bulkFilter.state, labelOf);
    if (matched.length === 0) { announce('No closable destination matches that search.'); return; }
    const confirmed = await confirmDialog({
      title: 'Close these destinations?',
      body: `${matched.length} destination${matched.length === 1 ? '' : 's'} will close: ${matched.map(labelOf).join(', ')}. Pinned destinations are not included.`,
      confirmLabel: `Close ${matched.length}`,
      destructive: true,
    });
    if (!confirmed) return;
    for (const tab of matched) state = reduceTabs(state, { type: 'close', id: tab.id });
    render();
    persist();
    if (state.activeId) onActivate(state.activeId);
    announce(`Closed ${matched.length} destination${matched.length === 1 ? '' : 's'}.`);
  }

  function renderOverflow() {
    const { overflow } = computeOverflow(state.tabs, visibleCount());
    const filtered = overflow.filter((tab) => overflowFilter.matches(labelOf(tab)));
    overflowFilter.reportCounts(filtered.length, overflow.length);
    overflowList.replaceChildren(...(filtered.length === 0
      ? [el('p', { class: 'supporting', text: overflow.length === 0 ? 'Every open destination fits in the strip.' : 'No hidden destination matches this filter.' })]
      : filtered.map((tab) => el('button', {
        type: 'button',
        class: 'overflow-item',
        onClick: () => { overflowOpen = false; activate(tab.id); },
      }, labelOf(tab)))));
  }

  function visibleCount() {
    return isVerticalDock(currentDock) ? 12 : 7;
  }

  function render() {
    const ordered = sortTabs(state.tabs);
    const { visible, overflow } = computeOverflow(ordered, visibleCount());
    container.dataset.dock = currentDock;
    list.setAttribute('aria-orientation', isVerticalDock(currentDock) ? 'vertical' : 'horizontal');
    list.replaceChildren(...visible.map((tab) => {
      const destination = byId.get(tab.id);
      const selected = state.activeId === tab.id;
      const group = state.groups.find((entry) => entry.id === tab.groupId) ?? null;
      const button = el('button', {
        type: 'button',
        role: 'tab',
        id: `tab-${tab.id}`,
        class: `tab-item${selected ? ' selected' : ''}`,
        'aria-selected': String(selected),
        'aria-controls': `panel-${tab.id}`,
        tabindex: selected ? '0' : '-1',
        dataset: { tabId: tab.id },
        onClick: () => activate(tab.id),
        onKeyDown: (event) => onKeyDown(event, tab),
      }, [
        el('span', { class: 'tab-icon', 'aria-hidden': 'true', text: destination?.icon ?? '•' }),
        el('span', { class: 'tab-label', text: destination?.label ?? tab.id }),
        tab.pinned ? el('span', { class: 'tab-flag', text: 'Pinned' }) : null,
        group ? el('span', { class: 'tab-flag', text: group.name }) : null,
      ]);
      button.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        showContextMenu(event, tab);
      });
      const close = tab.closable
        ? el('button', {
          type: 'button',
          class: 'tab-close',
          'aria-label': `Close ${destination?.label ?? tab.id}`,
          onClick: (event) => { event.stopPropagation(); apply({ type: 'close', id: tab.id }); if (state.activeId) onActivate(state.activeId); },
        }, '×')
        : null;
      return el('div', { class: 'tab-shell' }, [button, close]);
    }));
    overflowButton.classList.toggle('hidden', overflow.length === 0);
    overflowButton.setAttribute('aria-expanded', String(overflowOpen));
    overflowButton.textContent = `More destinations (${overflow.length})`;
    overflowPanel.classList.toggle('hidden', !overflowOpen);
    renderOverflow();
    renderBulkPreview();
  }

  function showContextMenu(event, tab) {
    const existing = document.querySelector('.tab-context-menu');
    existing?.remove();
    const menu = el('div', { class: 'tab-context-menu', role: 'menu', 'aria-label': `Actions for ${labelOf(tab)}` },
      contextMenuFor(tab).map((item) => el('button', {
        type: 'button',
        role: 'menuitem',
        onClick: () => { menu.remove(); item.run(); },
      }, item.label)));
    menu.style.left = `${Math.min(event.clientX, window.innerWidth - 260)}px`;
    menu.style.top = `${Math.min(event.clientY, window.innerHeight - 240)}px`;
    document.body.append(menu);
    menu.querySelector('button')?.focus();
    const dismiss = (dismissEvent) => {
      if (menu.contains(dismissEvent.target)) return;
      menu.remove();
      document.removeEventListener('pointerdown', dismiss);
    };
    document.addEventListener('pointerdown', dismiss);
    menu.addEventListener('keydown', (keyEvent) => { if (keyEvent.key === 'Escape') { menu.remove(); document.getElementById(`tab-${tab.id}`)?.focus(); } });
  }

  function onKeyDown(event, tab) {
    const nextId = resolveKeyboardMove(state.tabs, tab.id, event.key, currentDock);
    if (nextId) {
      event.preventDefault();
      activate(nextId);
      document.getElementById(`tab-${nextId}`)?.focus();
      return;
    }
    if (event.key === 'Delete' && tab.closable) {
      event.preventDefault();
      apply({ type: 'close', id: tab.id });
      if (state.activeId) onActivate(state.activeId);
    }
  }

  render();

  return {
    element: container,
    open,
    activate,
    get state() { return state; },
    setDock(nextDock) { currentDock = nextDock; render(); },
    isOpen(id) { return state.tabs.some((tab) => tab.id === id); },
    activeId() { return state.activeId; },
  };
}
