'use strict';

/**
 * The renderer entry point.
 *
 * It owns no privileged capability: every file, dialog, process and network
 * decision happens in the main process. This module wires the destinations,
 * the tab strip, the command palette, the search builders, narration, the
 * transfer surfaces and the wizard together.
 */

import { $, $$, announce, confirmDialog, el, escapeHtml, promptDialog } from './dom.js';
import { REVIEW_LABELS, STEP_COPY, createResolver } from './copy.js';
import { createSearchField } from './regex-builder.js';
import { createTabStrip } from './tabs.js';
import { applyAppearance, createAppearanceEditor, wireElementContextMenus } from './appearance.js';
import { createNarrator } from './narration.js';
import { createCommandPalette } from './palette.js';
import { createSettingsView } from './settings.js';
import { createNotificationsView } from './notifications.js';
import { createDocsView } from './docs.js';
import { createChangelogView } from './changelog.js';
import { createConverterView } from './converter.js';
import { createOllamaView } from './ollama.js';
import { createLocksView } from './locks.js';
import { createAuthenticatorView } from './authenticator.js';
import { createTransferSurfaces } from './download-surfaces.js';

const api = window.taxDesktop;

let state = null;
let projectStatus = { open: false };
let settings = null;
let copy = null;
let currentStep = 0;
let historyRows = [];
let historySelection = new Set();
let pendingExport = null;

/** Field behaviour per wizard step, paired with the copy catalogue by index. */
const STEP_FIELDS = [
  {
    field: 'profile.fullName',
    render: (value) => `<label for="answer">Legal name<input id="answer" maxlength="200" autocomplete="name" value="${escapeHtml(value)}"></label>`,
    read: () => $('#answer').value.trim(),
    valid: (value) => value.length > 0 && value.length <= 200,
  },
  {
    field: 'profile.socialInsuranceNumber',
    narrationKind: 'identifier',
    render: (value) => `<label for="answer">Social Insurance Number<input id="answer" inputmode="numeric" maxlength="11" autocomplete="off" value="${escapeHtml(value)}"></label>`,
    read: () => $('#answer').value.trim(),
    valid: (value) => /^\d{3}[ -]?\d{3}[ -]?\d{3}$/.test(value),
  },
  {
    field: 'profile.dateOfBirth',
    render: (value) => `<label for="answer">Date of birth<input id="answer" type="date" autocomplete="bday" value="${escapeHtml(value)}"></label>`,
    read: () => $('#answer').value,
    valid: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value),
  },
  {
    field: 'residency.province',
    render: (value) => `<fieldset><legend>Province</legend><label class="choice"><input id="answer" type="radio" name="province" value="ON" ${value === 'ON' ? 'checked' : ''}><span><strong>Ontario</strong><small>Use the Canada and Ontario rules recorded in this project.</small></span></label></fieldset>`,
    read: () => ($('#answer')?.checked ? 'ON' : ''),
    valid: (value) => value === 'ON',
  },
  {
    field: 'residency.address',
    narrationKind: 'mailing-address',
    render: (value) => `<label for="answer">Return address<textarea id="answer" maxlength="500" autocomplete="street-address">${escapeHtml(value)}</textarea></label>`,
    read: () => $('#answer').value.trim(),
    valid: (value) => value.length > 0 && value.length <= 500,
  },
  {
    field: 'income.reviewedAllDocuments',
    render: (value) => `<label class="choice"><input id="answer" type="checkbox" ${value ? 'checked' : ''}><span><strong>I reviewed the income documents I expect</strong><small>This confirmation does not file or transmit anything.</small></span></label>`,
    read: () => $('#answer').checked,
    valid: (value) => value === true,
  },
  {
    kind: 'attachments',
    narrationKind: 'attachment-name',
    render: renderAttachments,
    read: () => state.attachments,
    valid: (value) => value.every((attachment) => attachment.parserConfirmed),
  },
  {
    field: 'deductions.notes',
    render: (value) => `<label for="answer">Review notes (optional)<textarea id="answer" maxlength="4000">${escapeHtml(value)}</textarea></label>`,
    read: () => $('#answer').value.trim(),
    valid: (value) => value.length <= 4000,
  },
  {
    field: 'delivery.mailingDestination',
    render: (value) => `<label for="answer">Mailing destination review note<textarea id="answer" maxlength="500">${escapeHtml(value)}</textarea></label>`,
    read: () => $('#answer').value.trim(),
    valid: (value) => value.length > 0 && value.length <= 500,
  },
  {
    kind: 'review',
    render: renderReview,
    read: () => state.review,
    valid: (value) => Object.values(value).every(Boolean),
  },
];

