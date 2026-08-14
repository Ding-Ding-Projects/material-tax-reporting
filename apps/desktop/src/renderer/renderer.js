const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const steps = [
  {
    id: 'start', label: 'Tax year', required: true, type: 'number', min: 2000, max: 2099,
    title: 'Which tax year are you preparing?',
    description: 'Enter the four-digit year printed at the top of the return you are preparing.',
    why: 'Tax forms, calculations, and supporting schedules belong to a specific year and must not be mixed.',
    where: 'Look at the year printed on the first page of your blank T1 Income Tax and Benefit Return.',
    example: 'A person preparing their 2025 return enters “2025”.',
    impact: 'T1 Income Tax and Benefit Return, page 1 — tax year field in the return header.',
  },
  {
    id: 'residence', label: 'Residence', required: true, type: 'select',
    title: 'Where did you live on December 31 of that tax year?',
    description: 'Choose the province or territory where you lived at the end of the year.',
    why: 'The return uses this answer to select the provincial or territorial forms that belong in your mail-in package.',
    where: 'Use your home address on December 31. If you moved near year-end or lived outside Canada, check the applicable CRA guidance before answering.',
    example: 'A person whose home was in Ottawa on December 31 chooses “Ontario”.',
    impact: 'T1 Income Tax and Benefit Return, page 1 — “Province or territory of residence on December 31” field.',
    options: ['Alberta','British Columbia','Manitoba','New Brunswick','Newfoundland and Labrador','Northwest Territories','Nova Scotia','Nunavut','Ontario','Prince Edward Island','Quebec','Saskatchewan','Yukon','Outside Canada'],
  },
  {
    id: 'dependants', label: 'Dependants', required: true, type: 'choice',
    title: 'Will you enter information about any dependants?',
    description: 'Choose yes if another person may be included in a dependant-related calculation or schedule.',
    why: 'A yes answer opens a separate step so each dependant can be reviewed without crowding this question.',
    where: 'Check your household records and any CRA correspondence. Do not guess eligibility from this question alone.',
    example: 'A parent who expects to enter information about one child chooses “Yes”.',
    impact: 'T1 line 30400; T1 line 30425; T1 line 30450; and Schedule 5 lines carrying those claims — only when a later eligibility review selects the applicable claim.',
    options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }],
  },
  {
    id: 'dependant-count', label: 'Dependant count', required: true, type: 'number', min: 1, max: 30,
    when: (answers) => answers.dependants === 'yes',
    title: 'How many dependants will you review?',
    description: 'Enter only the number of people you plan to review. Names and identifiers are collected separately by the relevant form flow.',
    why: 'This creates the right number of review entries without putting personal details in navigation or local-history titles.',
    where: 'Count the people whose dependant information you intend to review for this return.',
    example: 'A person reviewing information for two children enters “2”.',
    impact: 'T1 line 30400, line 30425, or line 30450 and the corresponding Schedule 5 line — no line is populated until the later eligibility review identifies the applicable claim.',
  },
  {
    id: 'income-sources', label: 'Income sources', required: true, type: 'multi',
    title: 'Which kinds of income documents do you have?',
    description: 'Select every kind that applies. You can change this later.',
    why: 'This determines which slip entry points appear. Selecting a kind does not create income until you review and accept a value.',
    where: 'Look at the title in the top corner of each official slip you received.',
    example: 'A person with employment income and bank interest selects “T4” and “T5”.',
    impact: 'T4 box 14 → T1 line 10100; T5 box 13 → T1 line 12100. Another slip remains a draft until its adapter supplies an exact official box-to-line mapping.',
    options: [{ value: 't4', label: 'T4 — Employment income' }, { value: 't5', label: 'T5 — Investment income' }, { value: 'other', label: 'Another slip or income record' }, { value: 'none', label: 'None yet' }],
  },
  {
    id: 'slips', label: 'Slip entry', required: false, type: 'upload',
    title: 'Would you like to add a slip file now?',
    description: 'Choose a local slip file for the parser, or continue and enter values manually later.',
    why: 'A parser can save typing, but every extracted value remains a draft until you inspect and correct it.',
    where: 'Use the original local file you received. Avoid screenshots that crop boxes or labels.',
    example: 'A person chooses a local T4 PDF, reviews each extracted box, and corrects any mismatch before saving.',
    impact: 'T4 box 14 → T1 line 10100; T5 box 13 → T1 line 12100. Every other parsed box is blocked until the parser adapter returns an exact form-and-line destination.',
  },
  {
    id: 'deductions', label: 'Deductions', required: true, type: 'choice',
    title: 'Do you have deduction records to review?',
    description: 'Choose yes if you have records such as an RRSP contribution receipt or union dues.',
    why: 'This opens the relevant deduction questions. It does not assume that an amount is eligible.',
    where: 'Check official receipts, slips, and prior CRA notices. Keep each document for the final attachment review.',
    example: 'A person with an RRSP contribution receipt chooses “Yes”.',
    impact: 'RRSP deduction → T1 line 20800; annual union, professional, or similar dues → T1 line 21200. Other records remain unmapped until their exact line is selected during entry.',
    options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'not-sure', label: 'I am not sure yet' }],
  },
  {
    id: 'review', label: 'Manual review', required: true, type: 'review',
    title: 'Complete the final manual review',
    description: 'Export and print stay locked until every item below is acknowledged.',
    why: 'A mail-in package must be checked by a person. No automatic filing or direct CRA transmission is available.',
    where: 'Compare the generated package with your original slips, receipts, identity information, current CRA mailing guidance, and signature requirements.',
    example: 'A person checks every listed item, corrects a mailing address, repeats the review, and then exports the package.',
    impact: 'Every populated line named in this review map, every generated calculation sheet, every attachment entry, the package mailing-address block, and every signature/date field.',
  },
];

