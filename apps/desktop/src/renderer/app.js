'use strict';

const api = window.taxDesktop;
let state = null;
let projectStatus = { open: false };
let currentStep = 0;
let importPreview = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function notification(title, message, type = 'info') {
  const region = $('#notifications');
  const item = document.createElement('div');
  item.className = `notification ${type === 'error' ? 'error' : ''}`;
  item.innerHTML = `<div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div><button aria-label="Dismiss notification">×</button>`;
  item.querySelector('button').addEventListener('click', () => item.remove());
  region.append(item);
  if (type !== 'error') setTimeout(() => item.remove(), 6000);
}

function requireResult(result) {
  if (result?.ok) return result.data;
  const error = result?.error || { message: 'The operation did not complete.', recovery: 'Retry without closing the application.' };
  notification(error.code || 'Operation failed', `${error.message}${error.recovery ? ` ${error.recovery}` : ''}`, 'error');
  throw new Error(error.message);
}

const steps = [
  {
    field: 'profile.fullName',
    title: 'What is your legal name for this return?',
    what: 'Enter the name that should appear on the tax forms.',
    why: 'The paper return must match the identity information CRA uses for you.',
    where: 'Use the name on your CRA correspondence or identity records.',
    example: 'Example format: given name, optional middle name, family name.',
    validation: 'A name is required and is limited to 200 characters.',
    next: 'Next, you will enter the Social Insurance Number used on the return.',
    render: (value) => `<label for="answer">Legal name<input id="answer" maxlength="200" autocomplete="name" value="${escapeHtml(value)}"></label>`,
    read: () => $('#answer').value.trim(),
    valid: (value) => value.length > 0 && value.length <= 200,
  },
  {
    field: 'profile.socialInsuranceNumber',
    title: 'What Social Insurance Number belongs on this return?',
    what: 'Enter all 9 digits. Spaces and hyphens are accepted while typing.',
    why: 'CRA uses this identifier to associate the paper return with the taxpayer.',
    where: 'Use your own trusted records. Do not copy it into support messages or notes.',
    example: 'Example format: three groups of three digits. No example number is prefilled.',
    validation: 'The saved value must contain exactly 9 digits.',
    next: 'Next, you will provide the date of birth used on the return.',
    render: (value) => `<label for="answer">Social Insurance Number<input id="answer" inputmode="numeric" maxlength="11" autocomplete="off" value="${escapeHtml(value)}"></label>`,
    read: () => $('#answer').value.trim(),
    valid: (value) => /^\d{3}[ -]?\d{3}[ -]?\d{3}$/.test(value),
  },
  {
    field: 'profile.dateOfBirth',
    title: 'What date of birth belongs on this return?',
    what: 'Choose the taxpayer date of birth.',
    why: 'The return identity section needs the same date CRA has on record.',
    where: 'Use a trusted identity record.',
    example: 'The control stores the complete date as YYYY-MM-DD.',
    validation: 'A complete date is required.',
    next: 'Next, you will confirm the province used for this Ontario-focused report.',
    render: (value) => `<label for="answer">Date of birth<input id="answer" type="date" autocomplete="bday" value="${escapeHtml(value)}"></label>`,
    read: () => $('#answer').value,
    valid: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value),
  },
  {
    field: 'residency.province',
    title: 'Is Ontario the province used for this report?',
    what: 'Confirm that this project is for an Ontario personal return.',
    why: 'The current rule sources and calculation package are scoped to Canada and Ontario.',
    where: 'Use the province of residence rule that applies on December 31 of the tax year.',
    example: 'This release supports Ontario only and will not guess another province.',
    validation: 'Choose Ontario to continue. For another province, keep the project unchanged.',
    next: 'Next, you will enter the address used for the paper return.',
    render: (value) => `<fieldset><legend>Province</legend><label class="choice"><input id="answer" type="radio" name="province" value="ON" ${value === 'ON' ? 'checked' : ''}><span><strong>Ontario</strong><small>Use the Canada and Ontario rules recorded in this project.</small></span></label></fieldset>`,
    read: () => $('#answer')?.checked ? 'ON' : '',
    valid: (value) => value === 'ON',
  },
  {
    field: 'residency.address',
    title: 'What mailing address should appear on the return?',
    what: 'Enter the complete address CRA should use for correspondence.',
    why: 'A paper return needs a reviewable mailing address and contact destination.',
    where: 'Use the address that applies under the tax-year return instructions.',
    example: 'Include unit, street, city, province, and postal code as applicable.',
    validation: 'An address is required and is limited to 500 characters.',
    next: 'Next, you will confirm that you gathered the income documents for this report.',
    render: (value) => `<label for="answer">Return address<textarea id="answer" maxlength="500" autocomplete="street-address">${escapeHtml(value)}</textarea></label>`,
    read: () => $('#answer').value.trim(),
    valid: (value) => value.length > 0 && value.length <= 500,
  },
  {
    field: 'income.reviewedAllDocuments',
    title: 'Have you gathered and reviewed the income documents for this report?',
    what: 'Confirm only after checking the slips, statements, and other income records you expect.',
    why: 'Missing income documents can make a prepared paper return incomplete.',
    where: 'Check the original documents and your own records; this application does not contact CRA.',
    example: 'If a document is still expected, leave this unchecked and return later.',
    validation: 'The confirmation must be checked before moving forward.',
    next: 'Next, you can attach local documents for encrypted storage and manual parser confirmation.',
    render: (value) => `<label class="choice"><input id="answer" type="checkbox" ${value ? 'checked' : ''}><span><strong>I reviewed the income documents I expect</strong><small>This confirmation does not file or transmit anything.</small></span></label>`,
    read: () => $('#answer').checked,
    valid: (value) => value === true,
  },
  {
    kind: 'attachments',
    title: 'Which local documents belong with this project?',
    what: 'Add only the documents needed for this report. Each file is encrypted before it enters app-private storage.',
    why: 'Keeping source documents with the report makes later review and correction traceable.',
    where: 'Choose files from your computer. Nothing is uploaded or transmitted.',
    example: 'Add a slip or receipt, then confirm parsed values only after comparing them with the source.',
    validation: 'Every attached document must receive manual parser confirmation before continuing.',
    next: 'Next, you can record deduction notes without pretending the note is a calculated claim.',
    render: renderAttachments,
    read: () => state.attachments,
    valid: (value) => value.every((attachment) => attachment.parserConfirmed),
  },
  {
    field: 'deductions.notes',
    title: 'Are there deduction or credit notes to preserve for manual review?',
    what: 'Record concise reminders about evidence or questions that still need review.',
    why: 'A note keeps uncertainty visible instead of turning it into a guessed tax value.',
    where: 'Use your own records and the official sources recorded with this tax year.',
    example: 'Describe what needs checking; do not treat the note as a completed calculation.',
    validation: 'This optional note is limited to 4,000 characters.',
    next: 'Next, you will record the mailing destination that must be checked before printing.',
    render: (value) => `<label for="answer">Review notes (optional)<textarea id="answer" maxlength="4000">${escapeHtml(value)}</textarea></label>`,
    read: () => $('#answer').value.trim(),
    valid: (value) => value.length <= 4000,
  },
  {
    field: 'delivery.mailingDestination',
    title: 'Which CRA mailing destination will you verify for this paper return?',
    what: 'Record the destination you intend to check against the current official return instructions.',
    why: 'Mailing destinations can depend on location and can change. The app must not silently guess one.',
    where: 'Use the official CRA source recorded for this project and verify it again before mailing.',
    example: 'Record the destination and the reason it applies; do not rely on an old envelope.',
    validation: 'A reviewable destination note is required and is limited to 500 characters.',
    next: 'Finally, you will complete the mandatory manual PDF review checklist.',
    render: (value) => `<label for="answer">Mailing destination review note<textarea id="answer" maxlength="500">${escapeHtml(value)}</textarea></label>`,
    read: () => $('#answer').value.trim(),
    valid: (value) => value.length > 0 && value.length <= 500,
  },
  {
    kind: 'review',
    title: 'Have you manually reviewed every part of the mail-in PDF package?',
    what: 'Review every populated form, calculation, attachment, mailing destination, and signature field.',
    why: 'This explicit review is mandatory before a paper package can be treated as ready to print.',
    where: 'Compare the generated PDF with the source records and current official instructions.',
    example: 'Check each item separately. A single unchecked item means review is incomplete.',
    validation: 'All five acknowledgements are required. This never submits or files the return.',
    next: 'When complete, save the project and use the separately provided mail-in PDF preparation path.',
    render: renderReview,
    read: () => state.review,
    valid: (value) => Object.values(value).every(Boolean),
  },
];

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
  const labels = {
    forms: 'Every populated form matches the intended report data.',
    calculations: 'Every calculation was manually checked.',
    attachments: 'Every attachment belongs to this report and is legible.',
    mailingDestination: 'The mailing destination was checked against current official instructions.',
    signatureFields: 'Every required signature and date field was identified for signing.',
  };
  return `<div class="review-list">${Object.entries(labels).map(([key, label]) => `<label><input type="checkbox" data-review-key="${key}" ${state.review[key] ? 'checked' : ''}><span>${escapeHtml(label)}</span></label>`).join('')}</div><p><strong>No electronic submission:</strong> this application does not offer NETFILE, EFILE, direct CRA transmission, or automatic filing.</p>`;
}

