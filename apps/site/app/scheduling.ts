"use client";

/**
 * Scheduled and external presentation settings.
 *
 * A rule never overwrites the stored baseline. It contributes an overlay, and
 * the kernel resolves precedence: a manual change wins over an active rule, and
 * an active rule wins over the stored default. Turning a rule off therefore
 * restores the stored value exactly, because that value was never replaced.
 *
 * Only presentation may be changed. A tax figure, a rule citation, the
 * paper-only boundary statement and the manual-review requirement are not
 * preferences and are not reachable from here.
 */

import {
  type AppliedOverlay,
  type Preferences,
  type ScheduleRule,
  DEFAULT_PREFERENCES,
  DENSITIES,
  DOCKS,
  MAX_FONT_SCALE,
  MIN_FONT_SCALE,
  MOTION_CHOICES,
  THEMES,
  evaluateSchedule,
  normalizeAccent,
  resolvePrecedence,
  validateExternalSettings,
  validatePreferences,
} from "@material-tax-reporting/surface-kernel";
import { useCallback, useEffect, useMemo, useState } from "react";

/** The only preference keys a rule or an external document may change. */
export const SCHEDULABLE_TARGETS = [
  "theme",
  "density",
  "motion",
  "dock",
  "accent",
  "fontScale",
  "dialogEmoji",
] as const;

export type SchedulableTarget = (typeof SCHEDULABLE_TARGETS)[number];

export const WEEKDAY_LABELS: readonly string[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** How often the active window is re-evaluated while the tab is visible. */
export const SCHEDULE_INTERVAL_MS = 30_000;

/** How long an external read is allowed to take before it is aborted. */
export const EXTERNAL_TIMEOUT_MS = 8_000;

export type ExternalSettingsConfig = {
  enabled: boolean;
  url: string;
};

export type ExternalSettingsState = {
  status: "off" | "idle" | "loading" | "applied" | "failed";
  message: string;
  values: Record<string, unknown>;
  checkedAt: string | null;
};

export type ScheduleState = {
  rules: ScheduleRule[];
  external: ExternalSettingsConfig;
};

export const DEFAULT_SCHEDULE_STATE: ScheduleState = {
  rules: [],
  external: { enabled: false, url: "" },
};

export function isSchedulableTarget(target: string): target is SchedulableTarget {
  return (SCHEDULABLE_TARGETS as readonly string[]).includes(target);
}

/**
 * How a target's value is chosen.
 *
 * A colour and a scale are free-form within the bounds the kernel already
 * enforces, so any accent colour and any supported scale can be scheduled.
 * Every other target is an enumeration, where a value outside the set has no
 * meaning and a list of choices is the correct control rather than a limit.
 */
export type ScheduleValueControl = "choice" | "colour" | "scale";

/** The choices for a target whose value is an enumeration. */
export const SCHEDULE_VALUE_CHOICES: Readonly<Partial<Record<SchedulableTarget, readonly string[]>>> = {
  theme: THEMES,
  density: DENSITIES,
  motion: MOTION_CHOICES,
  dock: DOCKS,
  dialogEmoji: ["true", "false"],
};

/** The step the scale control moves in, as a fraction of the normal size. */
export const SCHEDULE_FONT_SCALE_STEP = 0.05;

export function scheduleValueControl(target: SchedulableTarget): ScheduleValueControl {
  if (target === "accent") return "colour";
  if (target === "fontScale") return "scale";
  return "choice";
}

/**
 * Brings a value into the range its target accepts.
 *
 * The editor calls this on every change and `validateScheduleState` calls it on
 * every read, so a value left behind by an earlier version or edited by hand in
 * browser storage is corrected where it can be seen, rather than being dropped
 * later and silently by `validatePreferences` when the overlay is applied.
 */
export function normalizeScheduleValue(target: SchedulableTarget, raw: unknown): unknown {
  if (target === "accent") return normalizeAccent(raw, DEFAULT_PREFERENCES.accent);
  if (target === "fontScale") {
    const numeric =
      typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : Number.NaN;
    if (!Number.isFinite(numeric)) return DEFAULT_PREFERENCES.fontScale;
    return Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, numeric));
  }
  if (target === "dialogEmoji") return typeof raw === "boolean" ? raw : raw === "true";
  const choices = SCHEDULE_VALUE_CHOICES[target] ?? [];
  return typeof raw === "string" && choices.includes(raw) ? raw : DEFAULT_PREFERENCES[target];
}