const reviewItems = {
  forms: 'I inspected every populated form and every populated form line.',
  calculations: 'I inspected every calculation and compared its inputs with my records.',
  attachments: 'I inspected every required attachment and confirmed it belongs to this return.',
  mailingAddress: 'I checked the current CRA mailing address that applies to this return.',
  signatures: 'I checked every signature and date field and know which fields must be signed after printing.',
};

let appState;
let visibleSteps = [];
let currentIndex = 0;
let selectedRevisionIds = new Set();
let loadedHistoryRows = [];
let regexTarget = null;
const regexState = new Map();

function notify(title, message, kind = 'info', persistent = false) {
  const node = document.createElement('div');
  node.className = `notification ${kind}`;
  node.innerHTML = `<strong></strong><span></span>`;
  node.querySelector('strong').textContent = title;
  node.querySelector('span').textContent = message;
  $('#notification-region').append(node);
  if (!persistent) setTimeout(() => node.remove(), kind === 'error' ? 9000 : 4500);
}

function showPanel(panelId, focusSelector) {
  $$('.page-panel').forEach((panel) => { panel.hidden = panel.id !== panelId; panel.classList.toggle('active', panel.id === panelId); });
  $$('.rail-tab').forEach((tab) => { const active = tab.dataset.panel === panelId; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); });
  requestAnimationFrame(() => (focusSelector ? $(focusSelector) : document.getElementById(panelId))?.focus());
  if (panelId === 'history-panel') loadHistory();
}

function activeSteps() { return steps.filter((step) => !step.when || step.when(appState.wizard.answers)); }

function setWizardStep(stepId) {
  visibleSteps = activeSteps();
  const found = visibleSteps.findIndex((step) => step.id === stepId);
  currentIndex = found >= 0 ? found : 0;
  appState.wizard.currentStepId = visibleSteps[currentIndex].id;
  renderWizard();
}

function answerValue(step) {
  if (step.type === 'multi') return $$('[name="wizard-answer"]:checked').map((input) => input.value);
  if (step.type === 'review') return Object.fromEntries(Object.keys(reviewItems).map((key) => [key, $(`#review-${key}`).checked]));
  if (step.type === 'upload') return appState.wizard.answers[step.id] || { skipped: true };
  return $('[name="wizard-answer"]:checked')?.value ?? $('[name="wizard-answer"]')?.value ?? '';
}

function validate(step, value) {
  if (!step.required) return '';
  if (step.type === 'multi' && (!Array.isArray(value) || value.length === 0)) return 'Select at least one answer before continuing.';
  if (step.type === 'review' && !Object.values(value).every(Boolean)) return 'Acknowledge every review item before export or print can be requested.';
  if (step.type === 'number' && (!value || Number(value) < step.min || Number(value) > step.max)) return `Enter a whole number from ${step.min} to ${step.max}.`;
  if ((step.type === 'choice' || step.type === 'select') && !value) return 'Choose an answer before continuing.';
  return '';
}

