'use strict';

/**
 * Presentation locks.
 *
 * A lock guards an element, or one appearance property of an element, behind
 * an answer only the person knows. The renderer never holds a comparison
 * secret: an answer is sent to the privileged boundary and the reply is only
 * accepted or not accepted.
 *
 * The copy states plainly that these are presentation locks and not data
 * security. A lock can never cover the manual review checklist, the
 * mail-in-only disclosure, or the ability to close and save a project.
 */

import { announce, confirmDialog, el, promptDialog } from './dom.js';
import { createSearchField } from './regex-builder.js';

export function createLocksView({ api, container, notify, getSettings }) {
  let records = [];
  let disclosure = '';

  const search = createSearchField({
    id: 'locks-search',
    label: 'Search locks',
    placeholder: 'Type part of an element identifier or hint',
    onChange: () => render(),
  });

  const list = el('div', { class: 'lock-list', role: 'list' });
  const message = el('p', { class: 'supporting', role: 'status' });

  const elementInput = el('input', { id: 'lock-element', maxlength: '120', placeholder: 'Element identifier' });
  const propertyInput = el('input', { id: 'lock-property', maxlength: '60', placeholder: 'Optional appearance property' });
  const answerInput = el('input', { id: 'lock-answer', type: 'password', maxlength: '200', autocomplete: 'new-password' });
  const hintInput = el('input', { id: 'lock-hint', maxlength: '120' });
  const credentialSelect = el('select', { id: 'lock-credential' }, [
    el('option', { value: 'password', text: 'A password only you know' }),
    el('option', { value: 'authenticator', text: 'A code from the paired authenticator' }),
  ]);
  const recoveryInput = el('input', { id: 'lock-recovery', maxlength: '240', value: 'Reset this lock from the list below; a reset removes the lock and is recorded in the project history.' });

  async function refresh() {
    const result = await api.locks.list();
    if (!result?.ok) return;
    records = result.data.records;
    disclosure = result.data.disclosure;
    render();
  }

  async function create() {
    const result = await api.locks.create({
      elementId: elementInput.value.trim(),
      property: propertyInput.value.trim() || undefined,
      answer: answerInput.value,
      hint: hintInput.value,
      credential: credentialSelect.value,
      recovery: recoveryInput.value,
    });
    answerInput.value = '';
    if (!result?.ok) { message.textContent = result?.error?.message || 'The lock was not created.'; return; }
    records = result.data.records;
    message.textContent = `A lock now covers ${result.data.created.elementId}.`;
    notify('Lock created', `${result.data.created.elementId} is locked. ${disclosure}`);
    render();
  }

  async function attempt(record) {
    const dialogBody = record.credential === 'authenticator'
      ? `Enter the current code from the paired authenticator. Hint: ${record.hint || 'none recorded'}.`
      : `Enter the unlock answer. Hint: ${record.hint || 'none recorded'}.`;
    const answer = await promptDialog({
      title: 'Unlock this element',
      body: `${dialogBody} ${disclosure}`,
      label: 'Answer',
      maxLength: 200,
      confirmLabel: 'Unlock',
    });
    if (answer === null) return;
    const result = await api.locks.attempt({ id: record.id, answer });
    if (!result?.ok) { message.textContent = result?.error?.message || 'The unlock attempt did not complete.'; return; }
    records = result.data.records;
    message.textContent = result.data.message;
    announce(result.data.message);
    render();
  }

  async function reset(record) {
    const confirmed = await confirmDialog({
      title: 'Reset this lock?',
      body: `Resetting removes the lock on ${record.elementId} without needing the answer. ${disclosure} The reset is recorded in the project history when a project is open.`,
      confirmLabel: 'Reset the lock',
      destructive: true,
    });
    if (!confirmed) return;
    const result = await api.locks.reset(record.id);
    if (result?.ok) { records = result.data.records; render(); notify('Lock reset', `${record.elementId} is no longer locked.`); }
  }

  function render() {
    const visible = records.filter((record) => search.matches(`${record.elementId} ${record.property || ''} ${record.hint}`));
    search.reportCounts(visible.length, records.length);
    list.replaceChildren(...(visible.length === 0
      ? [el('div', { class: 'empty card', text: records.length === 0 ? 'No element is locked.' : 'No lock matches this search.' })]
      : visible.map((record) => el('article', { class: 'lock-row', role: 'listitem', 'data-appearance-id': 'lock-row' }, [
        el('div', {}, [
          el('strong', { text: record.property ? `${record.elementId} · ${record.property}` : record.elementId }),
          el('p', { class: 'supporting', text: `Locked at ${record.lockedAt}. Credential: ${record.credential}. ${record.unlockedUntil ? `Editable until ${record.unlockedUntil}.` : 'Currently locked.'}` }),
          el('p', { class: 'supporting', text: `Hint: ${record.hint || 'none recorded'}. Recovery: ${record.recovery}` }),
          record.failureCount > 0 ? el('p', { class: 'supporting', text: `${record.failureCount} unsuccessful attempt${record.failureCount === 1 ? '' : 's'} recorded.` }) : null,
        ]),
        el('div', { class: 'history-actions' }, [
          el('button', { type: 'button', class: 'tonal', onClick: () => attempt(record) }, 'Unlock'),
          el('button', { type: 'button', class: 'text-button', onClick: async () => { const result = await api.locks.release(record.id); if (result?.ok) { records = result.data.records; render(); } } }, 'Relock now'),
          el('button', { type: 'button', class: 'text-button', onClick: () => reset(record) }, 'Reset'),
        ]),
      ]))));
  }

  container.replaceChildren(
    el('div', { class: 'card', id: 'locks-card', 'data-appearance-id': 'locks-card' }, [
      el('h2', { text: 'Element locks' }),
      el('p', { class: 'supporting', id: 'locks-disclosure', text: 'Element locks only guard against accidental edits in this interface. They are not a security control and they do not protect stored data. Project confidentiality comes from the project password and the encrypted project file.' }),
      el('p', { class: 'supporting', text: 'The manual review checklist, the mail-in-only disclosure, and saving or closing a project can never be locked.' }),
      el('label', { for: 'lock-element' }, ['Element identifier', elementInput]),
      el('label', { for: 'lock-property' }, ['Appearance property (optional)', propertyInput]),
      el('label', { for: 'lock-credential' }, ['Credential', credentialSelect]),
      el('label', { for: 'lock-answer' }, ['Unlock answer', answerInput]),
      el('label', { for: 'lock-hint' }, ['Hint shown when unlocking', hintInput]),
      el('label', { for: 'lock-recovery' }, ['Recovery note', recoveryInput]),
      el('button', { type: 'button', class: 'filled', onClick: create }, 'Create the lock'),
      message,
    ]),
    el('div', { class: 'card' }, [search.element]),
    list,
  );

  return { refresh, isBlocked: (elementId, property) => records.some((record) => record.elementId === elementId && (record.property ?? null) === (property ?? null) && !record.unlockedUntil) };
}