const DESTINATIONS = [
  { id: 'welcome', copyKey: null, label: 'Welcome', icon: '✦', defaultOpen: true, pinned: true, closable: false, description: 'Create or open an encrypted project.' },
  { id: 'wizard', copyKey: 'nav.wizard', icon: '→', defaultOpen: true, closable: false, description: 'Answer one plain-language question at a time.' },
  { id: 'history', copyKey: 'nav.history', icon: '↶', defaultOpen: true, description: 'Browse the append-only local history.' },
  { id: 'project', copyKey: 'nav.project', icon: '▣', defaultOpen: true, description: 'Save, copy and close the encrypted project file.' },
  { id: 'settings', copyKey: 'nav.settings', icon: '⚙', defaultOpen: true, description: 'Language, humour, vocabulary, narration, schedules, name and logo.' },
  { id: 'appearance', copyKey: 'nav.appearance', icon: '◐', description: 'Per-element appearance overrides and presentation locks.' },
  { id: 'documentation', copyKey: 'nav.documentation', icon: '❓', description: 'Read the packaged offline articles.' },
  { id: 'changelog', copyKey: 'nav.changelog', icon: '≡', description: 'Read the generated changelog entries verbatim.' },
  { id: 'notifications', copyKey: 'nav.notifications', icon: '⚑', description: 'Search, filter and clear the local notice log.' },
  { id: 'converter', copyKey: 'nav.converter', icon: '⇄', description: 'Convert local files entirely offline.' },
  { id: 'models', copyKey: 'nav.models', icon: '◈', description: 'Local model store, queue, chat, harness and troubleshooter.' },
  { id: 'support', copyKey: 'nav.support', icon: '✎', description: 'Authenticator pairing and local support tickets.' },
];

let tabStrip = null;
let palette = null;
let narrator = null;
let appearanceEditor = null;
let transferSurfaces = null;
const views = {};

function destinations() {
  return DESTINATIONS.map((destination) => ({
    ...destination,
    label: destination.copyKey && copy ? copy.t(destination.copyKey) : destination.label,
  }));
}

// --- notifications -----------------------------------------------------------

function notification(title, message, type = 'info') {
  const region = $('#notifications');
  const item = el('div', { class: `notification ${type === 'error' ? 'error' : ''}`, role: type === 'error' ? 'alert' : 'status' }, [
    el('div', {}, [el('strong', { text: title }), el('p', { text: message })]),
    el('button', { type: 'button', 'aria-label': `Dismiss the notice ${title}`, onClick: () => item.remove() }, '×'),
  ]);
  region.append(item);
  if (type !== 'error') window.setTimeout(() => item.remove(), 6000);
  api.notifications.append({ kind: type === 'error' ? 'error' : 'info', title, body: message, action: 'renderer' }).catch(() => {});
  narrator?.speak({ en: `${title}. ${message}`, zh: `${title}。${message}`, fieldKind: 'announcement' });
  return item;
}

function requireResult(result) {
  if (result?.ok) return result.data;
  const error = result?.error || { message: 'The operation did not complete.', recovery: 'Retry without closing the application.' };
  notification(error.code || 'Operation failed', `${error.message}${error.recovery ? ` ${error.recovery}` : ''}`, 'error');
  throw new Error(error.message);
}

// --- wizard ------------------------------------------------------------------

function valueAt(dottedPath) {
  return dottedPath.split('.').reduce((value, segment) => value?.[segment], state);
}

function renderAttachments() {
  const items = state.attachments.map((attachment) => `<li>
    <div><strong>${escapeHtml(attachment.displayName)}</strong><small>${attachment.bytes.toLocaleString()} bytes · ${attachment.parserConfirmed ? 'Manually confirmed' : 'Confirmation required'}</small></div>
    <div class="attachment-actions">
      ${attachment.parserConfirmed ? '' : `<button class="tonal" data-confirm-attachment="${attachment.id}">Confirm values</button>`}
      <button class="text-button" data-remove-attachment="${attachment.id}">Remove</button>
    </div>
  </li>`).join('');
  return `<button id="add-attachment" class="tonal" type="button">Choose local document</button><ul class="attachment-list">${items || '<li><div><strong>No documents attached</strong><small>You may continue without an attachment when none applies.</small></div></li>'}</ul>`;
}

function renderReview() {
  const rows = REVIEW_LABELS.map((entry) => `<label><input type="checkbox" data-review-key="${entry.key}" ${state.review[entry.key] ? 'checked' : ''}><span>${escapeHtml(copy.variants(entry.copy))}</span></label>`).join('');
  return `<div class="review-list">${rows}</div><p id="review-boundary-statement" data-appearance-id="review-boundary-statement"><strong>No electronic submission:</strong> ${escapeHtml(copy.t('review.boundary'))}</p>`;
}