function makeAnswerControl(step) {
  const saved = appState.wizard.answers[step.id];
  if (step.type === 'number') return `<label><span>Your answer</span><input name="wizard-answer" type="number" min="${step.min}" max="${step.max}" step="1" value="${saved ?? ''}" /></label>`;
  if (step.type === 'select') return `<label><span>Your answer</span><select name="wizard-answer"><option value="">Choose one</option>${step.options.map((item) => `<option ${saved === item ? 'selected' : ''}>${item}</option>`).join('')}</select></label>`;
  if (step.type === 'choice') return `<div class="choice-list">${step.options.map((item) => `<label class="choice"><input name="wizard-answer" type="radio" value="${item.value}" ${saved === item.value ? 'checked' : ''} />${item.label}</label>`).join('')}</div>`;
  if (step.type === 'multi') { const values = Array.isArray(saved) ? saved : []; return `<div class="choice-list">${step.options.map((item) => `<label class="choice"><input name="wizard-answer" type="checkbox" value="${item.value}" ${values.includes(item.value) ? 'checked' : ''} />${item.label}</label>`).join('')}</div>`; }
  if (step.type === 'upload') return `<div class="slip-upload"><label><span>Choose a local slip file</span><input id="slip-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.json" /></label><button id="parse-slip" type="button" class="tonal-button">Read selected slip</button><p id="slip-status" class="slip-status">No file selected. Manual entry remains available.</p></div>`;
  if (step.type === 'review') return `<div class="review-checklist">${Object.entries(reviewItems).map(([key, text]) => `<label><input id="review-${key}" type="checkbox" ${appState.review[key] ? 'checked' : ''} /> <span>${text}</span></label>`).join('')}</div><div class="locked-export"><strong id="export-lock-state">Export and print are locked.</strong><span id="export-lock-detail">Complete every acknowledgement above.</span><button id="export-package" type="button" class="filled-button" disabled>Export / print reviewed mail-in package</button></div>`;
  return '';
}

function renderWizard() {
  visibleSteps = activeSteps();
  const step = visibleSteps[currentIndex];
  const completed = new Set(appState.wizard.completedSteps);
  const percent = Math.round((completed.size / visibleSteps.length) * 100);
  $('#progress-text').textContent = `Step ${currentIndex + 1} of ${visibleSteps.length}`;
  $('#progress-percent').textContent = `${percent}%`;
  $('#progress-fill').style.width = `${percent}%`;
  $('#progress-map').innerHTML = visibleSteps.map((item, index) => `<li class="${index === currentIndex ? 'current' : ''} ${completed.has(item.id) ? 'complete' : ''}"><span class="progress-index">${completed.has(item.id) ? '✓' : index + 1}</span><span>${item.label}</span></li>`).join('');
  $('#step-number').textContent = `Step ${currentIndex + 1}`;
  $('#required-chip').textContent = step.required ? 'Required' : 'Optional';
  $('#question-title').textContent = step.title;
  $('#question-description').textContent = step.description;
  $('#why-text').textContent = step.why;
  $('#where-text').textContent = step.where;
  $('#example-text').textContent = step.example;
  $('#impact-text').textContent = step.impact;
  $('#show-impact').href = `#review-map-${step.id}`;
  $('#review-map-list').innerHTML = visibleSteps.map((item) => `<li id="review-map-${item.id}"><a href="#question-title" data-review-step="${escapeHtml(item.id)}">${escapeHtml(item.label)}</a>: ${escapeHtml(item.impact)}</li>`).join('');
  $$('[data-review-step]').forEach((link) => link.addEventListener('click', () => setWizardStep(link.dataset.reviewStep)));
  $('#answer-host').innerHTML = makeAnswerControl(step);
  $('#validation-message').textContent = '';
  $('#back-step').disabled = currentIndex === 0;
  $('#next-step').textContent = currentIndex === visibleSteps.length - 1 ? 'Save completed review' : 'Save answer and continue';
  if (step.type === 'upload') $('#parse-slip').addEventListener('click', parseSlip);
  if (step.type === 'review') {
    Object.keys(reviewItems).forEach((key) => $(`#review-${key}`).addEventListener('change', updateReviewLock));
    $('#export-package').addEventListener('click', requestPackageExport);
    updateReviewLock();
  }
}