/** The value a rule starts at when it is created or its target is changed. */
export function defaultScheduleValue(target: SchedulableTarget): unknown {
  return DEFAULT_PREFERENCES[target];
}

/**
 * The flat shape a schedule change is recorded as in the local history.
 *
 * The address is never included, only whether one is set, so a history record
 * cannot disclose an address the reader typed.
 */
export function describeScheduleShape(state: ScheduleState): Record<string, unknown> {
  return {
    "schedule.ruleCount": state.rules.length,
    "schedule.enabledRuleCount": state.rules.filter((rule) => rule.enabled).length,
    "schedule.rules": state.rules
      .map(
        (rule) =>
          `${rule.enabled ? "on" : "off"} ${rule.target}=${String(rule.value)} ${rule.startTime}-${rule.endTime} ${
            rule.weekdays.length === 0 ? "every day" : rule.weekdays.join(",")
          }`,
      )
      .join("; "),
    "schedule.externalEnabled": state.external.enabled,
    "schedule.externalAddressSet": state.external.url.trim().length > 0,
  };
}

/** Reads a persisted record, discarding anything outside the allowed shape. */
export function validateScheduleState(raw: unknown): ScheduleState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_SCHEDULE_STATE };
  const record = raw as Record<string, unknown>;
  const rules: ScheduleRule[] = [];
  if (Array.isArray(record.rules)) {
    for (const entry of record.rules.slice(0, 40)) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const rule = entry as Record<string, unknown>;
      if (typeof rule.id !== "string" || typeof rule.target !== "string" || !isSchedulableTarget(rule.target)) {
        continue;
      }
      rules.push({
        id: rule.id.slice(0, 80),
        enabled: rule.enabled === true,
        weekdays: Array.isArray(rule.weekdays)
          ? rule.weekdays.filter(
              (day): day is number => typeof day === "number" && day >= 0 && day <= 6,
            )
          : [],
        startTime: typeof rule.startTime === "string" ? rule.startTime.slice(0, 5) : "20:00",
        endTime: typeof rule.endTime === "string" ? rule.endTime.slice(0, 5) : "07:00",
        target: rule.target,
        value: normalizeScheduleValue(rule.target, rule.value),
      });
    }
  }
  const external = record.external as Record<string, unknown> | undefined;
  return {
    rules,
    external: {
      enabled: external?.enabled === true,
      url: typeof external?.url === "string" ? external.url.slice(0, 400) : "",
    },
  };
}

function baselineOf(preferences: Preferences): Record<string, unknown> {
  const baseline: Record<string, unknown> = {};
  for (const target of SCHEDULABLE_TARGETS) baseline[target] = preferences[target];
  return baseline;
}

/**
 * Applies an overlay to the stored preferences without writing to them, so the
 * baseline is still intact when the rule stops being active.
 */
export function applyOverlay(
  preferences: Preferences,
  overlay: AppliedOverlay,
  external: Record<string, unknown>,
): { preferences: Preferences; sources: Record<string, "manual" | "rule" | "default"> } {
  const merged = resolvePrecedence(baselineOf(preferences), overlay, {});
  const withExternal: Record<string, unknown> = { ...merged.values };
  const sources = { ...merged.sources };
  for (const [key, value] of Object.entries(external)) {
    if (!isSchedulableTarget(key)) continue;
    if (sources[key] === "rule") continue;
    withExternal[key] = value;
    sources[key] = "rule";
  }
  return {
    preferences: validatePreferences({ ...preferences, ...withExternal }),
    sources,
  };
}