function renderWizard() {
  if (!state) return;
  currentStep = Math.min(Math.max(currentStep, 0), steps.length - 1);
  const step = steps[currentStep];
  $('#progress-bar').style.width = `${((currentStep + 1) / steps.length) * 100}%`;
  $('#progress-label').textContent = `Step ${currentStep + 1} of ${steps.length}`;
  $('#project-chip').textContent = `${projectStatus.projectFileName} · ${projectStatus.taxYear}`;
  const value = step.field ? valueAt(step.field) : step.read();
  $('#question-card').innerHTML = `
    <p class="question-number">Question ${currentStep + 1}</p>
    <h2>${escapeHtml(step.title)}</h2>
    <div class="explanation-grid">
      <div class="explanation"><strong>What</strong>${escapeHtml(step.what)}</div>
      <div class="explanation"><strong>Why</strong>${escapeHtml(step.why)}</div>
      <div class="explanation"><strong>Where to look</strong>${escapeHtml(step.where)}</div>
      <div class="explanation"><strong>Example</strong>${escapeHtml(step.example)}</div>
    </div>
    <div class="answer-area">${step.render(value)}</div>
    <p id="validation" class="validation"><strong>Validation:</strong> ${escapeHtml(step.validation)}</p>
    <p><strong>Next step:</strong> ${escapeHtml(step.next)}</p>`;
  $('#previous-step').disabled = currentStep === 0;
  $('#next-step').textContent = currentStep === steps.length - 1 ? 'Confirm review and save' : 'Save answer and continue';
  wireQuestionActions();
}

