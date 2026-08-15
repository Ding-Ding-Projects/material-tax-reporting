"use client";

/**
 * The scheduled and external presentation settings cards.
 *
 * A rule contributes an overlay and never writes to the stored preference, so
 * turning a rule off restores the stored value exactly. Only presentation may
 * be changed: no tax figure, rule citation, boundary statement or review
 * requirement is reachable from either card.
 */

import {
  type ScheduleRule,
  MAX_FONT_SCALE,
  MIN_FONT_SCALE,
  matchesSearch,
} from "@material-tax-reporting/surface-kernel";
import { type ReactNode, useMemo } from "react";
import {
  SCHEDULABLE_TARGETS,
  SCHEDULE_FONT_SCALE_STEP,
  SCHEDULE_VALUE_CHOICES,
  WEEKDAY_LABELS,
  defaultScheduleValue,
  isSchedulableTarget,
  normalizeScheduleValue,
  scheduleValueControl,
  type SchedulableTarget,
  type SchedulingApi,
} from "./scheduling.ts";
import { CompactSearchWithBuilder, type SearchBinding } from "./search-builder.tsx";

/**
 * A stored rule always carries a schedulable target, because a rule naming
 * anything else is dropped when the record is read. The fallback only satisfies
 * the type; it is not a reachable state.
 */
function targetOf(rule: ScheduleRule): SchedulableTarget {
  return isSchedulableTarget(rule.target) ? rule.target : SCHEDULABLE_TARGETS[0];
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
        {visible.map((rule) => {
          const target = targetOf(rule);
          const control = scheduleValueControl(target);
          const value = normalizeScheduleValue(target, rule.value);
          const scale = Number(value);
          return (
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
                onChange={(event) => {
                  const next = isSchedulableTarget(event.target.value) ? event.target.value : target;
                  update(rule.id, { target: next, value: defaultScheduleValue(next) });
                }}
              >
                {SCHEDULABLE_TARGETS.map((choice) => (
                  <option key={choice} value={choice}>
                    {choice}
                  </option>
                ))}
              </select>
              <label className="field-label" htmlFor={`rule-value-${rule.id}`}>
                Value while active
              </label>
              {control === "choice" && (
                <select
                  id={`rule-value-${rule.id}`}
                  value={String(value)}
                  onChange={(event) => update(rule.id, { value: normalizeScheduleValue(target, event.target.value) })}
                >
                  {(SCHEDULE_VALUE_CHOICES[target] ?? []).map((choice) => (
                    <option key={choice} value={choice}>
                      {choice}
                    </option>
                  ))}
                </select>
              )}
              {control === "colour" && (
                <div className="color-control">
                  <input
                    id={`rule-value-${rule.id}`}
                    type="color"
                    value={String(value)}
                    onChange={(event) => update(rule.id, { value: normalizeScheduleValue(target, event.target.value) })}
                  />
                  <span>{String(value).toUpperCase()}</span>
                </div>
              )}
              {control === "scale" && (
                <div className="range-control">
                  <span>{Math.round(scale * 100)}%</span>
                  <input
                    id={`rule-value-${rule.id}`}
                    type="range"
                    min={MIN_FONT_SCALE}
                    max={MAX_FONT_SCALE}
                    step={SCHEDULE_FONT_SCALE_STEP}
                    value={scale}
                    aria-valuetext={`${Math.round(scale * 100)} percent`}
                    onChange={(event) => update(rule.id, { value: normalizeScheduleValue(target, event.target.value) })}
                  />
                  <span>{`Between ${MIN_FONT_SCALE * 100}% and ${MAX_FONT_SCALE * 100}%.`}</span>
                </div>
              )}
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
          );
        })}
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
        active rule, and the stored value returns the moment no rule applies. The accent colour is any colour and
        the text size is any supported scale; the remaining settings offer their own choices, because a value
        outside that set has no meaning.
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