async function commitWizardAnswer() {
  const step = visibleSteps[currentIndex];
  const value = answerValue(step);
  const problem = validate(step, value);
  if (problem) { $('#validation-message').textContent = problem; return; }
  const nextState = structuredClone(appState);
  nextState.wizard.answers[step.id] = value;
  if (!nextState.wizard.completedSteps.includes(step.id)) nextState.wizard.completedSteps.push(step.id);
  nextState.wizard.lastSavedAt = new Date().toISOString();
  if (step.type === 'review') nextState.review = value;
  const remaining = steps.filter((candidate) => !candidate.when || candidate.when(nextState.wizard.answers));
  const nextIndex = remaining.findIndex((candidate) => candidate.id === step.id) + 1;
  nextState.wizard.currentStepId = remaining[Math.min(nextIndex, remaining.length - 1)].id;
  const result = await window.taxDesktop.appState.mutate({
    action: 'wizard-answer', stableId: `wizard:${step.id}`, summary: 'Updated a guided-return answer', nextState,
    metadata: { surface: 'guided-return', fieldId: step.id, formImpact: step.impact },
  });
  if (!result.ok) { notify('Change not saved', result.message, 'error', true); return; }
  appState = result.state;
  visibleSteps = activeSteps();
  currentIndex = Math.min(nextIndex, visibleSteps.length - 1);
  renderWizard();
  notify('Progress saved', 'The answer and its encrypted local-history revision were recorded.', 'success');
}

async function parseSlip() {
  const file = $('#slip-file').files[0];
  if (!file) { $('#slip-status').textContent = 'Choose a local file first.'; return; }
  $('#slip-status').textContent = 'Reading the selected file locally…';
  const result = await window.taxDesktop.slips.parse({ fileName: file.name, mediaType: file.type, bytes: [...new Uint8Array(await file.arrayBuffer())] });
  if (!result.ok) { $('#slip-status').textContent = result.message; notify('Slip was not imported', result.message, 'error'); return; }
  const nextState = structuredClone(appState);
  nextState.imports.push({ id: crypto.randomUUID(), kind: 'slip-parser-draft', importedAt: new Date().toISOString(), status: 'correction-required', valueCount: result.values.length });
  const saved = await window.taxDesktop.appState.mutate({ action: 'import', stableId: 'slip-import', summary: 'Imported a local slip draft for manual correction', nextState, metadata: { source: 'slip-parser', requiresCorrection: true } });
  if (!saved.ok) { notify('Import not accepted', saved.message, 'error', true); return; }
  appState = saved.state;
  $('#slip-status').textContent = `${result.values.length} draft values were found. Each one requires manual review and correction before use.`;
}

function updateReviewLock() {
  const complete = Object.keys(reviewItems).every((key) => $(`#review-${key}`)?.checked);
  $('#export-package').disabled = !complete;
  $('#export-lock-state').textContent = complete ? 'Manual-review acknowledgements complete.' : 'Export and print are locked.';
  $('#export-lock-detail').textContent = complete ? 'The package generator will perform its own final readiness check.' : 'Complete every acknowledgement above.';
}

async function requestPackageExport() {
  const review = Object.fromEntries(Object.keys(reviewItems).map((key) => [key, $(`#review-${key}`).checked]));
  if (!Object.values(review).every(Boolean)) return;
  const savedState = structuredClone(appState); savedState.review = review;
  const stored = await window.taxDesktop.appState.mutate({ action: 'wizard-answer', stableId: 'wizard:manual-review', summary: 'Completed the manual package review checklist', nextState: savedState, metadata: { surface: 'manual-review', complete: true } });
  if (!stored.ok) { notify('Review not saved', stored.message, 'error', true); return; }
  appState = stored.state;
  const result = await window.taxDesktop.packageExport.exportReviewed(review);
  notify(result.ok ? 'Package exported' : 'Package not exported', result.message || 'The reviewed package is ready.', result.ok ? 'success' : 'error', !result.ok);
}

async function saveSettings() {
  const nextState = structuredClone(appState);
  nextState.settings = { language: $('#language-setting').value, englishFunnyLevel: Number($('#english-funny').value), cantoneseFunnyLevel: Number($('#cantonese-funny').value), theme: $('#theme-setting').value, showDialogEmoji: $('#emoji-setting').checked };
  const result = await window.taxDesktop.appState.mutate({ action: 'settings-mutation', stableId: 'settings:presentation', summary: 'Updated local presentation settings', nextState, metadata: { surface: 'settings' } });
  if (!result.ok) { notify('Setting not changed', result.message, 'error', true); return; }
  appState = result.state; applySettings(); notify('Settings saved', 'The setting and its local-history revision were recorded.', 'success');
}

