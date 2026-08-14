'use strict';

/**
 * The one reusable anchored search builder.
 *
 * Every search, filter, lookup, picker and menu filter in the application
 * creates its own instance, so each owns its pattern, flags, validation
 * message, sample text, live match list and capture-group readout. Plain text
 * is the default, so a person who never opens a builder sees an ordinary
 * search box.
 *
 * The engine itself is the shared kernel engine; nothing here reimplements
 * matching.
 */

import {
  BUILDER_TOKENS,
  MAX_PATTERN_LENGTH,
  MAX_SAMPLE_LENGTH,
  analyzeSearchPattern,
  createSearchState,
  describeSearch,
  insertToken,
  matchesSearch,
  validateFlags,
} from '@material-tax-reporting/surface-kernel';
import { el } from './dom.js';

let sequence = 0;

/**
 * Creates a search field with its own builder.
 *
 * `onChange` is called whenever the state changes, so the owning surface can
 * refilter its own collection.
 */
export function createSearchField({ id, label, placeholder = '', onChange = () => {}, initial = {} }) {
  sequence += 1;
  const fieldId = id || `search-${sequence}`;
  let state = createSearchState(initial);
  // The first paint must not notify: the owning surface is still being built,
  // and its own render function may not exist yet.
  let notifying = false;

  const input = el('input', {
    id: `${fieldId}-input`,
    type: 'search',
    placeholder,
    value: state.query,
    'aria-describedby': `${fieldId}-description`,
    onInput: () => {
      if (state.regex) state = { ...state, pattern: input.value.slice(0, MAX_PATTERN_LENGTH) };
      else state = { ...state, query: input.value };
      update();
    },
  });

  const regexToggle = el('input', {
    id: `${fieldId}-regex`,
    type: 'checkbox',
    onChange: () => {
      state = { ...state, regex: regexToggle.checked, builderOpen: regexToggle.checked ? true : state.builderOpen };
      input.value = state.regex ? state.pattern : state.query;
      update();
    },
  });

  const flags = el('input', {
    id: `${fieldId}-flags`,
    maxlength: '8',
    value: state.flags,
    'aria-describedby': `${fieldId}-flag-verdict`,
    onInput: () => { state = { ...state, flags: flags.value }; update(); },
  });

  const sample = el('textarea', {
    id: `${fieldId}-sample`,
    maxlength: String(MAX_SAMPLE_LENGTH),
    rows: '3',
    onInput: () => { state = { ...state, sample: sample.value }; update(); },
  });

  const description = el('p', { id: `${fieldId}-description`, class: 'supporting' });
  const flagVerdict = el('p', { id: `${fieldId}-flag-verdict`, class: 'supporting' });
  const feedback = el('p', { class: 'supporting' });
  const matchList = el('ul', { class: 'match-list' });
  const counts = el('p', { class: 'supporting', 'aria-live': 'polite' });

  const tokens = el('div', { class: 'token-palette', role: 'group', 'aria-label': 'Pattern building blocks' },
    BUILDER_TOKENS.map((token) => el('button', {
      type: 'button',
      class: 'text-button token',
      title: token.detail,
      'aria-label': `${token.label}. ${token.detail}`,
      onClick: () => {
        state = insertToken(state, token);
        regexToggle.checked = true;
        input.value = state.pattern;
        update();
      },
    }, token.label)),
  );

  const builder = el('div', { class: 'builder hidden', id: `${fieldId}-builder` }, [
    el('div', { class: 'builder-row' }, [
      el('label', { for: `${fieldId}-flags` }, ['Flags', flags]),
      el('label', { for: `${fieldId}-sample` }, ['Sample text', sample]),
    ]),
    tokens,
    flagVerdict,
    feedback,
    matchList,
  ]);

  const builderToggle = el('button', {
    type: 'button',
    class: 'text-button',
    'aria-expanded': 'false',
    'aria-controls': `${fieldId}-builder`,
    onClick: () => {
      state = { ...state, builderOpen: !state.builderOpen };
      update();
    },
  }, 'Pattern builder');

  const element = el('div', { class: 'search-field', id: fieldId }, [
    el('label', { for: `${fieldId}-input` }, [label, input]),
    el('div', { class: 'search-controls' }, [
      el('label', { class: 'inline-check', for: `${fieldId}-regex` }, [regexToggle, el('span', { text: 'Pattern search' })]),
      builderToggle,
    ]),
    description,
    counts,
    builder,
  ]);

  function update() {
    description.textContent = describeSearch(state);
    builder.classList.toggle('hidden', !state.builderOpen);
    builderToggle.setAttribute('aria-expanded', String(state.builderOpen));
    const verdict = validateFlags(state.flags);
    flagVerdict.textContent = verdict.ok ? `Flags "${state.flags}" are accepted.` : verdict.reason;
    flagVerdict.classList.toggle('error-text', !verdict.ok);
    const analysis = analyzeSearchPattern(state);
    feedback.textContent = analysis.feedback;
    matchList.replaceChildren(...analysis.matches.map((match) => el('li', {}, [
      el('code', { text: match.value || '(empty match)' }),
      el('span', { class: 'supporting', text: ` at index ${match.index}${match.groups.length > 0 ? ` · captures: ${match.groups.map((group, index) => `${index + 1}=${group || '(empty)'}`).join(', ')}` : ' · no capture groups'}` }),
    ])));
    if (notifying) onChange(state);
  }

  update();
  notifying = true;

  return {
    element,
    get state() { return state; },
    setState(patch) { state = { ...state, ...patch }; input.value = state.regex ? state.pattern : state.query; regexToggle.checked = state.regex; flags.value = state.flags; update(); },
    /** Applies this field's state to one candidate string. */
    matches(value) { return matchesSearch(String(value ?? ''), state); },
    /** Reports how many of a collection are visible under the current search. */
    reportCounts(visible, total) {
      counts.textContent = `Showing ${visible} of ${total}.`;
    },
    describe() { return describeSearch(state); },
    focus() { input.focus(); },
  };
}
