/**
 * The local transfer coordinator and the progress state it broadcasts.
 *
 * Nothing here moves bytes; the coordinator tracks a transfer somebody else is
 * performing and tells the interface about it. So the properties worth pinning
 * are the ones that keep the interface honest: a transfer cannot report itself
 * complete without measured bytes, progress cannot run backwards, and a
 * withdrawn transfer must not be dressed up as a finished one.
 *
 * The `send` callback is the only side effect, so every assertion below reads
 * what was actually broadcast rather than the coordinator's own return value.
 */

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { CHUNK_BYTES, KINDS, PROGRESS_CHANNEL, TransferCoordinator } = require('../src/main/transfer-progress.js');

/** A coordinator whose broadcasts are recorded rather than delivered. */
function recording() {
  const sent = [];
  const coordinator = new TransferCoordinator((channel, payload) => sent.push({ channel, payload }));
  return { coordinator, sent, last: () => sent.at(-1)?.payload };
}

const planFor = (coordinator, overrides = {}) =>
  coordinator.plan({
    kind: 'export',
    sourceDescription: 'Synthetic export',
    destinationPath: 'C:/synthetic/out.pdf',
    expectedBytes: 1_000,
    ...overrides,
  });

test('the progress channel and chunk size are stable published constants', () => {
  assert.equal(PROGRESS_CHANNEL, 'transfer:progress');
  assert.ok(Number.isSafeInteger(CHUNK_BYTES) && CHUNK_BYTES > 0);
  assert.ok(KINDS.size > 0);
  for (const [kind, label] of KINDS) {
    assert.ok(typeof kind === 'string' && kind.length > 0);
    assert.ok(typeof label === 'string' && label.length > 0, `${kind} must have a readable label`);
  }
});

test('a plan names the asset, resolves the destination, and starts unconfirmed', () => {
  const { coordinator } = recording();
  const { plan, state } = planFor(coordinator);

  assert.ok(plan.transferId.length > 0);
  assert.equal(plan.kind, 'export');
  assert.equal(plan.assetName, KINDS.get('export'));
  assert.equal(plan.destinationName, 'out.pdf');
  assert.equal(plan.expectedBytes, 1_000);
  assert.equal(plan.confirmed, false, 'a plan is a proposal, not a start');
  assert.equal(plan.unsigned, true);
  assert.equal(state.phase, 'start');
  assert.equal(state.byteCount, 0);
});

test('the plan notice states that nothing is written yet and that the result is unsigned', () => {
  const { coordinator } = recording();
  const { plan } = planFor(coordinator);

  assert.ok(plan.notice.includes('Nothing is written until you confirm'));
  assert.ok(plan.notice.includes('on this computer only'));
  assert.ok(plan.notice.includes('unsigned'));
  assert.ok(
    plan.notice.includes('no signature-authenticity claim'),
    'the product may never imply it signed anything',
  );
});

test('an unknown kind still produces a readable asset name rather than a blank', () => {
  const { coordinator } = recording();
  const { plan } = planFor(coordinator, { kind: 'not-a-known-kind' });
  assert.ok(plan.assetName.length > 0);
});

test('a plan with no destination or expected size is accepted and reports both as unknown', () => {
  const { coordinator } = recording();
  const { plan, state } = planFor(coordinator, { destinationPath: null, expectedBytes: null });

  assert.equal(plan.destinationPath, null);
  assert.equal(plan.destinationName, null);
  assert.equal(plan.expectedBytes, null);
  assert.equal(state.byteTotal, null);
});

test('confirming a plan broadcasts it as confirmed', () => {
  const { coordinator, sent, last } = recording();
  const { plan } = planFor(coordinator);

  assert.equal(sent.length, 0, 'planning alone broadcasts nothing');
  coordinator.confirm(plan.transferId);

  assert.equal(sent.at(-1).channel, PROGRESS_CHANNEL);
  assert.equal(last().plan.confirmed, true);
  assert.equal(last().transferId, plan.transferId);
});

