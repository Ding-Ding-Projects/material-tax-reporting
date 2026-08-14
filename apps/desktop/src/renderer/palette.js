'use strict';

/**
 * The command palette.
 *
 * It opens with Control, Shift and F, and from a visible title-bar button so
 * pointer and touch users are not shortcut-only. Coverage is asserted rather
 * than assumed: every preference key without a command is reported in the
 * palette itself.
 *
 * A setting or appearance result is operable inline in its own row. Selecting
 * any other result teleports to the exact element: the owning destination is
 * opened or focused, the element is scrolled into view, and focus moves to it.
 */

import {
  CommandRegistry,
  DENSITIES,
  DOCKS,
  LANGUAGE_MODES,
  MAX_FONT_SCALE,
  MAX_FUNNY_LEVEL,
  MIN_FONT_SCALE,
  MIN_FUNNY_LEVEL,
  MOTION_CHOICES,
  PREFERENCE_KEYS,
  THEMES,
  assertCommandCoverage,
  searchCommands,
  teleportTarget,
} from '@material-tax-reporting/surface-kernel';
import { $, announce, el, trapFocus } from './dom.js';
import { createSearchField } from './regex-builder.js';

const options = (values) => values.map((value) => ({ value, label: value }));

export function createCommandPalette({ api, getSettings, updatePreference, destinations, steps, openDestination, openAppearance, projectActions, historyActions }) {
  const registry = new CommandRegistry();
  let releaseTrap = null;
  let results = [];
  let activeIndex = 0;

  for (const destination of destinations) {
    registry.register({
      id: `destination:${destination.id}`,
      label: `Open ${destination.label}`,
      detail: destination.description || `Open the ${destination.label} destination.`,
      surface: 'Destinations',
      kind: 'navigate',
      tab: destination.id,
      target: `panel-${destination.id}`,
    });
  }

  steps.forEach((step, index) => {
    registry.register({
      id: `wizard:${step.id}`,
      label: `Guided report question ${index + 1}`,
      detail: step.paletteDetail,
      surface: 'Guided report',
      kind: 'navigate',
      tab: 'wizard',
      target: 'question-card',
    });
  });

  for (const action of projectActions) {
    registry.register({ id: `project:${action.id}`, label: action.label, detail: action.detail, surface: 'Project', kind: 'navigate', tab: action.tab, target: action.target });
  }
  for (const action of historyActions) {
    registry.register({ id: `history:${action.id}`, label: action.label, detail: action.detail, surface: 'History', kind: 'navigate', tab: 'history', target: action.target });
  }

  const settingCommands = [
    { key: 'dock', label: 'Tab strip edge', control: { control: 'segmented', preferenceKey: 'dock', options: options([...DOCKS]) } },
    { key: 'theme', label: 'Theme', control: { control: 'segmented', preferenceKey: 'theme', options: options([...THEMES]) } },
    { key: 'density', label: 'Density', control: { control: 'segmented', preferenceKey: 'density', options: options([...DENSITIES]) } },
    { key: 'accent', label: 'Accent colour', control: { control: 'colour', preferenceKey: 'accent' } },
    { key: 'fontScale', label: 'Text size', control: { control: 'range', preferenceKey: 'fontScale', min: MIN_FONT_SCALE, max: MAX_FONT_SCALE, step: 0.05 } },
    { key: 'motion', label: 'Motion', control: { control: 'segmented', preferenceKey: 'motion', options: options([...MOTION_CHOICES]) } },
    { key: 'language', label: 'Language mode', control: { control: 'select', preferenceKey: 'language', options: options([...LANGUAGE_MODES]) } },
    { key: 'englishFunny', label: 'English humour level', control: { control: 'range', preferenceKey: 'englishFunny', min: MIN_FUNNY_LEVEL, max: MAX_FUNNY_LEVEL, step: 1 } },
    { key: 'cantoneseFunny', label: 'Cantonese humour level', control: { control: 'range', preferenceKey: 'cantoneseFunny', min: MIN_FUNNY_LEVEL, max: MAX_FUNNY_LEVEL, step: 1 } },
    { key: 'dialogEmoji', label: 'Decorative dialog emoji', control: { control: 'switch', preferenceKey: 'dialogEmoji' } },
    { key: 'displayName', label: 'Application display name', control: { control: 'select', preferenceKey: 'displayName', options: [] } },
    { key: 'logo', label: 'Application logo', control: { control: 'select', preferenceKey: 'logo', options: [] } },
    { key: 'narration', label: 'Read aloud', control: { control: 'switch', preferenceKey: 'narration' } },
  ];

  for (const setting of settingCommands) {
    registry.register({
      id: `setting:${setting.key}`,
      label: setting.label,
      detail: `Change ${setting.label.toLowerCase()} without leaving this list.`,
      surface: 'Settings',
      kind: 'control',
      tab: 'settings',
      target: `setting-${setting.key}`,
      control: setting.control,
    });
  }

  registry.register({
    id: 'appearance:open-editor',
    label: 'Edit appearance of an element',
    detail: 'Open the appearance editor and choose any element with a stable identifier.',
    surface: 'Appearance',
    kind: 'navigate',
    tab: 'appearance',
    target: 'appearance-destination',
  });

  const uncovered = assertCommandCoverage([...PREFERENCE_KEYS], registry);

  const searchField = createSearchField({
    id: 'palette-search',
    label: 'Search every command',
    placeholder: 'Type part of a command, setting or question',
    onChange: () => renderResults(),
  });

  const resultList = el('div', { class: 'palette-results', role: 'listbox', 'aria-label': 'Command results', id: 'palette-results' });
  const coverage = el('p', { class: 'supporting' , text: uncovered.length === 0
    ? 'Every personalization setting is reachable from this list.'
    : `These settings have no command yet: ${uncovered.join(', ')}.` });

  const dialog = el('dialog', { id: 'command-palette', 'aria-labelledby': 'command-palette-title' }, [
    el('div', { class: 'dialog-card' }, [
      el('h2', { id: 'command-palette-title', text: 'Command palette' }),
      el('p', { class: 'supporting', text: 'Press Control, Shift and F at any time. Use the Up and Down arrows, then Enter. Escape returns focus to where you were.' }),
      searchField.element,
      resultList,
      coverage,
    ]),
  ]);
  document.body.append(dialog);

  function inlineControl(command) {
    const settings = getSettings();
    const key = command.control.preferenceKey;
    const value = settings?.preferences?.[key];
    const id = `${command.target}-input`;
    if (command.control.control === 'switch') {
      const checked = key === 'narration' ? Boolean(value?.enabled) : value === true;
      return el('label', { class: 'inline-check', for: id }, [
        el('input', {
          id,
          type: 'checkbox',
          checked,
          onChange: (event) => updatePreference(key === 'narration' ? { narration: { ...settings.preferences.narration, enabled: event.target.checked } } : { [key]: event.target.checked }),
        }),
        el('span', { text: command.label }),
      ]);
    }
    if (command.control.control === 'range') {
      return el('label', { for: id }, [command.label, el('input', {
        id,
        type: 'range',
        min: String(command.control.min),
        max: String(command.control.max),
        step: String(command.control.step),
        value: String(value ?? command.control.min),
        onChange: (event) => updatePreference({ [key]: Number(event.target.value) }),
      })]);
    }
    if (command.control.control === 'colour') {
      return el('label', { for: id }, [command.label, el('input', {
        id,
        type: 'color',
        value: String(value ?? '#4355b9'),
        onChange: (event) => updatePreference({ [key]: event.target.value }),
      })]);
    }
    if (command.control.options.length === 0) {
      return el('button', {
        id,
        type: 'button',
        class: 'tonal',
        onClick: () => { close(); openDestination('settings', `setting-${key}`); },
      }, `Open ${command.label} in Settings`);
    }
    return el('label', { for: id }, [command.label, el('select', {
      id,
      onChange: (event) => updatePreference({ [key]: event.target.value }),
    }, command.control.options.map((option) => el('option', { value: option.value, selected: option.value === value, text: option.label })))]);
  }

  function renderResults() {
    results = searchCommands(registry, searchField.state);
    searchField.reportCounts(results.length, registry.list().length);
    activeIndex = Math.min(activeIndex, Math.max(0, results.length - 1));
    resultList.replaceChildren(...(results.length === 0
      ? [el('p', { class: 'supporting', text: 'No command matches this search.' })]
      : results.map((command, index) => el('div', {
        class: `palette-row${index === activeIndex ? ' active' : ''}`,
        role: 'option',
        id: `palette-row-${index}`,
        'aria-selected': String(index === activeIndex),
      }, [
        el('div', { class: 'palette-row-main' }, [
          el('strong', { text: command.label }),
          el('span', { class: 'supporting', text: `${command.surface} · ${command.detail}` }),
        ]),
        command.kind === 'control'
          ? inlineControl(command)
          : el('button', { type: 'button', class: 'tonal', onClick: () => run(command) }, 'Go there'),
      ]))));
  }

  function run(command) {
    close();
    const target = teleportTarget(command);
    if (command.id === 'appearance:open-editor') { openAppearance(null); return; }
    openDestination(command.tab, target.preferInputId || target.elementId);
    announce(`Moved to ${command.label}.`);
  }

  function open() {
    renderResults();
    dialog.showModal();
    releaseTrap = trapFocus(dialog, close);
    searchField.focus();
  }

  function close() {
    releaseTrap?.();
    releaseTrap = null;
    if (dialog.open) dialog.close();
  }

  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); activeIndex = Math.min(activeIndex + 1, results.length - 1); renderResults(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); renderResults(); }
    else if (event.key === 'Enter' && results[activeIndex] && results[activeIndex].kind === 'navigate') { event.preventDefault(); run(results[activeIndex]); }
  });

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.shiftKey && (event.key === 'F' || event.key === 'f')) {
      event.preventDefault();
      if (dialog.open) close(); else open();
    }
  });

  return { open, close, registry, uncovered, refresh: renderResults };
}