function renderWizard() {
  if (!state) return;
  currentStep = Math.min(Math.max(currentStep, 0), STEP_FIELDS.length - 1);
  const behaviour = STEP_FIELDS[currentStep];
  const text = STEP_COPY[currentStep];
  $('#progress-bar').style.width = `${((currentStep + 1) / STEP_FIELDS.length) * 100}%`;
  $('#progress-label').textContent = copy.t('wizard.progressLabel', { current: currentStep + 1, total: STEP_FIELDS.length });
  $('#project-chip').textContent = projectStatus.open ? `${projectStatus.projectFileName} · ${projectStatus.taxYear}` : 'No project open';
  const value = behaviour.field ? valueAt(behaviour.field) : behaviour.read();
  $('#question-card').innerHTML = `
    <p class="question-number">Question ${currentStep + 1}</p>
    <h2 id="wizard-question-title" data-appearance-id="wizard-question-title">${escapeHtml(copy.variants(text.title))}</h2>
    <div class="explanation-grid">
      <div class="explanation"><strong>${escapeHtml(copy.t('wizard.what'))}</strong>${escapeHtml(copy.variants(text.what))}</div>
      <div class="explanation"><strong>${escapeHtml(copy.t('wizard.why'))}</strong>${escapeHtml(copy.variants(text.why))}</div>
      <div class="explanation"><strong>${escapeHtml(copy.t('wizard.where'))}</strong>${escapeHtml(copy.variants(text.where))}</div>
      <div class="explanation"><strong>${escapeHtml(copy.t('wizard.example'))}</strong>${escapeHtml(copy.variants(text.example))}</div>
    </div>
    <div class="answer-area">${behaviour.render(value)}</div>
    <p id="wizard-validation" class="validation" data-appearance-id="wizard-validation" tabindex="-1"><strong>${escapeHtml(copy.t('wizard.validation'))}:</strong> ${escapeHtml(copy.variants(text.validation))}</p>
    <p id="wizard-boundary-statement" data-appearance-id="wizard-boundary-statement"><strong>${escapeHtml(copy.t('wizard.nextStep'))}:</strong> ${escapeHtml(copy.variants(text.next))}</p>`;
  $('#previous-step').disabled = currentStep === 0;
  $('#next-step').textContent = currentStep === STEP_FIELDS.length - 1 ? copy.t('wizard.finish') : copy.t('wizard.next');
  $('#open-step-article').textContent = copy.t('wizard.readMore');
  wireQuestionActions();
  applyAppearance(settings?.appearance);
}

/** Reads one humour variant, clamped to the stored level. */
function variantAt(variants, language) {
  const level = language === 'zh' ? settings.preferences.cantoneseFunny : settings.preferences.englishFunny;
  const index = Math.min(Math.max(Math.round(level) - 1, 0), 4);
  return variants[language][index];
}

function readCurrentQuestionAloud() {
  const text = STEP_COPY[currentStep];
  const behaviour = STEP_FIELDS[currentStep];
  if (behaviour.narrationKind) {
    const result = narrator.speak({ en: '', zh: '', fieldKind: behaviour.narrationKind });
    announce(result.reason || 'This question is not read aloud.');
    notification('Not read aloud', `${result.reason} The question title is still shown on screen.`);
    return;
  }
  const spoken = narrator.speak({
    en: `${variantAt(text.title, 'en')}. ${variantAt(text.validation, 'en')}`,
    zh: `${variantAt(text.title, 'zh')}。${variantAt(text.validation, 'zh')}`,
    fieldKind: 'question',
  });
  if (!spoken.spoken) announce(spoken.reason);
}

function wireQuestionActions() {
  $('#add-attachment')?.addEventListener('click', async () => {
    const result = await transferSurfaces.start({ kind: 'attachment-intake' });
    if (result?.state) { state = result.state; renderWizard(); notification(copy.t('toast.attachment'), 'The local file was encrypted and recorded as one new history commit.'); }
  });
  $$('[data-confirm-attachment]').forEach((button) => button.addEventListener('click', async () => {
    try {
      const data = requireResult(await api.attachment.confirm(button.dataset.confirmAttachment));
      state = data.state; renderWizard();
      notification('Parser values confirmed', 'The manual confirmation and source metadata were saved in a new history commit.');
    } catch { /* already reported */ }
  }));
  $$('[data-remove-attachment]').forEach((button) => button.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: `${copy.dialogEmoji('danger')}Remove this attachment?`,
      body: 'The encrypted attachment is removed from the current project. The history stays append-only, so the removal is recorded as a new commit.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const data = requireResult(await api.attachment.remove(button.dataset.removeAttachment));
      state = data.state; renderWizard();
      notification('Attachment removed', 'Removal was saved as a new history commit.');
    } catch { /* already reported */ }
  }));
  $$('[data-review-key]').forEach((input) => input.addEventListener('change', async () => {
    try {
      const data = requireResult(await api.state.mutate({ field: `review.${input.dataset.reviewKey}`, value: input.checked }));
      state = data.state; projectStatus = data.status; renderWizard();
      notification(copy.t('toast.reviewSaved'), 'This checklist change is one append-only history commit.');
    } catch { input.checked = !input.checked; }
  }));
}

async function saveCurrentAndAdvance() {
  const behaviour = STEP_FIELDS[currentStep];
  const text = STEP_COPY[currentStep];
  const value = behaviour.read();
  if (!behaviour.valid(value)) {
    $('#wizard-validation').scrollIntoView({ block: 'center' });
    $('#wizard-validation').focus?.();
    notification('Answer needs attention', copy.variants(text.validation), 'error');
    return;
  }
  try {
    if (behaviour.field) {
      const data = requireResult(await api.state.mutate({ field: behaviour.field, value }));
      state = data.state; projectStatus = data.status;
    }
    if (currentStep < STEP_FIELDS.length - 1) currentStep += 1;
    renderWizard();
    if (currentStep === STEP_FIELDS.length - 1 && Object.values(state.review).every(Boolean)) {
      notification('Manual PDF review complete', `The acknowledgement is saved. ${copy.t('toast.nothingFiled')}`);
    }
  } catch { /* already reported */ }
}

