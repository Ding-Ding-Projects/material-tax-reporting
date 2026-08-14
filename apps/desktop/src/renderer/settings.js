'use strict';

/**
 * The settings destination.
 *
 * Everything a person can personalize lives here with a stable element
 * identifier, so the command palette can teleport straight to a control and
 * the appearance editor can restyle it.
 *
 * Renaming and the logo are presentation only. The About card says so plainly,
 * because a renamed application still opens the same project files.
 */

import {
  DENSITIES,
  DOCKS,
  LANGUAGE_MODES,
  MAX_FONT_SCALE,
  MAX_FUNNY_LEVEL,
  MIN_FONT_SCALE,
  MIN_FUNNY_LEVEL,
  MOTION_CHOICES,
  THEMES,
  describeLogoSelection,
} from '@material-tax-reporting/surface-kernel';
import { announce, confirmDialog, el } from './dom.js';
import { createSearchField } from './regex-builder.js';

const LANGUAGE_LABELS = { en: 'English', zh: 'Hong Kong-style Cantonese', both: 'Both languages together' };

export function createSettingsView({ api, container, getSettings, updatePreference, refresh, notify, narrator, copy, openAppearance }) {
  const search = createSearchField({
    id: 'settings-search',
    label: 'Search every setting',
    placeholder: 'Type part of a setting name',
    onChange: () => render(),
  });

  const grid = el('div', { class: 'settings-grid' });
  const externalStatus = el('p', { class: 'supporting', 'aria-live': 'polite' });

  function group(id, title, description, controls) {
    return { id, title, description, controls };
  }

  function segmented(key, label, values, describe = (value) => value) {
    const settings = getSettings();
    return el('div', { class: 'setting-row', id: `setting-${key}`, 'data-appearance-id': `setting-${key}` }, [
      el('fieldset', {}, [
        el('legend', { text: label }),
        ...values.map((value) => el('label', { class: 'inline-check', for: `setting-${key}-${value}` }, [
          el('input', {
            id: `setting-${key}-${value}`,
            type: 'radio',
            name: `setting-${key}`,
            checked: settings.preferences[key] === value,
            onChange: () => updatePreference({ [key]: value }),
          }),
          el('span', { text: describe(value) }),
        ])),
      ]),
    ]);
  }

  function range(key, label, min, max, step, help) {
    const settings = getSettings();
    return el('div', { class: 'setting-row', id: `setting-${key}`, 'data-appearance-id': `setting-${key}` }, [
      el('label', { for: `setting-${key}-input` }, [label, el('input', {
        id: `setting-${key}-input`,
        type: 'range',
        min: String(min),
        max: String(max),
        step: String(step),
        value: String(settings.preferences[key]),
        'aria-describedby': help ? `setting-${key}-help` : null,
        onChange: (event) => updatePreference({ [key]: Number(event.target.value) }),
      })]),
      el('p', { class: 'supporting', text: `Current value: ${settings.preferences[key]}` }),
      help ? el('p', { id: `setting-${key}-help`, class: 'supporting', text: help }) : null,
    ]);
  }

  function switchRow(key, label, help) {
    const settings = getSettings();
    return el('div', { class: 'setting-row', id: `setting-${key}`, 'data-appearance-id': `setting-${key}` }, [
      el('label', { class: 'inline-check', for: `setting-${key}-input` }, [
        el('input', {
          id: `setting-${key}-input`,
          type: 'checkbox',
          checked: settings.preferences[key] === true,
          onChange: (event) => updatePreference({ [key]: event.target.checked }),
        }),
        el('span', { text: label }),
      ]),
      help ? el('p', { class: 'supporting', text: help }) : null,
    ]);
  }

  function vocabularyControls() {
    const status = getSettings().vocabularyStatus;
    const modeNameInput = el('input', { id: 'setting-shared-mode-name', maxlength: '60', value: status.sharedModeName });
    return el('div', { class: 'setting-row', id: 'setting-vocabulary', 'data-appearance-id': 'setting-vocabulary' }, [
      el('h3', { text: 'Personal vocabulary (local JSON)' }),
      el('p', { class: 'supporting', text: status.schemaSummary }),
      el('p', { class: 'supporting', text: status.confidentiality }),
      el('p', { class: 'supporting', text: status.available
        ? `A vocabulary file is in use: ${status.sourceName || 'an accepted file'} with ${status.entryCount} replacement(s), accepted on ${status.acceptedAt}.`
        : 'No vocabulary file has been accepted yet. The shipped wording is in use, and the original wording stays in place until a file passes validation.' }),
      el('div', { class: 'button-row' }, [
        el('button', { type: 'button', class: 'tonal', onClick: async () => {
          const result = await api.vocabulary.choose();
          if (!result?.ok) { notify('Vocabulary not accepted', `${result.error.message} ${result.error.recovery ?? ''}`, 'error'); return; }
          await refresh();
          notify('Vocabulary accepted', 'The wording map was validated and is now in use.');
        } }, 'Choose a vocabulary file'),
        el('button', { type: 'button', class: 'text-button', onClick: async () => {
          const confirmed = await confirmDialog({ title: 'Remove the vocabulary?', body: 'The shipped wording returns immediately. The file on your computer is not touched.', confirmLabel: 'Remove' });
          if (!confirmed) return;
          await api.vocabulary.clear();
          await refresh();
        } }, 'Remove the accepted vocabulary'),
      ]),
      el('h3', { text: 'Shared computer mode' }),
      el('p', { class: 'supporting', text: 'While this mode is on, the non-English wording features are suppressed live and the shipped English wording is shown. Turning it off restores your choices exactly as they were.' }),
      el('label', { for: 'setting-shared-mode-name' }, ['Name for this mode', modeNameInput]),
      el('label', { class: 'inline-check', for: 'setting-shared-mode' }, [
        el('input', {
          id: 'setting-shared-mode',
          type: 'checkbox',
          checked: status.sharedModeActive,
          onChange: async (event) => {
            await api.vocabulary.sharedMode({ active: event.target.checked, name: modeNameInput.value });
            await refresh();
            announce(event.target.checked ? `${modeNameInput.value} is on.` : `${modeNameInput.value} is off.`);
          },
        }),
        el('span', { text: `Turn on ${status.sharedModeName}` }),
      ]),
    ]);
  }

  function scheduleControls() {
    const settings = getSettings();
    const schedules = settings.schedules;
    const schedule = settings.schedule;
    const timeZoneInput = el('input', { id: 'setting-schedule-timezone', maxlength: '80', value: schedules.timeZone });
    const urlInput = el('input', { id: 'setting-external-url', maxlength: '500', value: schedules.external.url, placeholder: 'https://' });
    const originInput = el('input', { id: 'setting-external-origin', maxlength: '200', placeholder: 'https://example.invalid' });
    return el('div', { class: 'setting-row', id: 'setting-schedules', 'data-appearance-id': 'setting-schedules' }, [
      el('h3', { text: 'Schedules' }),
      el('p', { class: 'supporting', text: `Precedence: ${schedule.precedenceOrder}` }),
      el('label', { for: 'setting-schedule-timezone' }, ['Time zone used to evaluate rules', timeZoneInput]),
      schedule.timeZoneError ? el('p', { class: 'error-text', text: schedule.timeZoneError }) : null,
      el('button', { type: 'button', class: 'tonal', onClick: async () => {
        await api.schedules.save({ ...schedules, timeZone: timeZoneInput.value.trim() });
        await refresh();
      } }, 'Save the time zone'),
      el('h4', { text: 'Which layer is winning right now' }),
      el('ul', { class: 'match-list' }, schedule.explanations.map((line) => el('li', { text: line }))),
      el('p', { class: 'supporting', text: schedule.activeRuleIds.length === 0 ? 'No schedule rule is active at the moment.' : `Active rules: ${schedule.activeRuleIds.join(', ')}.` }),
      el('button', { type: 'button', class: 'tonal', onClick: () => addRule(schedules) }, 'Add an evening theme rule'),
      schedules.rules.length === 0
        ? el('p', { class: 'supporting', text: 'No rule has been created.' })
        : el('ul', { class: 'match-list' }, schedules.rules.map((rule) => el('li', {}, [
          el('span', { text: `${rule.id}: ${rule.target} becomes ${String(rule.value)} from ${rule.startTime} to ${rule.endTime}${rule.weekdays.length > 0 ? ` on days ${rule.weekdays.join(', ')}` : ' every day'}${rule.enabled ? '' : ' (disabled)'}` }),
          el('button', { type: 'button', class: 'text-button', onClick: async () => {
            await api.schedules.save({ ...schedules, rules: schedules.rules.filter((entry) => entry.id !== rule.id) });
            await refresh();
          } }, 'Remove'),
        ]))),
      el('h3', { text: 'External presentation settings' }),
      el('p', { class: 'supporting', text: 'This is off by default and carries presentation settings only. No project answer, attachment name or vocabulary content is ever sent. The read happens in the privileged boundary, against an https address whose origin you added to the allowlist, with a bounded schema and a short timeout.' }),
      el('label', { class: 'inline-check', for: 'setting-external-enabled' }, [
        el('input', {
          id: 'setting-external-enabled',
          type: 'checkbox',
          checked: schedules.external.enabled,
          onChange: async (event) => { await api.schedules.save({ ...schedules, external: { ...schedules.external, enabled: event.target.checked } }); await refresh(); },
        }),
        el('span', { text: 'Allow an external presentation-settings document' }),
      ]),
      el('label', { for: 'setting-external-origin' }, ['Add an allowed https origin', originInput]),
      el('button', { type: 'button', class: 'text-button', onClick: async () => {
        const origin = originInput.value.trim();
        if (!/^https:\/\/[^\s/]+$/i.test(origin)) { announce('Enter a complete https origin.'); return; }
        await api.schedules.save({ ...schedules, external: { ...schedules.external, allowedOrigins: [...new Set([...schedules.external.allowedOrigins, origin.toLowerCase()])] } });
        await refresh();
      } }, 'Add to the allowlist'),
      el('p', { class: 'supporting', text: schedules.external.allowedOrigins.length === 0 ? 'The allowlist is empty.' : `Allowed origins: ${schedules.external.allowedOrigins.join(', ')}.` }),
      el('label', { for: 'setting-external-url' }, ['Document address', urlInput]),
      el('div', { class: 'button-row' }, [
        el('button', { type: 'button', class: 'tonal', onClick: async () => {
          await api.schedules.save({ ...schedules, external: { ...schedules.external, url: urlInput.value.trim() } });
          const result = await api.schedules.readExternal();
          externalStatus.textContent = result?.ok ? result.data.message : (result?.error?.message || 'The external document could not be read.');
          await refresh();
        } }, 'Request the document'),
        el('button', { type: 'button', class: 'tonal', onClick: async () => {
          const result = await api.schedules.applyExternal();
          externalStatus.textContent = result?.ok ? 'The validated document was applied as a manual override.' : (result?.error?.message || 'The document was not applied.');
          await refresh();
        } }, 'Apply the validated document'),
      ]),
      externalStatus,
      schedules.external.lastVerdict ? el('p', { class: 'supporting', text: `Last outcome: ${schedules.external.lastVerdict}` }) : null,
      schedules.external.lastAppliedAt ? el('p', { class: 'supporting', text: `Last applied at ${schedules.external.lastAppliedAt}.` }) : null,
    ]);
  }

  async function addRule(schedules) {
    const id = `rule-${schedules.rules.length + 1}`;
    await api.schedules.save({
      ...schedules,
      rules: [...schedules.rules, { id, enabled: true, weekdays: [], startTime: '18:00', endTime: '07:00', target: 'theme', value: 'dark' }],
    });
    await refresh();
    announce(`Added the schedule rule ${id}.`);
  }

  function identityControls() {
    const settings = getSettings();
    const nameInput = el('input', { id: 'setting-displayName-input', maxlength: '60', value: settings.preferences.displayName });
    return el('div', { class: 'setting-row', id: 'setting-displayName', 'data-appearance-id': 'setting-displayName' }, [
      el('h3', { text: 'Display name and logo' }),
      el('label', { for: 'setting-displayName-input' }, ['Display name', nameInput]),
      el('button', { type: 'button', class: 'tonal', onClick: () => updatePreference({ displayName: nameInput.value }) }, 'Apply the display name'),
      el('p', { class: 'supporting', text: `In use: ${settings.identity.resolvedName}. ${describeLogoSelection(settings.preferences.logo)}` }),
      el('div', { class: 'button-row', id: 'setting-logo', 'data-appearance-id': 'setting-logo' }, [
        el('button', { type: 'button', class: 'tonal', onClick: async () => {
          const result = await api.settings.chooseLogo();
          if (!result?.ok) { notify('Logo not accepted', `${result.error.message} ${result.error.recovery ?? ''}`, 'error'); return; }
          await refresh();
        } }, 'Choose a local image'),
        el('button', { type: 'button', class: 'text-button', onClick: () => updatePreference({ logo: { kind: 'shipped' } }) }, 'Use the shipped mark'),
      ]),
      el('div', { class: 'card about-card', id: 'about-card', 'data-appearance-id': 'about-card' }, [
        el('h3', { text: 'About' }),
        el('p', { text: `Shipped product name: ${settings.identity.shippedName}.` }),
        el('p', { class: 'supporting', text: settings.identity.presentationOnly }),
        el('p', { class: 'supporting', text: 'This application prepares information for a manually reviewed mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.' }),
      ]),
    ]);
  }

  function render() {
    const settings = getSettings();
    if (!settings) return;
    const groups = [
      group('appearance-basics', 'Look and feel', 'Theme, density, accent, text size and motion.', [
        segmented('theme', 'Theme', [...THEMES]),
        segmented('density', 'Density', [...DENSITIES]),
        segmented('motion', 'Motion', [...MOTION_CHOICES], (value) => (value === 'reduce' ? 'reduce (a complete reduced-motion path)' : value)),
        segmented('dock', 'Tab strip edge', [...DOCKS]),
        range('fontScale', 'Text size', MIN_FONT_SCALE, MAX_FONT_SCALE, 0.05, 'Applies to the whole application.'),
        el('div', { class: 'setting-row', id: 'setting-accent', 'data-appearance-id': 'setting-accent' }, [
          el('label', { for: 'setting-accent-input' }, ['Accent colour', el('input', {
            id: 'setting-accent-input',
            type: 'color',
            value: settings.preferences.accent,
            onChange: (event) => updatePreference({ accent: event.target.value }),
          })]),
        ]),
        el('div', { class: 'setting-row', id: 'appearance-destination', 'data-appearance-id': 'appearance-destination' }, [
          el('h3', { text: 'Per-element appearance' }),
          el('p', { class: 'supporting', text: 'Every element with a stable identifier can be restyled. An override that would make a required disclosure unreadable is refused.' }),
          el('button', { type: 'button', class: 'tonal', onClick: () => openAppearance(null) }, 'Open the appearance editor'),
        ]),
      ]),
      group('language', copy.t('settings.heading'), copy.t('settings.humourNote'), [
        el('div', { class: 'setting-row', id: 'setting-language', 'data-appearance-id': 'setting-language' }, [
          el('label', { for: 'setting-language-input' }, [copy.t('settings.language'), el('select', {
            id: 'setting-language-input',
            onChange: (event) => updatePreference({ language: event.target.value }),
          }, LANGUAGE_MODES.map((mode) => el('option', { value: mode, selected: settings.preferences.language === mode, text: LANGUAGE_LABELS[mode] })))]),
        ]),
        range('englishFunny', copy.t('settings.englishFunny'), MIN_FUNNY_LEVEL, MAX_FUNNY_LEVEL, 1, copy.t('settings.humourNote')),
        range('cantoneseFunny', copy.t('settings.cantoneseFunny'), MIN_FUNNY_LEVEL, MAX_FUNNY_LEVEL, 1, copy.t('settings.humourNote')),
        switchRow('dialogEmoji', copy.t('settings.dialogEmoji'), 'The emoji is decorative only. It never carries meaning and never replaces a word.'),
        vocabularyControls(),
      ]),
      group('narration', 'Read aloud', 'Speech is off by default and never reads an identifier, an address, an unlock answer or an attachment name.', [narrator.renderControls()]),
      group('schedules', 'Schedules and external settings', 'Presentation settings can follow a time of day, and may optionally come from an allowlisted https document.', [scheduleControls()]),
      group('identity', 'Name, logo and about', 'Presentation only.', [identityControls()]),
    ];
    const matching = groups
      .map((entry) => ({ ...entry, controls: entry.controls.filter(Boolean) }))
      .filter((entry) => search.matches(`${entry.title} ${entry.description}`) || entry.controls.some((control) => search.matches(control.textContent || '')));
    search.reportCounts(matching.length, groups.length);
    grid.replaceChildren(...(matching.length === 0
      ? [el('div', { class: 'empty card', text: 'No setting matches this search.' })]
      : matching.map((entry) => el('section', { class: 'card', id: `settings-group-${entry.id}`, 'data-appearance-id': `settings-group-${entry.id}` }, [
        el('h2', { text: entry.title }),
        el('p', { class: 'supporting', text: entry.description }),
        ...entry.controls,
      ]))));
  }

  container.replaceChildren(
    el('div', { class: 'page-heading' }, [
      el('div', {}, [el('p', { class: 'eyebrow', text: 'Stored on this computer only' }), el('h1', { id: 'settings-heading', text: 'Settings' })]),
    ]),
    el('div', { class: 'card' }, [search.element]),
    grid,
  );

  return { render };
}
