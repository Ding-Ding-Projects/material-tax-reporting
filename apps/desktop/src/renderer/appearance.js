'use strict';

/**
 * The appearance editor.
 *
 * Every rendered element that can be restyled carries a stable identifier. The
 * editor is opened from an element context menu, from a tab or group context
 * menu, and from command-palette results, and it writes bounded custom
 * properties through the privileged boundary.
 *
 * A colour is translated across every space the shared kernel supports, and an
 * out-of-gamut value is reported honestly instead of being clamped. An
 * override that would make a required disclosure unreadable is refused by the
 * privileged boundary and the refusal is shown here.
 */

import {
  APPEARANCE_PROPERTIES,
  contrastRatio,
  convertColor,
  formatColor,
  isOutOfGamut,
  parseColor,
  wcagVerdict,
} from '@material-tax-reporting/surface-kernel';
import { $, announce, el, trapFocus } from './dom.js';
import { createSearchField } from './regex-builder.js';

const COLOR_SPACES = ['hex', 'rgb', 'hsl', 'hwb', 'lab', 'lch', 'oklab', 'oklch'];

const PROPERTY_LABELS = {
  '--element-font-family': 'Font family',
  '--element-font-size': 'Font size',
  '--element-font-weight': 'Font weight',
  '--element-line-height': 'Line height',
  '--element-letter-spacing': 'Letter spacing',
  '--element-text-transform': 'Letter case',
  '--element-surface': 'Background colour',
  '--element-on-surface': 'Text colour',
  '--element-outline': 'Outline colour',
  '--element-accent': 'Accent colour',
  '--element-radius': 'Corner radius',
  '--element-padding': 'Padding',
};

/** Faces that ship with the application, plus the common system stacks. */
const FONT_CHOICES = [
  'system-ui, sans-serif',
  '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
  'Georgia, "Times New Roman", serif',
  '"Cascadia Mono", "Consolas", ui-monospace, monospace',
  'Verdana, Geneva, sans-serif',
];

const CASE_CHOICES = ['none', 'uppercase', 'lowercase', 'capitalize'];

/**
 * Text alignment is not one of the shared kernel's overridable properties, so
 * this editor does not offer it rather than offering a control that would
 * always be refused.
 */
const ALIGNMENT_NOTE = 'Text alignment is not one of the overridable properties in this build, so it is not offered here.';

/** Applies the stored overrides to the document as inline custom properties. */
export function applyAppearance(store) {
  for (const node of document.querySelectorAll('[data-appearance-applied]')) {
    for (const property of APPEARANCE_PROPERTIES) node.style.removeProperty(property);
    node.removeAttribute('data-appearance-applied');
  }
  for (const [elementId, properties] of Object.entries(store || {})) {
    const node = document.getElementById(elementId);
    if (!node) continue;
    node.dataset.appearanceApplied = 'true';
    for (const [property, value] of Object.entries(properties)) node.style.setProperty(property, value);
  }
}