export type SchedulingApi = {
  state: ScheduleState;
  setRules: (rules: ScheduleRule[]) => void;
  setExternal: (config: ExternalSettingsConfig) => void;
  overlay: AppliedOverlay;
  externalState: ExternalSettingsState;
  refreshExternal: () => Promise<void>;
  timeZone: string;
};

export function useScheduling(options: {
  state: ScheduleState;
  onChange: (state: ScheduleState) => void;
}): SchedulingApi {
  const { state, onChange } = options;
  const [tick, setTick] = useState(() => new Date().toISOString());
  const [externalState, setExternalState] = useState<ExternalSettingsState>({
    status: "off",
    message: "External presentation settings are off.",
    values: {},
    checkedAt: null,
  });

  const timeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, []);

  // One interval, plus a re-evaluation when the tab becomes visible again so a
  // backgrounded tab catches up instead of showing a stale window.
  useEffect(() => {
    const update = () => setTick(new Date().toISOString());
    const interval = window.setInterval(update, SCHEDULE_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const overlay = useMemo<AppliedOverlay>(() => {
    try {
      return evaluateSchedule(state.rules, tick, timeZone);
    } catch {
      return { values: {}, activeRuleIds: [] };
    }
  }, [state.rules, tick, timeZone]);

  const refreshExternal = useCallback(async () => {
    if (!state.external.enabled) {
      setExternalState({
        status: "off",
        message: "External presentation settings are off.",
        values: {},
        checkedAt: null,
      });
      return;
    }
    const url = state.external.url.trim();
    if (!/^https:\/\/[^/?#\s]+\//.test(url)) {
      setExternalState({
        status: "failed",
        message: "The address must be a complete https address. Local rules are being used instead.",
        values: {},
        checkedAt: new Date().toISOString(),
      });
      return;
    }
    const origin = new URL(url).origin;
    setExternalState((current) => ({ ...current, status: "loading", message: "Reading the external document." }));
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), EXTERNAL_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
      });
      if (!response.ok) {
        throw new Error(`The address answered with status ${response.status}.`);
      }
      const verdict = validateExternalSettings(await response.text(), [origin]);
      if (!verdict.ok) {
        setExternalState({
          status: "failed",
          message: `${verdict.reason} Local rules are being used instead.`,
          values: {},
          checkedAt: new Date().toISOString(),
        });
        return;
      }
      const presentationOnly: Record<string, unknown> = {};
      const rejected: string[] = [];
      for (const [key, value] of Object.entries(verdict.values)) {
        if (isSchedulableTarget(key)) presentationOnly[key] = value;
        else rejected.push(key);
      }
      setExternalState({
        status: "applied",
        message:
          rejected.length === 0
            ? `Applied ${Object.keys(presentationOnly).length} presentation value${Object.keys(presentationOnly).length === 1 ? "" : "s"}.`
            : `Applied ${Object.keys(presentationOnly).length} presentation value${Object.keys(presentationOnly).length === 1 ? "" : "s"}. Ignored keys that are not presentation settings: ${rejected.join(", ")}.`,
        values: presentationOnly,
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      const reason =
        error instanceof DOMException && error.name === "AbortError"
          ? `The read did not finish within ${EXTERNAL_TIMEOUT_MS / 1000} seconds.`
          : error instanceof Error
            ? error.message
            : "The address could not be read.";
      setExternalState({
        status: "failed",
        message: `${reason} Local rules are being used instead.`,
        values: {},
        checkedAt: new Date().toISOString(),
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }, [state.external.enabled, state.external.url]);

  useEffect(() => {
    if (!state.external.enabled) {
      setExternalState({
        status: "off",
        message: "External presentation settings are off.",
        values: {},
        checkedAt: null,
      });
    }
  }, [state.external.enabled]);

  return {
    state,
    setRules: (rules) => onChange({ ...state, rules }),
    setExternal: (external) => onChange({ ...state, external }),
    overlay,
    externalState,
    refreshExternal,
    timeZone,
  };
}