// --- destinations ------------------------------------------------------------

function showPanel(destinationId, focusTarget) {
  // The guided report needs an open project; without one the welcome
  // destination is shown instead of an empty question card.
  if (!state && destinationId === 'wizard') destinationId = 'welcome';
  $$('.page').forEach((page) => page.classList.add('hidden'));
  const panel = $(`#panel-${destinationId}`);
  if (!panel) return;
  panel.classList.remove('hidden');
  if (destinationId === 'wizard') renderWizard();
  if (destinationId === 'history') refreshHistory();
  if (destinationId === 'project') renderProjectDetails();
  if (destinationId === 'settings') views.settings?.render();
  if (destinationId === 'appearance') views.locks?.refresh();
  if (destinationId === 'documentation') views.docs?.refresh();
  if (destinationId === 'changelog') views.changelog?.refresh();
  if (destinationId === 'notifications') views.notifications?.refresh();
  if (destinationId === 'converter') views.converter?.refresh();
  if (destinationId === 'models') views.models?.refresh();
  if (destinationId === 'support') views.support?.refresh();
  applyAppearance(settings?.appearance);
  window.requestAnimationFrame(() => {
    const node = focusTarget ? document.getElementById(focusTarget) : panel;
    if (node) {
      node.scrollIntoView({ block: 'center' });
      if (node instanceof HTMLElement) node.focus({ preventScroll: true });
    }
  });
}

function openDestination(destinationId, focusTarget) {
  if (!tabStrip.isOpen(destinationId)) tabStrip.open(destinationId);
  else tabStrip.activate(destinationId);
  showPanel(destinationId, focusTarget);
}

// --- project -----------------------------------------------------------------

function renderProjectDetails() {
  const details = $('#project-details');
  if (!projectStatus.open) {
    details.innerHTML = '<div><dt>Status</dt><dd>No project open</dd></div>';
    $('#save-project').disabled = true; $('#close-project').disabled = true;
    return;
  }
  details.innerHTML = `
    <div><dt>Project file</dt><dd>${escapeHtml(projectStatus.projectFileName)}</dd></div>
    <div><dt>Tax year</dt><dd>${projectStatus.taxYear}</dd></div>
    <div><dt>History head</dt><dd><code>${escapeHtml(projectStatus.historyHead)}</code></dd></div>
    <div><dt>Manual PDF review</dt><dd>${projectStatus.manualPdfReviewComplete ? 'Complete' : 'Incomplete'}</dd></div>
    <div><dt>Delivery boundary</dt><dd>CRA mail-in PDF only; no electronic submission or automatic filing</dd></div>`;
  $('#save-project').disabled = false; $('#close-project').disabled = false;
}

// --- history -----------------------------------------------------------------

let historySearch = null;
let historyActionFilter = null;

async function refreshHistory() {
  if (!state || !historySearch || !historyActionFilter) return;
  const from = $('#history-from').value ? `${$('#history-from').value}T00:00:00.000Z` : '';
  const to = $('#history-to').value ? `${$('#history-to').value}T23:59:59.999Z` : '';
  const search = historySearch.state;
  try {
    const data = requireResult(await api.history.query({
      text: search.regex ? '' : search.query,
      regex: search.regex,
      pattern: search.pattern,
      flags: search.flags,
      action: '',
      from,
      to,
    }));
    const actions = data.actions.filter((action) => historyActionFilter.matches(action));
    historyActionFilter.reportCounts(actions.length, data.actions.length);
    historyRows = data.rows.filter((row) => actions.includes(row.action));
    historySearch.reportCounts(historyRows.length, data.rows.length);
    $('#history-empty').classList.toggle('hidden', historyRows.length > 0);
    $('#history-list').innerHTML = historyRows.map((row) => `<article class="history-row ${row.current ? 'current' : ''}" role="listitem" data-appearance-id="history-row">
      <label class="inline-check"><input type="checkbox" data-select-revision="${row.revisionId}" ${historySelection.has(row.revisionId) ? 'checked' : ''} aria-label="Select revision ${escapeHtml(row.revisionId)}"><span class="visually-hidden">Select</span></label>
      <div><strong>${escapeHtml(row.label || row.summary)}</strong><p>${escapeHtml(row.summary)}</p><div class="history-meta"><span>${escapeHtml(row.action)}</span><time>${escapeHtml(row.timestamp)}</time><code>${escapeHtml(row.revisionId)}</code>${row.current ? '<span>Current</span>' : ''}</div></div>
      <div class="history-actions"><button class="text-button" data-diff="${row.revisionId}">Diff</button><button class="text-button" data-label="${row.revisionId}">Label</button>${row.current ? '' : `<button class="tonal" data-restore="${row.revisionId}">Restore</button>`}</div>
    </article>`).join('');
    wireHistoryActions(historyRows.find((row) => row.current)?.revisionId);
    updateHistoryBulkPreview();
    applyAppearance(settings?.appearance);
  } catch { /* already reported */ }
}

function updateHistoryBulkPreview() {
  $('#history-bulk-preview').textContent = historySelection.size === 0
    ? `No revision is selected. ${historyRows.length} revision${historyRows.length === 1 ? '' : 's'} match the current filter.`
    : `${historySelection.size} revision${historySelection.size === 1 ? '' : 's'} selected out of ${historyRows.length} shown.`;
}