export function createAppearanceEditor({ api, getSettings, refresh, notify }) {
  let elementId = null;
  let releaseTrap = null;

  const title = el('h2', { id: 'appearance-editor-title', text: 'Edit appearance' });
  const subject = el('p', { class: 'supporting' });
  const refusal = el('p', { class: 'error-text', role: 'alert' });
  const controls = el('div', { class: 'appearance-controls' });
  const colourReadout = el('div', { class: 'colour-readout' });
  const contrastReadout = el('p', { class: 'supporting' });

  const elementFilter = createSearchField({
    id: 'appearance-element-filter',
    label: 'Find an element by identifier',
    placeholder: 'Type part of an element identifier',
    onChange: () => renderElementList(),
  });
  const elementList = el('div', { class: 'appearance-element-list', role: 'group', 'aria-label': 'Elements with a stable identifier' });

  const dialog = el('dialog', { id: 'appearance-editor', 'aria-labelledby': 'appearance-editor-title' }, [
    el('div', { class: 'dialog-card' }, [
      title,
      subject,
      refusal,
      elementFilter.element,
      elementList,
      controls,
      colourReadout,
      contrastReadout,
      el('div', { class: 'dialog-actions' }, [
        el('button', { type: 'button', class: 'text-button', onClick: () => resetProperty() }, 'Reset one property'),
        el('button', { type: 'button', class: 'text-button', onClick: () => resetElement() }, 'Reset this element'),
        el('button', { type: 'button', class: 'tonal', onClick: () => exportPreset() }, 'Export preset'),
        el('button', { type: 'button', class: 'tonal', onClick: () => importPreset() }, 'Import preset'),
        el('button', { type: 'button', class: 'filled', onClick: () => close() }, 'Close'),
      ]),
    ]),
  ]);
  document.body.append(dialog);

  let selectedProperty = APPEARANCE_PROPERTIES[0];

  function knownElements() {
    return [...document.querySelectorAll('[data-appearance-id]')].map((node) => node.dataset.appearanceId);
  }

  function renderElementList() {
    const all = [...new Set(knownElements())].sort();
    const filtered = all.filter((id) => elementFilter.matches(id));
    elementFilter.reportCounts(filtered.length, all.length);
    elementList.replaceChildren(...(filtered.length === 0
      ? [el('p', { class: 'supporting', text: 'No element identifier matches this search.' })]
      : filtered.slice(0, 60).map((id) => el('button', {
        type: 'button',
        class: `overflow-item${id === elementId ? ' selected' : ''}`,
        onClick: () => { elementId = id; render(); },
      }, id))));
  }

  function currentOverrides() {
    return (getSettings()?.appearance || {})[elementId] || {};
  }

  function renderColour(value) {
    const parsed = parseColor(value);
    if ('error' in parsed) {
      colourReadout.replaceChildren(el('p', { class: 'supporting', text: parsed.error }));
      contrastReadout.textContent = '';
      return;
    }
    colourReadout.replaceChildren(
      el('h3', { text: 'The same colour in every supported space' }),
      el('ul', { class: 'match-list' }, COLOR_SPACES.map((space) => {
        const converted = convertColor(parsed, space);
        const outOfGamut = isOutOfGamut(converted, space);
        return el('li', {}, [
          el('code', { text: formatColor(converted, space) }),
          el('span', { class: outOfGamut ? 'error-text' : 'supporting', text: outOfGamut ? ' · outside the displayable range for this space; the value is reported as it is, not clamped' : ' · inside the displayable range' }),
        ]);
      })),
    );
    const surface = parseColor(currentOverrides()['--element-surface'] || '#fdfbff');
    if (!('error' in surface)) {
      const ratio = contrastRatio(parsed, surface);
      contrastReadout.textContent = `Contrast with this element's background: ${ratio.toFixed(2)} to 1 (${wcagVerdict(ratio, 'normal')}).`;
    }
  }

  function control(property) {
    const value = currentOverrides()[property] || '';
    const id = `appearance-${property.replace(/[^a-z]+/g, '-')}`;
    if (property === '--element-font-family') {
      return el('label', { for: id }, [PROPERTY_LABELS[property], el('select', {
        id,
        onChange: (event) => save(property, event.target.value),
      }, [el('option', { value: '', text: 'Inherit the shipped face' }), ...FONT_CHOICES.map((face) => el('option', { value: face, selected: face === value, text: face }))])]);
    }
    if (property === '--element-text-transform') {
      return el('label', { for: id }, [PROPERTY_LABELS[property], el('select', {
        id,
        onChange: (event) => save(property, event.target.value),
      }, CASE_CHOICES.map((choice) => el('option', { value: choice, selected: choice === value, text: choice })))]);
    }
    const input = el('input', {
      id,
      value,
      maxlength: '120',
      onChange: (event) => save(property, event.target.value),
      onInput: (event) => { if (property.endsWith('colour') || property.includes('surface') || property.includes('accent') || property.includes('outline')) renderColour(event.target.value); },
    });
    return el('label', { for: id }, [PROPERTY_LABELS[property] || property, input]);
  }

  function render() {
    subject.textContent = elementId
      ? `Editing the element "${elementId}". Overrides are stored in the application preference record and never in a project file.`
      : 'Choose an element to edit. Every element with a stable identifier can be restyled.';
    renderElementList();
    controls.replaceChildren(
      el('label', { for: 'appearance-property' }, ['Property to reset', el('select', {
        id: 'appearance-property',
        onChange: (event) => { selectedProperty = event.target.value; },
      }, APPEARANCE_PROPERTIES.map((property) => el('option', { value: property, selected: property === selectedProperty, text: PROPERTY_LABELS[property] })))]),
      ...(elementId ? APPEARANCE_PROPERTIES.map((property) => control(property)) : []),
      el('p', { class: 'supporting', text: ALIGNMENT_NOTE }),
    );
    const colourValue = currentOverrides()['--element-on-surface'];
    if (colourValue) renderColour(colourValue); else { colourReadout.replaceChildren(); contrastReadout.textContent = ''; }
  }

  async function save(property, value) {
    if (!elementId) return;
    refusal.textContent = '';
    const result = await api.settings.update({ appearance: [{ elementId, property, value }] });
    if (!result?.ok) { refusal.textContent = result?.error?.message || 'The override was not saved.'; return; }
    if (Array.isArray(result.data.refused) && result.data.refused.length > 0) {
      refusal.textContent = result.data.refused.map((entry) => entry.reason).join(' ');
      announce(refusal.textContent);
    } else {
      notify('Appearance updated', `The override for ${elementId} was saved.`);
    }
    await refresh();
    render();
  }

  async function resetProperty() {
    if (!elementId) return;
    const result = await api.settings.resetAppearance({ elementId, property: selectedProperty });
    if (result?.ok) { await refresh(); render(); announce(`Reset ${selectedProperty} on ${elementId}.`); }
  }

  async function resetElement() {
    if (!elementId) return;
    const result = await api.settings.resetAppearance({ elementId });
    if (result?.ok) { await refresh(); render(); announce(`Reset every override on ${elementId}.`); }
  }

  async function exportPreset() {
    const result = await api.settings.exportPreset({ name: 'Appearance preset' });
    if (result?.ok) notify('Preset saved', `${result.data.fileName} was written with ${result.data.bytes} bytes.`);
  }

  async function importPreset() {
    const result = await api.settings.importPreset();
    if (!result?.ok) { refusal.textContent = result?.error?.message || 'The preset was not imported.'; return; }
    if (Array.isArray(result.data.refused) && result.data.refused.length > 0) {
      refusal.textContent = result.data.refused.map((entry) => entry.reason).join(' ');
    }
    await refresh();
    render();
  }

  function open(nextElementId) {
    elementId = nextElementId || elementId;
    render();
    dialog.showModal();
    releaseTrap = trapFocus(dialog, close);
    $('#appearance-element-filter-input')?.focus();
  }

  function close() {
    releaseTrap?.();
    releaseTrap = null;
    dialog.close();
  }

  window.addEventListener('appearance:edit', (event) => open(event.detail?.elementId));

  return { open, close, render };
}