function applySettings() {
  const settings = appState.settings;
  document.documentElement.lang = settings.language === 'zh-HK' ? 'zh-HK' : 'en';
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('#language-setting').value = settings.language; $('#english-funny').value = settings.englishFunnyLevel; $('#cantonese-funny').value = settings.cantoneseFunnyLevel; $('#theme-setting').value = settings.theme; $('#emoji-setting').checked = settings.showDialogEmoji;
}

function textMatcher(inputId) {
  const value = document.getElementById(inputId).value;
  const state = regexState.get(inputId);
  if (!state?.enabled) return (text) => text.toLocaleLowerCase().includes(value.toLocaleLowerCase());
  try { const expression = new RegExp(state.pattern, state.flags); return (text) => expression.test(text); } catch { return () => false; }
}

async function loadHistory() {
  if (!appState.historyAvailable) { $('#history-list').innerHTML = `<div class="empty-state">${appState.historyFailure}</div>`; return; }
  const filters = { text: $('#history-search').value, from: $('#history-from').value, to: $('#history-to').value, actions: $('#history-action').value ? [$('#history-action').value] : [] };
  const queryResult = await window.taxDesktop.history.query(filters);
  if (!queryResult.ok) { historyFailure('History could not be loaded', queryResult); return; }
  const revisions = queryResult.data;
  loadedHistoryRows = revisions;
  const matcher = textMatcher('history-search');
  const shown = revisions.filter((revision) => matcher(`${revision.action} ${revision.summary} ${revision.label || ''}`));
  const actions = [...new Set(revisions.map((revision) => revision.action))].sort();
  const selectedAction = $('#history-action').value;
  $('#history-action').innerHTML = `<option value="">All actions</option>${actions.map((action) => `<option ${action === selectedAction ? 'selected' : ''}>${escapeHtml(action)}</option>`).join('')}`;
  $('#history-list').innerHTML = shown.length ? shown.map((revision) => `<button class="history-row" role="option" aria-selected="false" data-revision="${escapeHtml(revision.revisionId)}"><strong>${escapeHtml(revision.summary)}</strong><small>${escapeHtml(revision.action)} · ${escapeHtml(new Date(revision.createdAt).toLocaleString())}</small><small>${escapeHtml(revision.label || 'No label')}</small></button>`).join('') : '<div class="empty-state">No revisions match the current filters.</div>';
  $$('.history-row').forEach((row) => row.addEventListener('click', () => selectRevision(row.dataset.revision)));
  const storageResult = await window.taxDesktop.history.storage();
  if (!storageResult.ok) { historyFailure('Storage use could not be loaded', storageResult); return; }
  const storage = storageResult.data;
  $('#storage-use').textContent = `Storage use: ${formatBytes(storage.totalBytes || 0)} across ${storage.revisionCount || revisions.length} revisions`;
}

async function selectRevision(id) {
  $$('.history-row').forEach((row) => row.setAttribute('aria-selected', String(row.dataset.revision === id)));
  selectedRevisionIds = new Set([id]);
  const currentPosition = loadedHistoryRows.findIndex((row) => row.revisionId === id);
  const olderRevision = loadedHistoryRows[currentPosition + 1]?.revisionId || id;
  const diffResult = await window.taxDesktop.history.diff(olderRevision, id);
  if (!diffResult.ok) { historyFailure('Revision difference could not be loaded', diffResult); return; }
  const diff = diffResult.data;
  const changes = diff.changes || [];
  $('#history-detail').className = '';
  $('#history-detail').innerHTML = `<p>${changes.length} changed field${changes.length === 1 ? '' : 's'} in this encrypted snapshot.</p><div class="diff-grid"><section><h3>Before</h3><pre>${escapeHtml(changes.map((change) => `${change.path}: ${JSON.stringify(change.before)}`).join('\n') || 'No earlier revision is available.')}</pre></section><section><h3>After</h3><pre>${escapeHtml(changes.map((change) => `${change.path}: ${JSON.stringify(change.after)}`).join('\n') || 'No changes against the selected comparison.')}</pre></section></div><label><span>Revision label</span><input id="revision-label" type="text" maxlength="80" /></label><div class="wizard-actions"><button id="label-revision" class="tonal-button" type="button">Save label</button><button id="restore-revision" class="filled-button" type="button">Restore as a new revision</button></div>`;
  $('#label-revision').addEventListener('click', async () => { const result = await window.taxDesktop.history.label(id, $('#revision-label').value); if (!result.ok) { historyFailure('Revision label was not saved', result); return; } notify('Label saved', 'The label was recorded without taxpayer values.', 'success'); loadHistory(); });
  $('#restore-revision').addEventListener('click', async () => { const result = await window.taxDesktop.history.restore(id, 'restore'); if (!result.ok) { historyFailure('Revision was not restored', result); return; } appState = result.data.state; applySettings(); setWizardStep(appState.wizard.currentStepId); notify('Revision restored', 'The restore was appended as a new local revision.', 'success'); loadHistory(); });
}