function wireHistoryActions(currentRevisionId) {
  $$('[data-select-revision]').forEach((input) => input.addEventListener('change', () => {
    if (input.checked) historySelection.add(input.dataset.selectRevision);
    else historySelection.delete(input.dataset.selectRevision);
    updateHistoryBulkPreview();
  }));
  $$('[data-diff]').forEach((button) => button.addEventListener('click', async () => {
    try {
      const data = requireResult(await api.history.diff(button.dataset.diff, currentRevisionId));
      $('#diff-content').innerHTML = data.changedPaths.length
        ? `<ul>${data.changedPaths.map((item) => `<li><code>${escapeHtml(item)}</code></li>`).join('')}</ul>`
        : '<p>No state paths differ.</p>';
      $('#diff-dialog').showModal();
    } catch { /* already reported */ }
  }));
  $$('[data-label]').forEach((button) => button.addEventListener('click', async () => {
    const label = await promptDialog({
      title: `${copy.dialogEmoji('info')}Label this revision`,
      body: 'A label is stored in the app-private local history only.',
      label: 'Revision label (80 characters maximum)',
      maxLength: 80,
    });
    if (label === null) return;
    try { requireResult(await api.history.label(button.dataset.label, label)); await refreshHistory(); notification('Label saved', 'The label was added in the app-private local history.'); } catch { /* already reported */ }
  }));
  $$('[data-restore]').forEach((button) => button.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: `${copy.dialogEmoji('confirm')}Restore this revision?`,
      body: 'Restoring appends a new commit. The current revision stays recoverable, and no earlier history is rewritten.',
      confirmLabel: 'Restore',
    });
    if (!confirmed) return;
    try {
      const data = requireResult(await api.history.restore(button.dataset.restore));
      state = data.state; projectStatus = data.status; await refreshHistory(); renderWizard();
      notification('Revision restored', 'Restore created a new commit; prior history was not rewritten.');
    } catch { /* already reported */ }
  }));
}

async function bulkLabelSelection() {
  if (historySelection.size === 0) { announce('No revision is selected.'); return; }
  const scope = historyRows.filter((row) => historySelection.has(row.revisionId));
  const confirmed = await confirmDialog({
    title: `${copy.dialogEmoji('confirm')}Label these revisions?`,
    body: `${scope.length} revision${scope.length === 1 ? '' : 's'} will receive the same label: ${scope.slice(0, 5).map((row) => row.revisionId).join(', ')}${scope.length > 5 ? ' and more' : ''}.`,
    confirmLabel: `Label ${scope.length}`,
  });
  if (!confirmed) return;
  const label = await promptDialog({ title: 'Label for the selection', body: 'The same label is applied to every selected revision.', label: 'Label', maxLength: 80 });
  if (label === null) return;
  for (const row of scope) await api.history.label(row.revisionId, label);
  historySelection.clear();
  await refreshHistory();
  notification('Labels saved', `${scope.length} revision${scope.length === 1 ? '' : 's'} were labelled in the app-private local history.`);
}

// --- exports -----------------------------------------------------------------

function openExportDialog({ collection, rows, columns, filterDescription, omitted }) {
  pendingExport = { collection, rows, columns, filterDescription, omitted };
  $('#export-scope').textContent = `${rows.length} row${rows.length === 1 ? '' : 's'} will be written. Filter: ${filterDescription}.`;
  $('#export-identity').checked = false;
  $('#export-confirmation').value = '';
  $('#export-confirmation-wrap').classList.add('hidden');
  $('#export-dialog').showModal();
}

async function runExport() {
  if (!pendingExport) return;
  const request = {
    collection: pendingExport.collection,
    format: $('#export-format').value,
    rows: pendingExport.rows,
    columns: pendingExport.columns,
    filterDescription: pendingExport.filterDescription,
    omitted: pendingExport.omitted,
    includeIdentity: $('#export-identity').checked,
    confirmation: $('#export-confirmation').value,
  };
  $('#export-dialog').close();
  await transferSurfaces.start({ kind: 'export', exportRequest: request });
  pendingExport = null;
}

// --- settings and theme ------------------------------------------------------

function applyPresentation() {
  const preferences = settings.preferences;
  const root = document.documentElement;
  root.dataset.theme = preferences.theme === 'system' ? '' : preferences.theme;
  if (preferences.theme === 'system') root.removeAttribute('data-theme');
  root.dataset.density = preferences.density;
  root.dataset.motion = preferences.motion === 'system' ? '' : preferences.motion;
  if (preferences.motion === 'system') root.removeAttribute('data-motion');
  root.style.setProperty('--font-scale', String(preferences.fontScale));
  root.style.setProperty('--primary', preferences.accent);
  $('#brand-name').textContent = settings.identity.resolvedName;
  const logo = $('#brand-logo');
  if (preferences.logo.kind === 'local' && preferences.logo.dataUrl) {
    logo.src = preferences.logo.dataUrl;
    logo.alt = `${settings.identity.resolvedName} logo`;
    logo.classList.remove('hidden');
    $('#brand-mark').classList.add('hidden');
  } else {
    logo.classList.add('hidden');
    $('#brand-mark').classList.remove('hidden');
  }
  tabStrip?.setDock(preferences.dock);
  $('#app-shell').dataset.dock = preferences.dock;
  applyAppearance(settings.appearance);
}