/**
 * Attaches a context menu to every element that carries a stable identifier,
 * so an appearance edit is reachable by pointer, keyboard and touch.
 */
export function wireElementContextMenus(openEditor) {
  const handler = (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-appearance-id]') : null;
    if (!target) return;
    event.preventDefault();
    const menu = el('div', { class: 'tab-context-menu', role: 'menu', 'aria-label': `Actions for ${target.dataset.appearanceId}` }, [
      el('button', { type: 'button', role: 'menuitem', onClick: () => { menu.remove(); openEditor(target.dataset.appearanceId); } }, 'Edit appearance'),
    ]);
    menu.style.left = `${Math.min(event.clientX, window.innerWidth - 240)}px`;
    menu.style.top = `${Math.min(event.clientY, window.innerHeight - 120)}px`;
    document.body.append(menu);
    menu.querySelector('button')?.focus();
    const dismiss = (dismissEvent) => {
      if (menu.contains(dismissEvent.target)) return;
      menu.remove();
      document.removeEventListener('pointerdown', dismiss);
    };
    document.addEventListener('pointerdown', dismiss);
  };
  document.addEventListener('contextmenu', handler);
  document.addEventListener('keydown', (event) => {
    if (!event.shiftKey || event.key !== 'F10') return;
    const target = document.activeElement instanceof Element ? document.activeElement.closest('[data-appearance-id]') : null;
    if (!target) return;
    event.preventDefault();
    openEditor(target.dataset.appearanceId);
  });
}
