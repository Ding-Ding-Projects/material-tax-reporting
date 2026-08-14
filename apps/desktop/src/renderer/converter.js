'use strict';

/**
 * The converter destination.
 *
 * Categories list every adapter this build knows about. An adapter that is not
 * bundled stays visible as a disabled row that names exactly what is missing,
 * rather than being hidden.
 *
 * Conversion runs entirely in the privileged boundary, against files the
 * person chose, and output is written only to a folder chosen through a
 * dialog. Converted output is never treated as confirmed tax data.
 */

import { el, formatBytes } from './dom.js';
import { createSearchField } from './regex-builder.js';

export function createConverterView({ api, container, notify, startTransfer }) {
  let catalog = null;
  let selectedAdapter = null;
  let staged = null;

  const search = createSearchField({
    id: 'converter-search',
    label: 'Find a converter',
    placeholder: 'Type part of a converter name or format',
    onChange: () => renderCatalog(),
  });

  const catalogList = el('div', { class: 'converter-catalog' });
  const previewArea = el('div', { class: 'card', id: 'converter-preview', 'data-appearance-id': 'converter-preview' });
  const boundary = el('p', { class: 'supporting' });

  async function load() {
    const result = await api.converter.catalog();
    if (!result?.ok) { catalogList.replaceChildren(el('p', { class: 'error-text', text: result?.error?.message || 'The converter catalogue could not be read.' })); return; }
    catalog = result.data;
    boundary.textContent = catalog.boundary;
    renderCatalog();
  }

  function renderCatalog() {
    if (!catalog) return;
    const all = catalog.categories.flatMap((category) => category.adapters);
    const visible = all.filter((adapter) => search.matches(`${adapter.label} ${adapter.sourceType} ${adapter.targetType} ${adapter.category}`));
    search.reportCounts(visible.length, all.length);
    catalogList.replaceChildren(...catalog.categories.map((category) => {
      const rows = category.adapters.filter((adapter) => visible.includes(adapter));
      if (rows.length === 0) return null;
      return el('section', { class: 'converter-category' }, [
        el('h2', { text: category.name }),
        el('div', { role: 'group', 'aria-label': `${category.name} converters` }, rows.map((adapter) => el('div', {
          class: `converter-row${adapter.enabled ? '' : ' disabled'}`,
          'data-appearance-id': 'converter-row',
        }, [
          el('div', {}, [
            el('strong', { text: adapter.label }),
            el('p', { class: 'supporting', text: `${adapter.sourceType} to ${adapter.targetType}` }),
            adapter.enabled ? null : el('p', { class: 'error-text', text: adapter.missing }),
          ]),
          el('button', {
            type: 'button',
            class: adapter.id === selectedAdapter ? 'filled' : 'tonal',
            disabled: !adapter.enabled,
            'aria-disabled': String(!adapter.enabled),
            onClick: () => { selectedAdapter = adapter.id; renderCatalog(); },
          }, adapter.enabled ? (adapter.id === selectedAdapter ? 'Selected' : 'Use this converter') : 'Unavailable'),
        ]))),
      ]);
    }).filter(Boolean));
    renderPreview();
  }

  async function choose() {
    if (!selectedAdapter) { notify('Choose a converter first', 'Select a bundled converter before choosing files.', 'error'); return; }
    const result = await api.converter.preview({ adapterId: selectedAdapter });
    if (!result?.ok) { notify('No files were staged', result?.error?.message || 'The chosen files could not be inspected.', 'error'); return; }
    staged = result.data;
    renderPreview();
  }

  function renderPreview() {
    if (!staged) {
      previewArea.replaceChildren(
        el('h2', { text: 'Files to convert' }),
        el('p', { class: 'supporting', text: 'No files are staged. Choose a converter, then choose the files you want to convert.' }),
        el('button', { type: 'button', class: 'tonal', onClick: choose }, 'Choose files'),
        boundary,
      );
      return;
    }
    previewArea.replaceChildren(
      el('h2', { text: 'Files to convert' }),
      el('p', { class: 'supporting', text: `${staged.convertible} of ${staged.files.length} staged file(s) can be converted with the chosen converter.` }),
      el('ul', { class: 'match-list' }, staged.files.map((file) => el('li', {}, [
        el('strong', { text: file.displayName }),
        el('span', { class: 'supporting', text: ` ${file.bytes === null ? 'size unavailable' : formatBytes(file.bytes)} · ${file.detectedType || 'unrecognized format'}` }),
        file.blocker ? el('p', { class: 'error-text', text: file.blocker }) : null,
      ]))),
      el('div', { class: 'button-row' }, [
        el('button', { type: 'button', class: 'tonal', onClick: choose }, 'Choose different files'),
        el('button', {
          type: 'button',
          class: 'filled',
          disabled: staged.convertible === 0,
          onClick: () => startTransfer({ kind: 'converter-output', jobId: staged.jobId }),
        }, 'Choose a destination folder and convert'),
        el('button', {
          type: 'button',
          class: 'text-button',
          onClick: async () => { await api.converter.cancel(staged.jobId); staged = null; renderPreview(); },
        }, 'Cancel this batch'),
      ]),
      boundary,
    );
  }

  container.replaceChildren(
    el('div', { class: 'page-heading' }, [
      el('div', {}, [el('p', { class: 'eyebrow', text: 'Offline and local' }), el('h1', { id: 'converter-heading', text: 'Converter' })]),
    ]),
    el('div', { class: 'card' }, [search.element]),
    catalogList,
    previewArea,
  );

  return { refresh: load, clearStaged: () => { staged = null; renderPreview(); } };
}
