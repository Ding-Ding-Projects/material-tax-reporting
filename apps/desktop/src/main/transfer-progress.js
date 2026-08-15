'use strict';

/**
 * Start, Downloading and Complete states for the transfers this application
 * actually performs: saving a project, saving a copy, choosing an import copy
 * destination, taking in an attachment, writing converter output, and writing
 * an export.
 *
 * Nothing here describes a build, an installer or a release, because this
 * repository produces none. The state machine comes from the shared kernel, so
 * a completion can only be reported with a measured byte count and no code
 * path can express a signature-authenticity claim.
 */

const crypto = require('node:crypto');
const path = require('node:path');
const { createDownloadState, describeDownload, downloadFraction, reduceDownloadState } = require('@material-tax-reporting/surface-kernel');

const PROGRESS_CHANNEL = 'transfer:progress';
const CHUNK_BYTES = 4 * 1024 * 1024;

const KINDS = new Map([
  ['project-save', 'Encrypted project file'],
  ['project-save-copy', 'Encrypted project copy'],
  ['project-import-copy', 'Validated project copy destination'],
  ['attachment-intake', 'Encrypted attachment'],
  ['converter-output', 'Converted file'],
  ['export', 'Export file'],
]);

class TransferCoordinator {
  constructor(send) {
    this.send = send;
    this.transfers = new Map();
  }

  /**
   * Records a pre-flight plan. Nothing is written until the plan is confirmed,
   * so the person sees the destination and the expected size first.
   */
  plan({ kind, sourceDescription, destinationPath, expectedBytes }) {
    const assetName = KINDS.get(kind) || 'Local file';
    const transferId = crypto.randomUUID();
    const state = createDownloadState({ assetName, version: 'local transfer' });
    const plan = {
      transferId,
      kind,
      assetName,
      sourceDescription: String(sourceDescription ?? '').slice(0, 240),
      destinationPath: destinationPath ? path.resolve(destinationPath) : null,
      destinationName: destinationPath ? path.basename(destinationPath) : null,
      expectedBytes: Number.isSafeInteger(expectedBytes) && expectedBytes > 0 ? expectedBytes : null,
      unsigned: true,
      confirmed: false,
      notice:
        'Nothing is written until you confirm. This transfer copies data on this computer only. The resulting file is unsigned and this application makes no signature-authenticity claim about it.',
    };
    this.transfers.set(transferId, { plan, state, controller: new AbortController(), cleanup: null });
    return { plan, state, description: describeDownload(state) };
  }

  get(transferId) {
    const entry = this.transfers.get(transferId);
    if (!entry) throw new Error('That transfer is no longer pending. Start it again.');
    return entry;
  }

  /** Marks the plan confirmed. Nothing is written until `begin` is called. */
  confirm(transferId) {
    const entry = this.get(transferId);
    entry.plan.confirmed = true;
    this.emit(transferId);
    return entry;
  }

  /**
   * Enters the downloading phase with the real total, which is known only once
   * the bytes to write exist. A null total means the size is genuinely unknown
   * and the surface says so instead of showing a fabricated percentage.
   */
  begin(transferId, byteTotal) {
    const entry = this.get(transferId);
    entry.state = reduceDownloadState(entry.state, { type: 'begin', byteTotal: Number.isSafeInteger(byteTotal) && byteTotal > 0 ? byteTotal : null });
    this.emit(transferId);
    return entry;
  }

  registerCleanup(transferId, cleanup) {
    this.get(transferId).cleanup = cleanup;
  }

  signal(transferId) {
    return this.get(transferId).controller.signal;
  }

  report(transferId, byteCount) {
    const entry = this.transfers.get(transferId);
    if (!entry) return;
    entry.state = reduceDownloadState(entry.state, { type: 'progress', byteCount });
    this.emit(transferId);
  }

  finish(transferId, byteCount, measuredHash) {
    const entry = this.get(transferId);
    entry.state = reduceDownloadState(entry.state, { type: 'finish', byteCount, measuredHash: measuredHash ?? null });
    this.emit(transferId);
    const finished = { plan: entry.plan, state: entry.state, description: describeDownload(entry.state) };
    this.transfers.delete(transferId);
    return finished;
  }

  fail(transferId, reason) {
    const entry = this.transfers.get(transferId);
    if (!entry) return null;
    entry.state = reduceDownloadState(entry.state, { type: 'fail', reason: String(reason).slice(0, 240) });
    this.emit(transferId);
    const failed = { plan: entry.plan, state: entry.state, description: describeDownload(entry.state) };
    this.transfers.delete(transferId);
    return failed;
  }

  /**
   * Ends a plan that only chose a destination, without writing anything.
   *
   * This is deliberately neither a completion nor a failure. The state machine
   * refuses to complete without a measured byte count, and passing it a
   * placeholder count to get past that guard would defeat the one structural
   * guarantee it exists to provide. The transfer therefore stays in its start
   * phase, whose own description already says nothing has transferred.
   */
  withdraw(transferId, notice) {
    const entry = this.get(transferId);
    this.emit(transferId);
    const withdrawn = {
      plan: entry.plan,
      state: entry.state,
      description: describeDownload(entry.state),
      writtenBytes: 0,
      notice: String(notice ?? '').slice(0, 240),
    };
    this.transfers.delete(transferId);
    return withdrawn;
  }

  /** Cancels an in-flight transfer and removes any partial temporary file. */
  cancel(transferId) {
    const entry = this.transfers.get(transferId);
    if (!entry) return { transferId, cancelled: false, partialRemoved: false };
    entry.controller.abort();
    let partialRemoved = false;
    try {
      if (typeof entry.cleanup === 'function') { entry.cleanup(); partialRemoved = true; }
    } catch {
      partialRemoved = false;
    }
    entry.state = reduceDownloadState(entry.state, { type: 'fail', reason: 'The transfer was cancelled and the partial file was removed.' });
    this.emit(transferId);
    this.transfers.delete(transferId);
    return { transferId, cancelled: true, partialRemoved };
  }

  emit(transferId) {
    const entry = this.transfers.get(transferId);
    if (!entry) return;
    this.send(PROGRESS_CHANNEL, {
      transferId,
      plan: entry.plan,
      state: entry.state,
      fraction: downloadFraction(entry.state),
      description: describeDownload(entry.state),
    });
  }
}

module.exports = { CHUNK_BYTES, KINDS, PROGRESS_CHANNEL, TransferCoordinator };