function wireQuestionActions() {
  $('#add-attachment')?.addEventListener('click', async () => {
    try { const data = requireResult(await api.attachment.add()); state = data.state; renderWizard(); notification('Attachment encrypted', 'The local file was encrypted and recorded as one new history commit.'); } catch { /* shown */ }
  });
  $$('[data-confirm-attachment]').forEach((button) => button.addEventListener('click', async () => {
    try { const data = requireResult(await api.attachment.confirm(button.dataset.confirmAttachment)); state = data.state; renderWizard(); notification('Parser values confirmed', 'The manual confirmation and source metadata were saved in a new history commit.'); } catch { /* shown */ }
  }));
  $$('[data-remove-attachment]').forEach((button) => button.addEventListener('click', async () => {
    if (!window.confirm('Remove this encrypted attachment from the current project? The history remains append-only.')) return;
    try { const data = requireResult(await api.attachment.remove(button.dataset.removeAttachment)); state = data.state; renderWizard(); notification('Attachment removed', 'Removal was saved as a new history commit.'); } catch { /* shown */ }
  }));
  $$('[data-review-key]').forEach((input) => input.addEventListener('change', async () => {
    try {
      const data = requireResult(await api.state.mutate({ field: `review.${input.dataset.reviewKey}`, value: input.checked }));
      state = data.state; projectStatus = data.status; renderWizard();
      notification('Review acknowledgement saved', 'This checklist change is one append-only history commit.');
    } catch { input.checked = !input.checked; }
  }));
}

async function saveCurrentAndAdvance() {
  const step = steps[currentStep];
  const value = step.read();
  if (!step.valid(value)) {
    $('#validation').scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('#validation').focus?.();
    notification('Answer needs attention', step.validation, 'error');
    return;
  }
  try {
    if (step.field) {
      const data = requireResult(await api.state.mutate({ field: step.field, value }));
      state = data.state; projectStatus = data.status;
    }
    if (currentStep < steps.length - 1) currentStep += 1;
    renderWizard();
    if (currentStep === steps.length - 1 && Object.values(state.review).every(Boolean)) notification('Manual PDF review complete', 'The acknowledgement is saved. Nothing was filed or transmitted.');
  } catch { /* shown */ }
}