function formatBytes(bytes) { const units = ['B','KB','MB','GB']; let value = bytes; let unit = 0; while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; } return `${value.toFixed(unit ? 1 : 0)} ${units[unit]}`; }
function escapeHtml(value) { const node = document.createElement('span'); node.textContent = String(value); return node.innerHTML; }
function historyFailure(title, result) {
  const error = result?.error || {};
  const details = [error.code, error.message, error.recovery].filter(Boolean).join(' — ');
  notify(title, details || 'Local history returned an unknown recovery error.', 'error', true);
}

const commands = [
  { title: 'Open guided return', detail: 'Guided return', run: () => showPanel('wizard-panel', '#question-title') },
  { title: 'Open local history', detail: 'Local history', run: () => showPanel('history-panel', '#history-search') },
  { title: 'Change language', detail: 'Settings · Language', run: () => showPanel('settings-panel', '#language-setting') },
  { title: 'Change English funny level', detail: 'Settings · Presentation', run: () => showPanel('settings-panel', '#english-funny') },
  { title: 'Change Cantonese funny level', detail: 'Settings · Presentation', run: () => showPanel('settings-panel', '#cantonese-funny') },
  { title: 'Review mail-in boundary', detail: 'How this works', run: () => showPanel('help-panel') },
];

function renderPalette() {
  const match = textMatcher('palette-search');
  const results = commands.filter((command) => match(`${command.title} ${command.detail}`));
  $('#palette-results').innerHTML = results.length ? results.map((command, index) => `<button type="button" class="palette-result" data-command="${commands.indexOf(command)}"><strong>${command.title}</strong><small>${command.detail}</small></button>`).join('') : '<div class="empty-state">No command matches this search.</div>';
  $$('.palette-result').forEach((button) => button.addEventListener('click', () => { $('#palette-dialog').close(); commands[Number(button.dataset.command)].run(); }));
}

function openRegexBuilder(targetId) {
  regexTarget = targetId;
  const current = regexState.get(targetId) || { enabled: false, pattern: document.getElementById(targetId).value, flags: 'i' };
  $('#regex-enabled').checked = current.enabled; $('#regex-pattern').value = current.pattern; $('#regex-ignore-case').checked = current.flags.includes('i'); $('#regex-multiline').checked = current.flags.includes('m'); $('#regex-sample').value = document.getElementById(targetId).value;
  updateRegexFeedback(); $('#regex-dialog').showModal();
}

function updateRegexFeedback() {
  try { const expression = new RegExp($('#regex-pattern').value, `${$('#regex-ignore-case').checked ? 'i' : ''}${$('#regex-multiline').checked ? 'm' : ''}`); const matches = [...$('#regex-sample').value.matchAll(new RegExp(expression.source, expression.flags.includes('g') ? expression.flags : `${expression.flags}g`))]; $('#regex-feedback').textContent = `${matches.length} sample match${matches.length === 1 ? '' : 'es'}.`; $('#apply-regex').disabled = false; }
  catch (error) { $('#regex-feedback').textContent = `Pattern error: ${error.message}`; $('#apply-regex').disabled = true; }
}