async function refreshSettings() {
  const result = await api.settings.load();
  if (!result?.ok) return;
  settings = result.data;
  copy = createResolver(settings.preferences);
  applyPresentation();
  views.settings?.render();
  palette?.refresh();
  return settings;
}

function rebuildTabStrip() {
  const active = tabStrip?.activeId() ?? 'welcome';
  tabStrip = createTabStrip({
    container: $('#tabstrip'),
    destinations: destinations(),
    initialState: tabStrip?.state ?? settings.tabs,
    dock: settings.preferences.dock,
    onActivate: (id) => showPanel(id),
    onLayoutChange: (layout) => api.settings.saveTabs(layout),
  });
  tabStrip.activate(active);
}

async function updatePreference(patch) {
  const languageChanged = ['language', 'englishFunny', 'cantoneseFunny'].some((key) => key in (patch || {}));
  const result = await api.settings.update({ preferences: patch });
  if (!result?.ok) { notification('Setting not saved', result.error.message, 'error'); return; }
  settings = result.data;
  copy = createResolver(settings.preferences);
  if (languageChanged) rebuildTabStrip();
  applyPresentation();
  views.settings?.render();
  renderWizard();
  palette?.refresh();
  announce(copy.t('toast.settingsSaved'));
}

// --- boot --------------------------------------------------------------------

