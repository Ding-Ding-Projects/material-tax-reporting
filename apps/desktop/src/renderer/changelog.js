'use strict';

/**
 * The changelog viewer.
 *
 * Entries are presented verbatim as the build generated them, including the
 * current unreleased heading and any statement about which checks were and
 * were not run. Nothing here labels an entry a release, a tag or a verified
 * build.
 *
 * A commit link is opened outside the application only after an explicit
 * confirmation, and only when a real commit identifier was recorded.
 */

import { commitUrl, filterChangelogEntries } from '@material-tax-reporting/surface-kernel';
import { confirmDialog, el } from './dom.js';
import { createSearchField } from './regex-builder.js';

export function createChangelogView({ api, container }) {
  let record = { available: false, entries: [], areas: [], commits: [], repository: null, missing: '' };
  let range = { from: '', to: '' };
  let areas = new Set();

  const search = createSearchField({
    id: 'changelog-search',
    label: 'Search changelog entries',
    placeholder: 'Type part of an entry, section or version',
    onChange: () => render(),
  });

  const status = el('p', { class: 'supporting', 'aria-live': 'polite' });
  const areaFilters = el('fieldset', {}, [el('legend', { text: 'Area' })]);
  const list = el('div', { class: 'changelog-list', role: 'list' });
  const commitList = el('div', { class: 'changelog-commits' });

  const fromInput = el('input', { id: 'changelog-from', type: 'date', onChange: (event) => { range.from = event.target.value; render(); } });
  const toInput = el('input', { id: 'changelog-to', type: 'date', onChange: (event) => { range.to = event.target.value; render(); } });

  async function load() {
    const result = await api.changelog.load();
    record = result?.ok ? result.data : { available: false, entries: [], areas: [], commits: [], repository: null, missing: 'The packaged changelog record could not be read.' };
    if (!record.available) {
      status.textContent = record.missing;
      list.replaceChildren();
      return;
    }
    areaFilters.replaceChildren(
      el('legend', { text: 'Area' }),
      ...record.areas.map((area) => el('label', { class: 'inline-check', for: `changelog-area-${area}` }, [
        el('input', {
          id: `changelog-area-${area}`,
          type: 'checkbox',
          onChange: (event) => { if (event.target.checked) areas.add(area); else areas.delete(area); render(); },
        }),
        el('span', { text: area }),
      ])),
    );
    render();
  }

  async function openCommit(sha) {
    const url = commitUrl(record.repository || '', sha);
    if (!url) return;
    const confirmed = await confirmDialog({
      title: 'Open this commit outside the application?',
      body: `This opens ${url} in your browser. The application itself performs no network access.`,
      confirmLabel: 'Open in browser',
    });
    if (!confirmed) return;
    await api.changelog.openCommit({ url, confirmed: true });
  }

  function render() {
    if (!record.available) return;
    const visible = filterChangelogEntries(record.entries, { from: range.from, to: range.to, areas: [...areas] }, search.state);
    search.reportCounts(visible.length, record.entries.length);
    status.textContent = `${visible.length} of ${record.entries.length} entr${record.entries.length === 1 ? 'y' : 'ies'} shown. Entries are presented exactly as generated${record.generatedAt ? ` on ${record.generatedAt}` : ''}.`;
    list.replaceChildren(...(visible.length === 0
      ? [el('div', { class: 'empty card', text: 'No changelog entry matches this filter.' })]
      : visible.map((entry) => el('article', { class: 'changelog-row', role: 'listitem', 'data-appearance-id': 'changelog-row' }, [
        el('div', { class: 'history-meta' }, [
          el('span', { text: entry.area }),
          el('span', { text: entry.version }),
          entry.date ? el('time', { text: entry.date }) : el('span', { text: 'no date recorded' }),
          el('span', { text: entry.section }),
        ]),
        el('p', { text: entry.entry }),
        entry.verification ? el('p', { class: 'supporting', text: `Verification: ${entry.verification}` }) : null,
        entry.commit
          ? el('div', { class: 'history-actions' }, [
            el('code', { text: entry.commit }),
            commitUrl(record.repository || '', entry.commit)
              ? el('button', { type: 'button', class: 'text-button', onClick: () => openCommit(entry.commit) }, 'Open commit link')
              : el('span', { class: 'supporting', text: 'No repository address was recorded, so no link is offered.' }),
          ])
          : el('p', { class: 'supporting', text: 'No commit identifier was recorded for this entry.' }),
      ]))));
    commitList.replaceChildren(
      el('h2', { text: 'Recorded commits for the application paths' }),
      record.commits.length === 0
        ? el('p', { class: 'supporting', text: 'The build recorded no commits for the application paths.' })
        : el('ul', { class: 'match-list' }, record.commits.slice(0, 40).map((commit) => el('li', {}, [
          el('code', { text: commit.sha?.slice(0, 12) ?? '' }),
          el('span', { class: 'supporting', text: ` ${commit.date ?? ''} · ${commit.subject ?? ''}` }),
        ]))),
    );
  }

  container.replaceChildren(
    el('div', { class: 'page-heading' }, [
      el('div', {}, [el('p', { class: 'eyebrow', text: 'Generated by the application build' }), el('h1', { id: 'changelog-heading', text: 'Changelog' })]),
    ]),
    el('div', { class: 'card', id: 'changelog-tools', 'data-appearance-id': 'changelog-tools' }, [
      search.element,
      areaFilters,
      el('div', { class: 'builder-row' }, [
        el('label', { for: 'changelog-from' }, ['From', fromInput]),
        el('label', { for: 'changelog-to' }, ['To', toInput]),
      ]),
      status,
    ]),
    list,
    el('div', { class: 'card' }, [commitList]),
  );

  return { refresh: load, currentRows: () => record.entries };
}
