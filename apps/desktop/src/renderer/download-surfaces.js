'use strict';

/**
 * Start, Downloading and Complete surfaces for the transfers this application
 * actually performs.
 *
 * Start names the source, the chosen destination, the expected size and the
 * unsigned status, and nothing is written until it is confirmed. Downloading
 * is non-modal, shows bytes written and elapsed time, and offers a cancel that
 * removes the partial temporary file.
 *
 * The terminal surface words itself from the phase the main process actually
 * reported, because not every transfer this application performs ends by
 * writing a file: choosing an import-copy destination deliberately writes
 * nothing until the import is activated, and a conversion that produced no
 * output writes nothing either. A byte count or a digest is shown only where
 * the main process supplied one, and the sentence names what that digest
 * covers rather than leaving the reader to assume.
 *
 * No state here describes a build, an installer or a release, because this
 * repository produces none.
 */

import { announce, confirmDialog, el, formatBytes } from './dom.js';

export function createTransferSurfaces({ api, notify }) {
  const active = new Map();
  // Pending removals for cards that reached a failed progress event, held so a
  // terminal outcome rendered for the same transfer can cancel one. Without
  // that handle the honest failure card a person is reading is removed twelve
  // seconds later without them having dismissed it.
  const removals = new Map();
  const region = el('div', { class: 'transfer-region', id: 'transfer-region', 'aria-label': 'Transfers in progress' });
  document.body.append(region);

  function card(transferId) {
    if (!active.has(transferId)) {
      const node = el('article', { class: 'transfer-card', role: 'status', 'data-appearance-id': 'transfer-card' });
      active.set(transferId, node);
      region.append(node);
    }
    return active.get(transferId);
  }

  function renderProgress(payload) {
    const node = card(payload.transferId);
    const { plan, state, fraction, description } = payload;
    node.replaceChildren(
      el('h3', { text: `${plan.assetName}: ${state.phase === 'downloading' ? 'writing' : state.phase}` }),
      el('p', { text: description }),
      el('div', { class: 'progress-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', ...(fraction === null ? { 'aria-valuetext': 'Size unknown' } : { 'aria-valuenow': String(Math.round(fraction * 100)) }) }, [
        el('div', { class: 'progress-bar', style: `width:${fraction === null ? 100 : Math.round(fraction * 100)}%` }),
      ]),
      el('p', { class: 'supporting', text: `${state.byteCount} bytes written${state.byteTotal === null ? '; the total size is not known in advance' : ` of ${state.byteTotal}`}.` }),
      state.phase === 'downloading'
        ? el('button', {
          type: 'button',
          class: 'text-button',
          onClick: async () => { await api.transfers.cancel(payload.transferId); },
        }, 'Cancel and remove the partial file')
        : null,
    );
    if (state.phase === 'failed') {
      node.classList.add('failed');
      removals.set(payload.transferId, window.setTimeout(() => {
        node.remove();
        active.delete(payload.transferId);
        removals.delete(payload.transferId);
      }, 12000));
    }
  }

  /** The Start surface. Resolves to the committed result, or null. */
  async function start({ kind, jobId, exportRequest, password, onCommitted }) {
    const planned = await api.transfers.plan({ kind, jobId, export: exportRequest });
    if (!planned?.ok) {
      if (planned?.error?.code !== 'CANCELLED') notify(planned?.error?.code || 'Transfer not started', `${planned?.error?.message ?? 'The transfer pre-flight did not complete.'} ${planned?.error?.recovery ?? ''}`, 'error');
      return null;
    }
    const { plan } = planned.data;
    const confirmed = await confirmDialog({
      title: 'Start this transfer?',
      body: [
        `Source: ${plan.sourceDescription}.`,
        `Destination: ${plan.destinationPath || plan.destinationName || 'chosen at the next step'}.`,
        `Expected size: ${plan.expectedBytes === null ? 'not known before the data is prepared' : formatBytes(plan.expectedBytes)}.`,
        'Status: unsigned. No signature-authenticity claim is made about the resulting file.',
        plan.notice,
      ].join(' '),
      confirmLabel: 'Write the file',
    });
    if (!confirmed) {
      await api.transfers.cancel(plan.transferId);
      announce('The transfer was not started and nothing was written.');
      return null;
    }
    const startedAt = Date.now();
    const committed = await api.transfers.commit({ transferId: plan.transferId, password });
    if (!committed?.ok) {
      notify(committed?.error?.code || 'Transfer failed', `${committed?.error?.message ?? 'The transfer did not complete.'} ${committed?.error?.recovery ?? ''}`, 'error');
      return null;
    }
    renderOutcome(plan, committed.data, Date.now() - startedAt);
    onCommitted?.(committed.data);
    return committed.data;
  }

  /**
   * The digest sentence. It names what the supplied hash actually covers,
   * because the transfers differ: a project container and an export are hashed
   * over the bytes written, an attachment is hashed over the plaintext taken
   * in before it is encrypted, and a converted batch has only a manifest hash
   * over each output name and its own hash rather than a hash of any file.
   */
  function digestSentence(result) {
    if (result.kind === 'converter-output') {
      if (result.digestScope === 'file' && result.sha256) return `Content hash ${result.sha256} of the one converted file.`;
      if (result.digestScope === 'batch-manifest' && result.batchSha256) {
        return `Manifest hash ${result.batchSha256}, measured over each output name and its own hash. That is a hash of the manifest, not of any single file.`;
      }
      return 'No content hash was measured for this transfer.';
    }
    const hash = result.sha256 || result.finished?.state?.measuredHash || null;
    if (!hash) return 'No content hash was measured for this transfer.';
    if (result.kind === 'attachment-intake') return `Content hash ${hash}, measured over the file that was taken in.`;
    return `Content hash ${hash}, measured over the bytes written.`;
  }

  /** The measurement sentence for a transfer that genuinely wrote bytes. */
  function measurementSentence(result, elapsedMs) {
    const bytes = result.bytes ?? result.finished?.state?.byteCount ?? null;
    const elapsed = `${(elapsedMs / 1000).toFixed(1)} seconds`;
    if (bytes === null) return `No byte count was reported for this transfer. ${digestSentence(result)}`;
    const counted = result.kind === 'attachment-intake'
      ? `${bytes} bytes were read from the chosen file in ${elapsed}.`
      : `${bytes} bytes in ${elapsed}.`;
    return `${counted} ${digestSentence(result)}`;
  }

  /**
   * Renders the terminal state a committed transfer actually reached: a write
   * that happened, a destination chosen with nothing written, or a transfer
   * that produced no file. Only the first may be worded as a write.
   */
  function renderOutcome(plan, result, elapsedMs) {
    const node = card(plan.transferId);
    const pendingRemoval = removals.get(plan.transferId);
    if (pendingRemoval !== undefined) { window.clearTimeout(pendingRemoval); removals.delete(plan.transferId); }
    const phase = result.finished?.state?.phase ?? null;
    // A withdrawn plan never enters the downloading phase, so it is still in
    // `start`. The state machine refuses to complete without a measured byte
    // count, which is exactly why nothing here may fabricate one.
    const plannedOnly = result.plannedOnly === true || phase === 'start';
    const wrote = phase === 'complete';
    node.classList.toggle('failed', !wrote && !plannedOnly);
    const finalPath = result.path || plan.destinationPath || plan.destinationName || 'the chosen destination';
    const headline = wrote ? 'complete' : plannedOnly ? 'destination chosen' : 'nothing written';
    const statement = wrote
      ? `Written to ${finalPath}.`
      : plannedOnly
        ? `Destination chosen: ${finalPath}.`
        : 'No file was written by this transfer.';
    const detail = wrote
      ? measurementSentence(result, elapsedMs)
      : plannedOnly
        ? (result.notice || 'No bytes have been written to it yet.')
        : (result.finished?.state?.reason || 'The transfer ended without writing anything.');
    const signatureNote = wrote
      ? 'The resulting file is unsigned. This application makes no signature-authenticity claim, and it did not produce a build, an installer or a release.'
      : plannedOnly
        ? 'Anything written there later will be unsigned. This application makes no signature-authenticity claim, and it did not produce a build, an installer or a release.'
        : 'No file was produced. This application makes no signature-authenticity claim, and it did not produce a build, an installer or a release.';
    node.replaceChildren(
      el('h3', { text: `${plan.assetName}: ${headline}` }),
      el('p', { text: statement }),
      el('p', { class: 'supporting', text: detail }),
      el('p', { class: 'supporting', text: signatureNote }),
      el('div', { class: 'button-row' }, [
        result.path ? el('button', { type: 'button', class: 'tonal', onClick: () => api.exports.reveal(result.path) }, 'Reveal in folder') : null,
        result.folder ? el('button', { type: 'button', class: 'tonal', onClick: () => api.exports.reveal(result.folder) }, 'Reveal the destination folder') : null,
        result.path
          ? el('button', {
            type: 'button',
            class: 'text-button',
            onClick: async () => {
              const opened = await api.exports.openInEditor(result.path);
              const message = opened?.ok ? opened.data.message : (opened?.error?.message || 'That file could not be opened.');
              announce(message);
              notify(opened?.ok && opened.data.opened ? 'Opened in a detected editor' : 'No supported editor detected', message, opened?.ok && opened.data.opened ? 'info' : 'error');
            },
          }, 'Open in an external editor')
          : null,
        el('button', { type: 'button', class: 'text-button', onClick: () => { node.remove(); active.delete(plan.transferId); } }, 'Dismiss'),
      ]),
    );
  }

  return { start, renderProgress };
}