async function boot() {
  $('#minimize').addEventListener('click', api.window.minimize);
  $('#maximize').addEventListener('click', api.window.maximize);
  $('#close').addEventListener('click', api.window.close);
  $$('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => $(`#${button.dataset.closeDialog}`).close()));

  await refreshSettings();
  if (!settings) {
    settings = { preferences: { theme: 'system', density: 'comfortable', motion: 'system', fontScale: 1, accent: '#4355b9', dock: 'left', language: 'en', englishFunny: 1, cantoneseFunny: 3, dialogEmoji: true, displayName: '', logo: { kind: 'shipped' }, narration: { enabled: false, englishVoiceId: null, cantoneseVoiceId: null, rate: 1, pitch: 1 } }, appearance: {}, tabs: null, identity: { resolvedName: 'Material Tax Reporting' } };
    copy = createResolver(settings.preferences);
  }

  narrator = createNarrator({ getPreferences: () => settings.preferences, updatePreference });
  transferSurfaces = createTransferSurfaces({ api, notify: notification });

  tabStrip = createTabStrip({
    container: $('#tabstrip'),
    destinations: destinations(),
    initialState: settings.tabs,
    dock: settings.preferences.dock,
    onActivate: (id) => showPanel(id),
    onLayoutChange: (layout) => api.settings.saveTabs(layout),
  });

  appearanceEditor = createAppearanceEditor({
    api,
    getSettings: () => settings,
    refresh: refreshSettings,
    notify: notification,
  });
  wireElementContextMenus((elementId) => appearanceEditor.open(elementId));

  views.settings = createSettingsView({
    api,
    container: $('#panel-settings'),
    getSettings: () => settings,
    updatePreference,
    refresh: refreshSettings,
    notify: notification,
    narrator,
    // A live view of the resolver, so a language or humour change is reflected
    // without rebuilding the settings surface.
    copy: {
      t: (key, replacements) => copy.t(key, replacements),
      variants: (value) => copy.variants(value),
      dialogEmoji: (kind) => copy.dialogEmoji(kind),
    },
    openAppearance: (elementId) => appearanceEditor.open(elementId),
  });
  views.locks = createLocksView({ api, container: $('#panel-appearance'), notify: notification, getSettings: () => settings });
  views.notifications = createNotificationsView({ api, container: $('#panel-notifications'), notify: notification });
  views.docs = createDocsView({ api, container: $('#panel-documentation') });
  views.changelog = createChangelogView({ api, container: $('#panel-changelog') });
  views.converter = createConverterView({
    api,
    container: $('#panel-converter'),
    notify: notification,
    startTransfer: async (request) => {
      const result = await transferSurfaces.start(request);
      if (result?.outcome) {
        views.converter.clearStaged();
        notification('Conversion finished', `${result.outcome.succeeded} converted, ${result.outcome.failed} refused. ${result.outcome.confirmationNotice}`);
      }
    },
  });
  views.models = createOllamaView({ api, container: $('#panel-models'), notify: notification });
  views.support = createAuthenticatorView({
    api,
    container: $('#panel-support'),
    notify: notification,
    exportRows: (rows, filterDescription) => openExportDialog({
      collection: 'support-tickets',
      rows: rows.map((ticket) => ({ id: ticket.id, title: ticket.title, body: ticket.body, severity: ticket.severity, state: ticket.state, createdAt: ticket.createdAt, updatedAt: ticket.updatedAt })),
      columns: [
        { key: 'id', label: 'Identifier' }, { key: 'title', label: 'Title' }, { key: 'body', label: 'Body' },
        { key: 'severity', label: 'Severity' }, { key: 'state', label: 'State' }, { key: 'createdAt', label: 'Created' }, { key: 'updatedAt', label: 'Updated' },
      ],
      filterDescription,
      omitted: ['ticket content already redacted before storage'],
    }),
  });

  palette = createCommandPalette({
    api,
    getSettings: () => settings,
    updatePreference,
    destinations: destinations(),
    steps: STEP_COPY.map((step, index) => ({ id: step.id, paletteDetail: `Go to guided report question ${index + 1}.` })),
    openDestination,
    openAppearance: (elementId) => appearanceEditor.open(elementId),
    projectActions: [
      { id: 'create', label: 'Create an encrypted project', detail: 'Open the create form on the welcome destination.', tab: 'welcome', target: 'create-form' },
      { id: 'preview-import', label: 'Preview and open an existing project', detail: 'Open the preview form on the welcome destination.', tab: 'welcome', target: 'open-form' },
      { id: 'save', label: 'Save the open project', detail: 'Go to the save control on the project destination.', tab: 'project', target: 'save-project' },
      { id: 'save-copy', label: 'Save a password-wrapped copy', detail: 'Go to the save-copy form.', tab: 'project', target: 'save-copy-form' },
      { id: 'close', label: 'Save and close the project', detail: 'Go to the close control.', tab: 'project', target: 'close-project' },
    ],
    historyActions: [
      { id: 'search', label: 'Search the local history', detail: 'Go to the history search field.', target: 'history-search-input' },
      { id: 'diff', label: 'Compare revisions', detail: 'Go to the history list and choose Diff on a revision.', target: 'history-list' },
      { id: 'label', label: 'Label a revision', detail: 'Go to the history list and choose Label on a revision.', target: 'history-list' },
      { id: 'restore', label: 'Restore a revision', detail: 'Go to the history list and choose Restore on a revision.', target: 'history-list' },
      { id: 'undo', label: 'Undo to the previous revision', detail: 'Go to the undo control.', target: 'undo-history' },
      { id: 'verify', label: 'Verify the Git object graph', detail: 'Go to the verification control.', target: 'verify-history' },
    ],
  });
  $('#open-palette').addEventListener('click', () => palette.open());

  historySearch = createSearchField({
    id: 'history-search',
    label: 'Search summaries and labels',
    placeholder: 'Type part of an action or label',
    onChange: () => refreshHistory(),
  });
  historyActionFilter = createSearchField({
    id: 'history-action',
    label: 'Filter recorded actions',
    placeholder: 'Type part of an action name',
    onChange: () => refreshHistory(),
  });
  $('#history-search-host').append(historySearch.element);
  $('#history-action-host').append(historyActionFilter.element);

  $('#previous-step').addEventListener('click', () => { if (currentStep > 0) { currentStep -= 1; renderWizard(); } });
  $('#next-step').addEventListener('click', saveCurrentAndAdvance);
  $('#read-step').addEventListener('click', readCurrentQuestionAloud);
  $('#open-step-article').addEventListener('click', () => {
    const article = STEP_COPY[currentStep].article;
    openDestination('documentation');
    views.docs.openArticle(article.area, article.slug);
  });

  $('#create-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = $('#create-password').value;
    try {
      const data = requireResult(await api.project.create({ taxYear: Number($('#create-tax-year').value), password }));
      $('#create-password').value = ''; state = data.state; projectStatus = data.status; currentStep = 0; openDestination('wizard');
      notification('Encrypted project created', 'The initial empty report and app-private Git history were saved in one project file.');
    } catch { /* already reported */ } finally { $('#create-password').value = ''; }
  });
  $('#open-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = $('#open-password').value;
    try { showImportPreview(requireResult(await api.project.previewImport({ password }))); } catch { /* already reported */ } finally { $('#open-password').value = ''; }
  });
  $$('input[name="import-strategy"]').forEach((input) => input.addEventListener('change', () => $('#replace-confirmation-wrap').classList.toggle('hidden', input.value !== 'replace' || !input.checked)));
  $('#activate-import').addEventListener('click', activateImport);
  $('#discard-import').addEventListener('click', async () => { await api.project.discardPreview(); $('#import-dialog').close(); });

  $('#save-project').addEventListener('click', async () => {
    const result = await transferSurfaces.start({ kind: 'project-save' });
    if (result?.status) { projectStatus = result.status; renderProjectDetails(); notification(copy.t('toast.saved'), 'The single encrypted project file was replaced atomically.'); }
  });
  $('#close-project').addEventListener('click', async () => {
    try {
      requireResult(await api.project.close());
      state = null; projectStatus = { open: false }; openDestination('welcome');
      notification('Project saved and closed', 'The app-private history remains available for the next validated open.');
    } catch { /* already reported */ }
  });
  $('#save-copy-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = $('#copy-password').value;
    $('#copy-password').value = '';
    const result = await transferSurfaces.start({ kind: 'project-save-copy', password });
    if (result) notification('Encrypted copy saved', 'The copy contains the complete Git object database, refs, state, and attachments.');
  });

  $('#refresh-history').addEventListener('click', refreshHistory);
  $('#history-from').addEventListener('change', refreshHistory);
  $('#history-to').addEventListener('change', refreshHistory);
  $('#history-label-selected').addEventListener('click', bulkLabelSelection);
  $('#history-clear-selection').addEventListener('click', () => { historySelection.clear(); refreshHistory(); });
  $('#export-history').addEventListener('click', () => openExportDialog({
    collection: 'history',
    rows: historyRows.map((row) => ({ revisionId: row.revisionId, action: row.action, summary: row.summary, timestamp: row.timestamp, label: row.label, current: String(row.current) })),
    columns: [
      { key: 'revisionId', label: 'Revision' }, { key: 'action', label: 'Action' }, { key: 'summary', label: 'Summary' },
      { key: 'timestamp', label: 'Recorded at' }, { key: 'label', label: 'Label' }, { key: 'current', label: 'Current revision' },
    ],
    filterDescription: `${historySearch.describe()}; actions matching ${historyActionFilter.describe()}`,
    omitted: ['encrypted snapshot envelopes', 'answer values'],
  }));
  $('#export-identity').addEventListener('change', (event) => $('#export-confirmation-wrap').classList.toggle('hidden', !event.target.checked));
  $('#export-cancel').addEventListener('click', () => { $('#export-dialog').close(); pendingExport = null; });
  $('#export-run').addEventListener('click', runExport);

  $('#verify-history').addEventListener('click', async () => {
    try { const data = requireResult(await api.history.verify()); notification('History verified', `The app-private Git object graph is valid at ${data.head}.`); } catch { /* already reported */ }
  });
  $('#undo-history').addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: `${copy.dialogEmoji('confirm')}Undo to the previous revision?`,
      body: 'Undo appends a new commit and does not rewrite history. The current revision stays recoverable.',
      confirmLabel: 'Undo',
    });
    if (!confirmed) return;
    try {
      const data = requireResult(await api.history.undo());
      state = data.state; projectStatus = data.status; await refreshHistory(); renderWizard();
      notification('Undo recorded', 'Undo created a new commit and did not rewrite history.');
    } catch { /* already reported */ }
  });

  api.subscribe('transfer:progress', (payload) => transferSurfaces.renderProgress(payload));
  api.subscribe('ollama:stream', (payload) => { if (payload?.kind === 'state') views.models.receiveState(payload.state); });
  api.subscribe('notification:push', (entry) => { views.notifications?.refresh(); announce(`${entry.title}. ${entry.body}`); });
  api.subscribe('schedule:applied', (schedule) => {
    announce(`Presentation schedule evaluated. ${schedule.explanations[0] ?? ''}`);
    refreshSettings();
  });

  try {
    const loaded = requireResult(await api.state.load());
    state = loaded.state; projectStatus = loaded.status;
    openDestination(state ? 'wizard' : 'welcome');
  } catch { openDestination('welcome'); }

  try {
    const status = await api.ocr.runtimeStatus();
    $('#ocr-status').textContent = status.available ? 'Bundled offline OCR assets are available from the packaged resources path.' : status.missing;
    $('#ocr-status').classList.toggle('success-text', status.available);
    $('#ocr-locations').innerHTML = status.searchedLocations.map((location) => `<li><code>${escapeHtml(location)}</code></li>`).join('');
  } catch {
    $('#ocr-status').textContent = 'Bundled offline OCR resource status could not be read from the privileged application boundary.';
  }
}