function wireEvents() {
  $('#minimize-window').addEventListener('click', window.taxDesktop.window.minimize); $('#maximize-window').addEventListener('click', window.taxDesktop.window.maximize); $('#close-window').addEventListener('click', window.taxDesktop.window.close);
  $$('.rail-tab').forEach((tab) => tab.addEventListener('click', () => showPanel(tab.dataset.panel)));
  $('#back-step').addEventListener('click', () => { if (currentIndex > 0) { currentIndex -= 1; renderWizard(); } });
  $('#next-step').addEventListener('click', commitWizardAnswer);
  $('#save-progress').addEventListener('click', () => notify('Progress is saved after each answer', appState.wizard.lastSavedAt ? `Last saved ${new Date(appState.wizard.lastSavedAt).toLocaleString()}.` : 'Save the current answer to create the first revision.', 'info'));
  ['language-setting','english-funny','cantonese-funny','theme-setting','emoji-setting'].forEach((id) => document.getElementById(id).addEventListener('change', saveSettings));
  $('#settings-search').addEventListener('input', () => { const match = textMatcher('settings-search'); $$('#settings-list .settings-card').forEach((card) => { card.hidden = !match(card.dataset.search); }); });
  ['history-search','history-from','history-to','history-action'].forEach((id) => document.getElementById(id).addEventListener(id === 'history-search' ? 'input' : 'change', loadHistory));
  $('#export-history').addEventListener('click', async () => { const result = await window.taxDesktop.history.exportRedacted(); if (!result.ok) { historyFailure('Redacted history was not exported', result); return; } notify('Redacted history exported', 'Taxpayer values and encrypted snapshots were excluded.', 'success'); });
  $('#open-prune').addEventListener('click', () => { if (!selectedRevisionIds.size) { notify('Choose revisions first', 'Select a revision before opening pruning confirmation.', 'error'); return; } $('#prune-dialog').showModal(); });
  const updatePrune = () => { const keys = $('#prune-key-one').checked && $('#prune-key-two').checked; $('#prune-slider').disabled = !keys; const ready = keys && Number($('#prune-slider').value) === 100; $('#confirm-prune').disabled = !ready; $('#prune-status').textContent = ready ? 'Final confirmation complete.' : keys ? 'Move the slider fully to confirm.' : 'Operate both acknowledgements to enable the final slider.'; };
  ['prune-key-one','prune-key-two','prune-slider'].forEach((id) => document.getElementById(id).addEventListener('input', updatePrune));
  $('#confirm-prune').addEventListener('click', async (event) => { event.preventDefault(); const firstKey = $('#prune-key-one').checked; const secondKey = $('#prune-key-two').checked; const sliderPercent = Number($('#prune-slider').value); const result = await window.taxDesktop.history.prune({ revisionIds: [...selectedRevisionIds], superConfirmation: { firstKey, secondKey, sliderPercent, acknowledgedIrreversible: firstKey } }); if (!result.ok) { historyFailure('Pruning did not run', result); return; } $('#prune-dialog').close(); notify('Selected revisions pruned', 'The explicit pruning action was recorded locally.', 'success'); loadHistory(); });
  $('#open-palette').addEventListener('click', () => { $('#palette-dialog').showModal(); renderPalette(); });
  $('#palette-search').addEventListener('input', renderPalette);
  document.addEventListener('keydown', (event) => { if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') { event.preventDefault(); $('#palette-dialog').showModal(); renderPalette(); } });
  $$('.regex-button').forEach((button) => button.addEventListener('click', (event) => { event.preventDefault(); openRegexBuilder(button.dataset.regexFor); }));
  ['regex-pattern','regex-ignore-case','regex-multiline','regex-sample'].forEach((id) => document.getElementById(id).addEventListener('input', updateRegexFeedback));
  $$('.builder-parts button').forEach((button) => button.addEventListener('click', () => { const input = $('#regex-pattern'); const start = input.selectionStart; input.value = `${input.value.slice(0, start)}${button.dataset.pattern}${input.value.slice(input.selectionEnd)}`; input.focus(); input.setSelectionRange(start + button.dataset.pattern.length, start + button.dataset.pattern.length); updateRegexFeedback(); }));
  $('#apply-regex').addEventListener('click', (event) => { event.preventDefault(); regexState.set(regexTarget, { enabled: $('#regex-enabled').checked, pattern: $('#regex-pattern').value, flags: `${$('#regex-ignore-case').checked ? 'i' : ''}${$('#regex-multiline').checked ? 'm' : ''}` }); document.getElementById(regexTarget).value = $('#regex-pattern').value; $('#regex-dialog').close(); document.getElementById(regexTarget).dispatchEvent(new Event('input')); });
}

async function start() {
  appState = await window.taxDesktop.appState.load();
  applySettings(); wireEvents(); setWizardStep(appState.wizard.currentStepId);
  if (!appState.historyAvailable) notify('Local history unavailable', appState.historyFailure, 'error', true);
}

start();
