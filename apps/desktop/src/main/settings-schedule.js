'use strict';

/**
 * Scheduled and external presentation settings.
 *
 * Precedence is fixed and reportable: an explicit manual override beats an
 * active schedule rule, and an active rule beats the stored default. Schedules
 * carry presentation settings only.
 *
 * External sources are opt-in and off by default. Because the renderer content
 * security policy forbids connections, any read happens here, against an https
 * origin the person typed into an allowlist, with a bounded schema and a short
 * timeout. A received document is reported as received and not applied until
 * it validates; on failure the last applied local value stays in force and the
 * surface says so.
 */

const {
  MAX_EXTERNAL_SETTINGS_BYTES,
  evaluateSchedule,
  resolvePrecedence,
  validateExternalSettings,
} = require('@material-tax-reporting/surface-kernel');

const REQUEST_TIMEOUT_MS = 5000;

/** Presentation settings a schedule rule or an external document may target. */
const SCHEDULABLE_TARGETS = ['theme', 'density', 'motion', 'fontScale', 'accent', 'dialogEmoji', 'language'];

function baselineFrom(preferences) {
  const baseline = {};
  for (const target of SCHEDULABLE_TARGETS) baseline[target] = preferences[target];
  return baseline;
}

function describeWinner(target, source, activeRuleIds) {
  if (source === 'manual') return `${target}: a manual override is in force, so no schedule rule applies.`;
  if (source === 'rule') return `${target}: an active schedule rule is in force (${activeRuleIds.join(', ') || 'unnamed rule'}).`;
  return `${target}: the stored default is in force; no rule is active and no manual override is set.`;
}

/**
 * Resolves the effective presentation settings and reports, for every target,
 * which layer won and why.
 */
function evaluate(preferences, schedules, nowIso = new Date().toISOString()) {
  const baseline = baselineFrom(preferences);
  let overlay = { values: {}, activeRuleIds: [] };
  let timeZoneError = null;
  try {
    overlay = evaluateSchedule(schedules.rules, nowIso, schedules.timeZone);
  } catch (error) {
    timeZoneError = error instanceof Error ? error.message : 'The configured time zone could not be evaluated.';
  }
  const manual = {};
  for (const [key, value] of Object.entries(schedules.manualOverrides || {})) {
    if (SCHEDULABLE_TARGETS.includes(key)) manual[key] = value;
  }
  const overlayValues = {};
  for (const [key, value] of Object.entries(overlay.values)) {
    if (SCHEDULABLE_TARGETS.includes(key)) overlayValues[key] = value;
  }
  const result = resolvePrecedence(baseline, { values: overlayValues, activeRuleIds: overlay.activeRuleIds }, manual);
  return {
    evaluatedAt: nowIso,
    timeZone: schedules.timeZone,
    timeZoneError,
    activeRuleIds: overlay.activeRuleIds,
    values: result.values,
    sources: result.sources,
    explanations: SCHEDULABLE_TARGETS.map((target) => describeWinner(target, result.sources[target] ?? 'default', overlay.activeRuleIds)),
    precedenceOrder: 'Manual override, then active schedule rule, then the stored default.',
  };
}

/**
 * Reads an allowlisted external presentation-settings document. The result is
 * always "received" first; the caller decides whether to apply it.
 */
async function readExternalSettings(schedules) {
  const external = schedules.external || {};
  if (!external.enabled) {
    return { state: 'disabled', message: 'External presentation settings are off. Nothing was requested.', values: null };
  }
  const url = String(external.url || '');
  if (!/^https:\/\//i.test(url)) {
    return { state: 'refused', message: 'Enter a complete https address before requesting an external document.', values: null };
  }
  const origin = (/^(https:\/\/[^/?#]+)/i.exec(url)?.[1] || '').toLowerCase();
  if (!external.allowedOrigins.includes(origin)) {
    return { state: 'refused', message: 'That address is not on the allowlist. Add its origin to the allowlist first.', values: null };
  }
  let body;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: 'error',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      return { state: 'failed', message: `The external source answered with status ${response.status}. The last applied local value stays in force.`, values: null };
    }
    body = (await response.text()).slice(0, MAX_EXTERNAL_SETTINGS_BYTES + 1);
  } catch {
    return { state: 'failed', message: 'The external source could not be read within the timeout. The last applied local value stays in force.', values: null };
  }
  const verdict = validateExternalSettings(body, external.allowedOrigins);
  if (!verdict.ok) {
    return { state: 'received-not-applied', message: `Received, not applied: ${verdict.reason}`, values: null };
  }
  const accepted = {};
  for (const [key, value] of Object.entries(verdict.values)) {
    if (SCHEDULABLE_TARGETS.includes(key)) accepted[key] = value;
  }
  return {
    state: 'validated',
    message: 'The document validated against the allowlisted origin and the bounded schema. Choose Apply to use it.',
    values: accepted,
    receivedAt: new Date().toISOString(),
  };
}

module.exports = { REQUEST_TIMEOUT_MS, SCHEDULABLE_TARGETS, evaluate, readExternalSettings };