test('a transfer runs from start through downloading to complete', () => {
  const { coordinator, last } = recording();
  const { plan } = planFor(coordinator);

  coordinator.confirm(plan.transferId);
  coordinator.begin(plan.transferId, 1_000);
  assert.equal(last().state.phase, 'downloading');
  assert.equal(last().state.byteTotal, 1_000);

  coordinator.report(plan.transferId, 400);
  assert.equal(last().state.byteCount, 400);
  assert.equal(last().fraction, 0.4, 'a known total yields a real fraction');

  const finished = coordinator.finish(plan.transferId, 1_000, null);
  assert.equal(finished.state.phase, 'complete');
  assert.ok(finished.description.includes('unsigned'), 'completion must restate that it is unsigned');
});

test('progress on a transfer of unknown size reports no fraction rather than a guess', () => {
  const { coordinator, last } = recording();
  const { plan } = planFor(coordinator, { expectedBytes: null });

  coordinator.confirm(plan.transferId);
  coordinator.begin(plan.transferId, null);
  coordinator.report(plan.transferId, 512);

  assert.equal(last().state.byteTotal, null);
  assert.equal(last().fraction, null, 'an invented percentage is worse than none');
  assert.ok(last().description.includes('512'));
});

test('progress that runs backwards fails the transfer instead of being accepted', () => {
  const { coordinator, last } = recording();
  const { plan } = planFor(coordinator);

  coordinator.confirm(plan.transferId);
  coordinator.begin(plan.transferId, 1_000);
  coordinator.report(plan.transferId, 600);
  coordinator.report(plan.transferId, 500);

  assert.equal(last().state.phase, 'failed');
  assert.ok(last().state.reason.includes('backwards'));
});

test('progress beyond the published size fails the transfer', () => {
  const { coordinator, last } = recording();
  const { plan } = planFor(coordinator);

  coordinator.confirm(plan.transferId);
  coordinator.begin(plan.transferId, 1_000);
  coordinator.report(plan.transferId, 1_001);

  assert.equal(last().state.phase, 'failed');
  assert.ok(last().state.reason.includes('exceeded the published size'));
});

test('a transfer cannot complete without measured bytes', () => {
  // This is the structural guarantee the surface depends on: "complete" is
  // unreachable for a transfer that measured nothing, so a spinner can never
  // turn into a tick over an empty file.
  const { coordinator } = recording();
  const { plan } = planFor(coordinator);

  coordinator.confirm(plan.transferId);
  coordinator.begin(plan.transferId, 1_000);
  const finished = coordinator.finish(plan.transferId, 0, null);

  assert.equal(finished.state.phase, 'failed');
  assert.ok(finished.state.reason.includes('no measured bytes'));
});

test('a measured size that disagrees with the published size fails', () => {
  const { coordinator } = recording();
  const { plan } = planFor(coordinator);

  coordinator.confirm(plan.transferId);
  coordinator.begin(plan.transferId, 1_000);
  const finished = coordinator.finish(plan.transferId, 900, null);

  assert.equal(finished.state.phase, 'failed');
  assert.ok(finished.state.reason.includes('does not match the published size'));
});

test('a failure records the stated reason and forgets the transfer', () => {
  const { coordinator, last } = recording();
  const { plan } = planFor(coordinator);

  coordinator.confirm(plan.transferId);
  const failed = coordinator.fail(plan.transferId, 'The destination became unwritable.');

  assert.equal(failed.state.phase, 'failed');
  assert.equal(last().state.reason, 'The destination became unwritable.');
  assert.equal(coordinator.fail(plan.transferId, 'again'), null, 'a finished transfer is forgotten');
});

test('a very long failure reason is bounded rather than broadcast whole', () => {
  const { coordinator, last } = recording();
  const { plan } = planFor(coordinator);

  coordinator.confirm(plan.transferId);
  coordinator.fail(plan.transferId, 'x'.repeat(5_000));

  assert.ok(last().state.reason.length <= 240, 'an unbounded reason could carry a whole file path or worse');
});

test('cancelling aborts the transfer and runs the registered cleanup', () => {
  const { coordinator, last } = recording();
  const { plan } = planFor(coordinator);
  let cleaned = false;

  coordinator.confirm(plan.transferId);
  coordinator.registerCleanup(plan.transferId, () => {
    cleaned = true;
  });
  const signal = coordinator.signal(plan.transferId);
  assert.equal(signal.aborted, false);

  const result = coordinator.cancel(plan.transferId);

  assert.equal(result.cancelled, true);
  assert.equal(result.partialRemoved, true);
  assert.equal(cleaned, true, 'the partial file must actually be cleaned up');
  assert.equal(signal.aborted, true, 'the in-flight work must be told to stop');
  assert.equal(last().state.phase, 'failed');
  assert.ok(last().state.reason.includes('cancelled'));
});

