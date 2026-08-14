"use client";

/**
 * The scheduled and external presentation settings cards.
 *
 * A rule contributes an overlay and never writes to the stored preference, so
 * turning a rule off restores the stored value exactly. Only presentation may
 * be changed: no tax figure, rule citation, boundary statement or review
 * requirement is reachable from either card.
 */

import { type ScheduleRule, matchesSearch } from "@material-tax-reporting/surface-kernel";
import { type ReactNode, useMemo } from "react";
import {
  SCHEDULABLE_TARGETS,
  WEEKDAY_LABELS,
  type SchedulingApi,
} from "./scheduling.ts";
import { CompactSearchWithBuilder, type SearchBinding } from "./search-builder.tsx";

const TARGET_VALUES: Record<string, string[]> = {
  theme: ["system", "light", "dark"],
  density: ["comfortable", "compact"],
  motion: ["system", "reduce", "full"],
  dock: ["left", "top", "right", "bottom"],
  accent: ["#4355b9", "#7a4bbd", "#1f6f5c", "#8a4b2f"],
  fontScale: ["0.9", "1", "1.1", "1.25"],
  dialogEmoji: ["true", "false"],
};

function coerce(target: string, raw: string): unknown {
  if (target === "fontScale") return Number(raw);
  if (target === "dialogEmoji") return raw === "true";
  return raw;
}

function newRuleId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `rule-${Date.now().toString(36)}`;
}

export function SchedulePanel({
  api,
  binding,
  copy,
}: {
  api: SchedulingApi;
  binding: SearchBinding;
  copy: (key: string) => string;
}): ReactNode {
  const visible = useMemo(
    () =>
      api.state.rules.filter((rule) =>
        matchesSearch(`${rule.target} ${String(rule.value)} ${rule.startTime} ${rule.endTime}`, binding.state),
      ),
    [api.state.rules, binding.state],
  );

  const update = (id: string, patch: Partial<ScheduleRule>) => {
    api.setRules(api.state.rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  };

  return (
    <section className="setting-card wide-setting" id="schedule-setting" tabIndex={-1}>
      <div>
        <h2>{copy("setting.schedule.title")}</h2>
        <p>{copy("setting.schedule.body")}</p>
        <p className="privacy-note">
          Times are evaluated in this browser's time zone, {api.timeZone}. Active rules:{" "}
          {api.overlay.activeRuleIds.length === 0 ? "none" : api.overlay.activeRuleIds.join(", ")}.
        </p>
      </div>

      <CompactSearchWithBuilder {...binding} />

      <ul className="rule-list">
        {visible.map((rule) => (
          <li key={rule.id}>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={rule.enabled}
                aria-label={`Enable the ${rule.target} rule`}
                onChange={(event) => update(rule.id, { enabled: event.target.checked })}
              />
              Active
            </label>
            <label className="field-label" htmlFor={`rule-target-${rule.id}`}>
              Setting
            </label>
            <select
              id={`rule-target-${rule.id}`}
              value={rule.target}
              onChange={(event) =>
                update(rule.id, {
                  target: event.target.value,
                  value: coerce(event.target.value, TARGET_VALUES[event.target.value]?.[0] ?? ""),
                })
              }
            >
              {SCHEDULABLE_TARGETS.map((target) => (
                <option key={target} value={target}>
                  {target}
                </option>
              ))}
            </select>
            <label className="field-label" htmlFor={`rule-value-${rule.id}`}>
              Value while active
            </label>
            <select
              id={`rule-value-${rule.id}`}
              value={String(rule.value)}
              onChange={(event) => update(rule.id, { value: coerce(rule.target, event.target.value) })}
            >
              {(TARGET_VALUES[rule.target] ?? []).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <label className="field-label" htmlFor={`rule-start-${rule.id}`}>
              From
            </label>
            <input
              id={`rule-start-${rule.id}`}
              type="time"
              value={rule.startTime}
              onChange={(event) => update(rule.id, { startTime: event.target.value })}
            />
            <label className="field-label" htmlFor={`rule-end-${rule.id}`}>
              Until
            </label>
            <input
              id={`rule-end-${rule.id}`}
              type="time"
              value={rule.endTime}
              onChange={(event) => update(rule.id, { endTime: event.target.value })}
            />
            <fieldset className="filter-row">
              <legend>Days (none selected means every day)</legend>
              {WEEKDAY_LABELS.map((weekday, index) => (
                <label key={weekday} className="inline-check">
                  <input
                    type="checkbox"
                    checked={rule.weekdays.includes(index)}
                    onChange={(event) =>
                      update(rule.id, {
                        weekdays: event.target.checked
                          ? [...rule.weekdays, index].sort()
                          : rule.weekdays.filter((day) => day !== index),
                      })
                    }
                  />
                  {weekday}
                </label>
              ))}
            </fieldset>
            <button
              type="button"
              className="text-button"
              onClick={() => api.setRules(api.state.rules.filter((entry) => entry.id !== rule.id))}
            >
              Remove this rule
            </button>
          </li>
        ))}
        {visible.length === 0 && <li>No rule matches the filter.</li>}
      </ul>

      <button
        type="button"
        className="outlined-button"
        onClick={() =>
          api.setRules([
            ...api.state.rules,
            {
              id: newRuleId(),
              enabled: false,
              weekdays: [],
              startTime: "20:00",
              endTime: "07:00",
              target: "theme",
              value: "dark",
            },
          ])
        }
      >
        Add a rule
      </button>
      <small>
        A later rule wins when two rules name the same setting. A change you make by hand always wins over an
        active rule, and the stored value returns the moment no rule applies.
      </small>
    </section>
  );
}

export function ExternalSettingsPanel({
  api,
  copy,
}: {
  api: SchedulingApi;
  copy: (key: string) => string;
}): ReactNode {
  const { external } = api.state;
  return (
    <section className="setting-card wide-setting" id="external-setting" tabIndex={-1}>
      <div>
        <h2>{copy("setting.external.title")}</h2>
        <p>{copy("setting.external.body")}</p>
      </div>
      <label className="inline-check">
        <input
          type="checkbox"
          checked={external.enabled}
          onChange={(event) => api.setExternal({ ...external, enabled: event.target.checked })}
        />
        Read presentation settings from an address I enter
      </label>
      <label className="field-label" htmlFor="external-url">
        Address
      </label>
      <input
        id="external-url"
        type="url"
        inputMode="url"
        placeholder="https://"
        value={external.url}
        disabled={!external.enabled}
        onChange={(event) => api.setExternal({ ...external, url: event.target.value })}
      />
      <button
        type="button"
        className="outlined-button"
        disabled={!external.enabled}
        onClick={() => void api.refreshExternal()}
      >
        Read the document now
      </button>
      <p className="file-status" role="status">
        {api.externalState.message}
        {api.externalState.checkedAt !== null &&
          ` Checked at ${new Date(api.externalState.checkedAt).toLocaleString()}.`}
      </p>
      <small>
        The document must be served over https, must declare the same origin as the address, and may carry only
        presentation values. Anything else is ignored by name, and any failure falls back to the local rules
        with the exact reason shown above.
      </small>
    </section>
  );
}