function switchPage(pageName) {
  if (!state && pageName !== 'welcome') pageName = 'welcome';
  $$('.page').forEach((page) => page.classList.add('hidden'));
  $$('.rail-item').forEach((item) => item.classList.toggle('selected', item.dataset.page === pageName));
  const page = pageName === 'wizard' ? '#wizard-page' : pageName === 'history' ? '#history-page' : pageName === 'project' ? '#project-page' : '#welcome';
  $(page).classList.remove('hidden');
  if (pageName === 'wizard') renderWizard();
  if (pageName === 'history') refreshHistory();
  if (pageName === 'project') renderProjectDetails();
}

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

async function refreshHistory() {
  if (!state) return;
  const from = $('#history-from').value ? `${$('#history-from').value}T00:00:00.000Z` : '';
  const to = $('#history-to').value ? `${$('#history-to').value}T23:59:59.999Z` : '';
  try {
    const data = requireResult(await api.history.query({ text: $('#history-search').value, action: $('#history-action').value, from, to }));
    const action = $('#history-action').value;
    $('#history-action').innerHTML = `<option value="">All actions</option>${data.actions.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}`;
    $('#history-action').value = action;
    $('#history-empty').classList.toggle('hidden', data.rows.length > 0);
    $('#history-list').innerHTML = data.rows.map((row) => `<article class="history-row ${row.current ? 'current' : ''}" role="listitem">
      <div><strong>${escapeHtml(row.label || row.summary)}</strong><p>${escapeHtml(row.summary)}</p><div class="history-meta"><span>${escapeHtml(row.action)}</span><time>${escapeHtml(row.timestamp)}</time><code>${escapeHtml(row.revisionId)}</code>${row.current ? '<span>Current</span>' : ''}</div></div>
      <div class="history-actions"><button class="text-button" data-diff="${row.revisionId}">Diff</button><button class="text-button" data-label="${row.revisionId}">Label</button>${row.current ? '' : `<button class="tonal" data-restore="${row.revisionId}">Restore</button>`}</div>
    </article>`).join('');
    wireHistoryActions(data.rows.find((row) => row.current)?.revisionId);
  } catch { /* shown */ }
}

function wireHistoryActions(currentRevisionId) {
  $$('[data-diff]').forEach((button) => button.addEventListener('click', async () => {
    try {
      const data = requireResult(await api.history.diff(button.dataset.diff, currentRevisionId));
      $('#diff-content').innerHTML = data.changedPaths.length ? `<ul>${data.changedPaths.map((item) => `<li><code>${escapeHtml(item)}</code></li>`).join('')}</ul>` : '<p>No state paths differ.</p>';
      $('#diff-dialog').showModal();
    } catch { /* shown */ }
  }));
  $$('[data-label]').forEach((button) => button.addEventListener('click', async () => {
    const label = window.prompt('Enter a local revision label (80 characters maximum).', '');
    if (label === null) return;
    try { requireResult(await api.history.label(button.dataset.label, label)); await refreshHistory(); notification('Label saved', 'The label was added in the app-private local history.'); } catch { /* shown */ }
  }));
  $$('[data-restore]').forEach((button) => button.addEventListener('click', async () => {
    if (!window.confirm('Restore this revision as a new append-only history commit? The current revision will remain recoverable.')) return;
    try { const data = requireResult(await api.history.restore(button.dataset.restore)); state = data.state; projectStatus = data.status; await refreshHistory(); renderWizard(); notification('Revision restored', 'Restore created a new commit; prior history was not rewritten.'); } catch { /* shown */ }
  }));
}

function showImportPreview(preview) {
  importPreview = preview;
  $('#import-summary').innerHTML = `<dl>
    <div><dt>File</dt><dd>${escapeHtml(preview.projectFileName)}</dd></div>
    <div><dt>Tax year</dt><dd>${preview.taxYear}</dd></div>
    <div><dt>History head</dt><dd><code>${escapeHtml(preview.historyHead)}</code></dd></div>
    <div><dt>Attachments</dt><dd>${preview.attachmentCount}</dd></div>
  </dl>`;
  $('#choice-copy').textContent = preview.choices.createCopy.explanation;
  $('#choice-reconcile').textContent = preview.choices.reconcile.explanation;
  $('#choice-replace').textContent = preview.choices.replace.explanation;
  const reconcile = $('input[value="reconcile"]'); reconcile.disabled = !preview.choices.reconcile.enabled;
  const replace = $('input[value="replace"]'); replace.disabled = !preview.choices.replace.enabled;
  $('input[value="create-copy"]').checked = true;
  $('#replace-confirmation-wrap').classList.add('hidden');
  $('#import-dialog').showModal();
}

