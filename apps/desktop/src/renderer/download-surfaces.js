'use strict';

/**
 * Start, Downloading and Complete surfaces for the transfers this application
 * actually performs.
 *
 * Start names the source, the chosen destination, the expected size and the
 * unsigned status, and nothing is written until it is confirmed. Downloading
 * is non-modal, shows bytes written and elapsed time, and offers a cancel that
 * removes the partial temporary file. Complete names the final path, the byte
 * count and the content hash, and offers reveal or open in a detected editor.
 *
 * No state here describes a build, an installer or a release, because this
 * repository produces none.
 */

import { announce, confirmDialog, el, formatBytes } from './dom.js';

export function createTransferSurfaces({ api, notify }) {
  const active = new Map();
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
      window.setTimeout(() => { node.remove(); active.delete(payload.transferId); }, 12000);
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
    renderComplete(plan, committed.data, Date.now() - startedAt);
    onCommitted?.(committed.data);
    return committed.data;
  }

  function renderComplete(plan, result, elapsedMs) {
    const node = card(plan.transferId);
    node.classList.remove('failed');
    const finalPath = result.path || plan.destinationPath || plan.destinationName || 'the chosen destination';
    const bytes = result.bytes ?? result.finished?.state?.byteCount ?? 0;
    const hash = result.sha256 || result.finished?.state?.measuredHash || null;
    node.replaceChildren(
      el('h3', { text: `${plan.assetName}: complete` }),
      el('p', { text: `Written to ${finalPath}.` }),
      el('p', { class: 'supporting', text: `${bytes} bytes in ${(elapsedMs / 1000).toFixed(1)} seconds. ${hash ? `Content hash ${hash}.` : 'No content hash was measured for this transfer.'}` }),
      el('p', { class: 'supporting', text: 'The resulting file is unsigned. This application makes no signature-authenticity claim, and it did not produce a build, an installer or a release.' }),
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