test('cancelling with no cleanup registered reports that nothing was removed', () => {
  const { coordinator } = recording();
  const { plan } = planFor(coordinator);

  coordinator.confirm(plan.transferId);
  const result = coordinator.cancel(plan.transferId);

  assert.equal(result.cancelled, true);
  assert.equal(result.partialRemoved, false);
});

test('cancelling an unknown transfer says so rather than throwing', () => {
  const { coordinator } = recording();
  const result = coordinator.cancel('no-such-transfer');

  assert.equal(result.cancelled, false);
  assert.equal(result.partialRemoved, false);
});

test('a cleanup that throws does not take the cancellation down with it', () => {
  const { coordinator } = recording();
  const { plan } = planFor(coordinator);

  coordinator.confirm(plan.transferId);
  coordinator.registerCleanup(plan.transferId, () => {
    throw new Error('the partial file was locked');
  });

  const result = coordinator.cancel(plan.transferId);
  assert.equal(result.cancelled, true);
  assert.equal(result.partialRemoved, false, 'a failed cleanup must not be reported as a removal');
});

test('withdrawing a plan reports zero bytes written and never claims completion', () => {
  // Withdrawal is neither success nor failure. The one thing it must not do is
  // fabricate a byte count to get past the completion guard.
  const { coordinator } = recording();
  const { plan } = planFor(coordinator);

  coordinator.confirm(plan.transferId);
  const withdrawn = coordinator.withdraw(plan.transferId, 'The user chose a different destination.');

  assert.equal(withdrawn.writtenBytes, 0);
  assert.equal(withdrawn.notice, 'The user chose a different destination.');
  assert.notEqual(withdrawn.state.phase, 'complete');
});

test('acting on a forgotten transfer is refused rather than silently ignored', () => {
  const { coordinator } = recording();
  const { plan } = planFor(coordinator);

  coordinator.confirm(plan.transferId);
  coordinator.finish(plan.transferId, 1_000, null);

  for (const act of [
    () => coordinator.get(plan.transferId),
    () => coordinator.confirm(plan.transferId),
    () => coordinator.begin(plan.transferId, 1_000),
    () => coordinator.signal(plan.transferId),
    () => coordinator.withdraw(plan.transferId, 'too late'),
  ]) {
    assert.throws(act, /no longer pending/);
  }
});

test('two transfers are tracked independently', () => {
  const { coordinator, sent } = recording();
  const first = planFor(coordinator, { sourceDescription: 'First' }).plan;
  const second = planFor(coordinator, { sourceDescription: 'Second' }).plan;

  assert.notEqual(first.transferId, second.transferId);

  coordinator.confirm(first.transferId);
  coordinator.begin(first.transferId, 500);
  coordinator.report(first.transferId, 250);

  coordinator.confirm(second.transferId);
  coordinator.begin(second.transferId, 800);

  const forFirst = sent.filter((entry) => entry.payload.transferId === first.transferId);
  const forSecond = sent.filter((entry) => entry.payload.transferId === second.transferId);

  assert.equal(forFirst.at(-1).payload.state.byteCount, 250);
  assert.equal(forSecond.at(-1).payload.state.byteCount, 0);
  assert.equal(forSecond.at(-1).payload.state.byteTotal, 800);
});

test('every broadcast carries the transfer, its plan, state, fraction and description', () => {
  const { coordinator, sent } = recording();
  const { plan } = planFor(coordinator);

  coordinator.confirm(plan.transferId);
  coordinator.begin(plan.transferId, 1_000);
  coordinator.report(plan.transferId, 500);
  coordinator.finish(plan.transferId, 1_000, null);

  assert.ok(sent.length >= 4);
  for (const { channel, payload } of sent) {
    assert.equal(channel, PROGRESS_CHANNEL);
    assert.equal(payload.transferId, plan.transferId);
    assert.ok(payload.plan && payload.state);
    assert.ok(payload.fraction === null || (payload.fraction >= 0 && payload.fraction <= 1));
    assert.ok(typeof payload.description === 'string' && payload.description.length > 0);
    assert.equal(payload.state.unsigned, true, 'no state may ever claim a signature');
  }
});