async function activateImport(event) {
  event.preventDefault();
  const strategy = $('input[name="import-strategy"]:checked').value;
  try {
    const data = requireResult(await api.project.activateImport({ strategy, confirmation: $('#replace-confirmation').value }));
    state = data.state; projectStatus = data.status; importPreview = null; $('#import-dialog').close(); switchPage('wizard');
    notification('Project activated', strategy === 'reconcile' ? 'Both complete histories were preserved and joined with a new reconciliation commit.' : 'The validated project is open in app-private storage.');
  } catch { /* shown */ }
}

async function boot() {
  $('#minimize').addEventListener('click', api.window.minimize);
  $('#maximize').addEventListener('click', api.window.maximize);
  $('#close').addEventListener('click', api.window.close);
  $$('.rail-item').forEach((button) => button.addEventListener('click', () => switchPage(button.dataset.page)));
  $('#previous-step').addEventListener('click', () => { if (currentStep > 0) { currentStep -= 1; renderWizard(); } });
  $('#next-step').addEventListener('click', saveCurrentAndAdvance);
  $$('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => $(`#${button.dataset.closeDialog}`).close()));

  $('#create-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = $('#create-password').value;
    try {
      const data = requireResult(await api.project.create({ taxYear: Number($('#create-tax-year').value), password }));
      $('#create-password').value = ''; state = data.state; projectStatus = data.status; currentStep = 0; switchPage('wizard');
      notification('Encrypted project created', 'The initial empty report and app-private Git history were saved in one project file.');
    } catch { /* shown */ } finally { $('#create-password').value = ''; }
  });
  $('#open-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = $('#open-password').value;
    try { showImportPreview(requireResult(await api.project.previewImport({ password }))); } catch { /* shown */ } finally { $('#open-password').value = ''; }
  });
  $$('input[name="import-strategy"]').forEach((input) => input.addEventListener('change', () => $('#replace-confirmation-wrap').classList.toggle('hidden', input.value !== 'replace' || !input.checked)));
  $('#activate-import').addEventListener('click', activateImport);
  $('#discard-import').addEventListener('click', async () => { await api.project.discardPreview(); importPreview = null; $('#import-dialog').close(); });

  $('#save-project').addEventListener('click', async () => { try { const data = requireResult(await api.project.save()); projectStatus = data.status; renderProjectDetails(); notification('Project saved', 'The single encrypted project file was replaced atomically.'); } catch { /* shown */ } });
  $('#close-project').addEventListener('click', async () => { try { requireResult(await api.project.close()); state = null; projectStatus = { open: false }; switchPage('welcome'); notification('Project saved and closed', 'The app-private history remains available for the next validated open.'); } catch { /* shown */ } });
  $('#save-copy-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const password = $('#copy-password').value;
    try { requireResult(await api.project.saveCopy({ password })); notification('Encrypted copy saved', 'The copy contains the complete Git object database, refs, state, and attachments.'); } catch { /* shown */ } finally { $('#copy-password').value = ''; }
  });

  $('#refresh-history').addEventListener('click', refreshHistory);
  $('#history-search').addEventListener('input', refreshHistory);
  $('#history-action').addEventListener('change', refreshHistory);
  $('#history-from').addEventListener('change', refreshHistory);
  $('#history-to').addEventListener('change', refreshHistory);
  $('#verify-history').addEventListener('click', async () => { try { const data = requireResult(await api.history.verify()); notification('History verified', `The app-private Git object graph is valid at ${data.head}.`); } catch { /* shown */ } });
  $('#undo-history').addEventListener('click', async () => {
    if (!window.confirm('Restore the previous revision as a new append-only undo commit?')) return;
    try { const data = requireResult(await api.history.undo()); state = data.state; projectStatus = data.status; await refreshHistory(); renderWizard(); notification('Undo recorded', 'Undo created a new commit and did not rewrite history.'); } catch { /* shown */ }
  });

  try {
    const loaded = requireResult(await api.state.load());
    state = loaded.state; projectStatus = loaded.status;
    if (state) switchPage('wizard'); else switchPage('welcome');
  } catch { switchPage('welcome'); }

  try {
    const status = await api.ocr.runtimeStatus();
    $('#ocr-status').textContent = status.available ? 'Bundled offline OCR assets are available from the packaged resources path.' : status.missing;
    $('#ocr-status').classList.toggle('success-text', status.available);
    $('#ocr-locations').innerHTML = status.searchedLocations.map((location) => `<li><code>${escapeHtml(location)}</code></li>`).join('');
  } catch { $('#ocr-status').textContent = 'Bundled offline OCR resource status could not be read from the privileged application boundary.'; }
}

boot();