function showImportPreview(preview) {
  $('#import-summary').innerHTML = `<dl>
    <div><dt>File</dt><dd>${escapeHtml(preview.projectFileName)}</dd></div>
    <div><dt>Tax year</dt><dd>${preview.taxYear}</dd></div>
    <div><dt>History head</dt><dd><code>${escapeHtml(preview.historyHead)}</code></dd></div>
    <div><dt>Attachments</dt><dd>${preview.attachmentCount}</dd></div>
  </dl>`;
  $('#choice-copy').textContent = preview.choices.createCopy.explanation;
  $('#choice-reconcile').textContent = preview.choices.reconcile.explanation;
  $('#choice-replace').textContent = preview.choices.replace.explanation;
  $('input[value="reconcile"]').disabled = !preview.choices.reconcile.enabled;
  $('input[value="replace"]').disabled = !preview.choices.replace.enabled;
  $('input[value="create-copy"]').checked = true;
  $('#replace-confirmation-wrap').classList.add('hidden');
  $('#import-dialog').showModal();
}

async function activateImport(event) {
  event.preventDefault();
  const strategy = $('input[name="import-strategy"]:checked').value;
  let destinationPath = null;
  if (strategy === 'create-copy') {
    const planned = await transferSurfaces.start({ kind: 'project-import-copy' });
    if (!planned) return;
    destinationPath = planned.destinationPath;
  }
  try {
    const data = requireResult(await api.project.activateImport({ strategy, confirmation: $('#replace-confirmation').value, destinationPath }));
    state = data.state; projectStatus = data.status; $('#import-dialog').close(); openDestination('wizard');
    notification('Project activated', strategy === 'reconcile'
      ? 'Both complete histories were preserved and joined with a new reconciliation commit.'
      : 'The validated project is open in app-private storage.');
  } catch { /* already reported */ }
}

boot();
