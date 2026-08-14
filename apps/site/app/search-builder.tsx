"use client";

/**
 * The single search control used by every list, filter, picker and menu on
 * this site.
 *
 * There is one regular-expression engine, and it lives in the shared surface
 * kernel. This module contributes only the React binding: the field, the
 * anchored builder panel, focus behaviour and the accessible names. Nothing
 * here compiles or evaluates a pattern itself.
 *
 * Every rendered search field is produced by one of the three exported
 * components, so a field cannot exist without its builder.
 */

import {
  type BuilderToken,
  type SearchState,
  BUILDER_TOKENS,
  MAX_PATTERN_LENGTH,
  MAX_SAMPLE_LENGTH,
  SEARCH_FLAG_ALLOWLIST,
  analyzeSearchPattern,
  createSearchState,
  describeSearch,
  insertToken,
  matchesSearch,
  validateFlags,
} from "@material-tax-reporting/surface-kernel";
import { type ReactNode, useCallback, useId, useMemo, useRef, useState } from "react";

export type SearchBinding = {
  /** Stable element identifier; the input is always `${id}-input`. */
  id: string;
  label: string;
  placeholder?: string;
  state: SearchState;
  onChange: (state: SearchState) => void;
  /** Optional live result summary rendered beside the field. */
  visibleCount?: number;
  totalCount?: number;
  /** Extra help text rendered under the field. */
  description?: string;
};

/** A fresh search state; re-exported so callers need one import path. */
export const newSearchState = createSearchState;

function useBuilderController(binding: SearchBinding) {
  const inputRef = useRef<HTMLInputElement>(null);
  const analysis = useMemo(() => analyzeSearchPattern(binding.state), [binding.state]);
  const flagVerdict = useMemo(() => validateFlags(binding.state.flags), [binding.state.flags]);

  const focusInput = useCallback(() => {
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const closeBuilder = useCallback(() => {
    binding.onChange({ ...binding.state, builderOpen: false });
    focusInput();
  }, [binding, focusInput]);

  const toggleBuilder = useCallback(() => {
    if (binding.state.builderOpen) {
      closeBuilder();
      return;
    }
    binding.onChange({ ...binding.state, builderOpen: true });
  }, [binding, closeBuilder]);

  const addToken = useCallback(
    (token: BuilderToken) => {
      binding.onChange(insertToken(binding.state, token));
    },
    [binding],
  );

  return { inputRef, analysis, flagVerdict, closeBuilder, toggleBuilder, addToken };
}

function BuilderPanel({
  binding,
  analysis,
  flagVerdict,
  onClose,
  onToken,
}: {
  binding: SearchBinding;
  analysis: ReturnType<typeof analyzeSearchPattern>;
  flagVerdict: ReturnType<typeof validateFlags>;
  onClose: () => void;
  onToken: (token: BuilderToken) => void;
}) {
  const { id, label, state, onChange } = binding;
  const invalid =
    !flagVerdict.ok || analysis.feedback.includes("Invalid") || analysis.feedback.includes("exceeds");

  return (
    <section
      className="regex-panel"
      id={`${id}-builder`}
      aria-label={`${label}: regular expression builder`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="regex-heading">
        <div>
          <p className="eyebrow">ECMAScript regular expressions</p>
          <h3>Build and test locally</h3>
        </div>
        <button type="button" className="text-button" onClick={onClose}>
          Close builder
        </button>
      </div>
      <div className="regex-fields">
        <label>
          Raw pattern
          <input
            type="text"
            value={state.pattern}
            maxLength={MAX_PATTERN_LENGTH}
            onChange={(event) => onChange({ ...state, pattern: event.target.value, regex: true })}
          />
        </label>
        <label>
          Flags
          <input
            type="text"
            value={state.flags}
            maxLength={SEARCH_FLAG_ALLOWLIST.length}
            aria-describedby={`${id}-flags-help`}
            aria-invalid={!flagVerdict.ok}
            onChange={(event) =>
              onChange({ ...state, flags: event.target.value.replace(/[^dgimsuvy]/g, "") })
            }
          />
          <small id={`${id}-flags-help`}>
            {flagVerdict.ok
              ? `Supported flags: ${SEARCH_FLAG_ALLOWLIST}. “i” ignores case.`
              : flagVerdict.reason}
          </small>
        </label>
      </div>
      <div className="token-tray" role="group" aria-label="Guided pattern inserts">
        {BUILDER_TOKENS.map((token) => (
          <button key={token.id} type="button" title={token.detail} onClick={() => onToken(token)}>
            {token.label}
          </button>
        ))}
      </div>
      <label>
        Bounded sample text
        <textarea
          value={state.sample}
          maxLength={MAX_SAMPLE_LENGTH}
          onChange={(event) => onChange({ ...state, sample: event.target.value })}
          placeholder="Try the pattern against text you paste here. Nothing is transmitted or saved."
        />
      </label>
      <p className={`syntax-feedback${invalid ? " error" : ""}`} role="status">
        {analysis.feedback}
      </p>
      {analysis.matches.length > 0 && (
        <ol className="match-list">
          {analysis.matches.slice(0, 8).map((match, index) => (
            <li key={`${match.index}-${index}`}>
              <code>{match.value || "(zero-width match)"}</code> at {match.index}
              {match.groups.length > 0 && <span> · captures: {match.groups.join(", ")}</span>}
            </li>
          ))}
        </ol>
      )}
      <p className="privacy-note">
        Evaluation stays in this browser. Patterns and sample text are bounded and are not persisted.
      </p>
    </section>
  );
}

function ToggleButton({
  id,
  label,
  open,
  onToggle,
  compact,
}: {
  id: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  compact: boolean;
}) {
  return (
    <button
      className={compact ? "icon-button compact-builder-toggle" : "icon-button"}
      type="button"
      aria-expanded={open}
      aria-controls={`${id}-builder`}
      aria-label={`${label}: regular expression builder`}
      onClick={onToggle}
    >
      <span aria-hidden="true">.*</span>
    </button>
  );
}

/**
 * The full search field: a label, the input, the regular-expression toggle and
 * the anchored builder panel.
 */
export function SearchWithBuilder(binding: SearchBinding): ReactNode {
  const { id, label, placeholder, state, onChange } = binding;
  const { inputRef, analysis, flagVerdict, closeBuilder, toggleBuilder, addToken } =
    useBuilderController(binding);
  const summaryId = `${id}-summary`;
  const hasCounts = typeof binding.visibleCount === "number" && typeof binding.totalCount === "number";

  return (
    <div className="search-builder" id={id} tabIndex={-1}>
      <label className="field-label" htmlFor={`${id}-input`}>
        {label}
      </label>
      <div className="search-row">
        <input
          ref={inputRef}
          id={`${id}-input`}
          type="search"
          value={state.regex ? state.pattern : state.query}
          placeholder={placeholder ?? "Search"}
          maxLength={MAX_PATTERN_LENGTH}
          aria-describedby={summaryId}
          onKeyDown={(event) => {
            if (event.key === "Escape" && state.builderOpen) {
              event.stopPropagation();
              closeBuilder();
            }
          }}
          onChange={(event) =>
            onChange(
              state.regex
                ? { ...state, pattern: event.target.value }
                : { ...state, query: event.target.value },
            )
          }
        />
        <ToggleButton
          id={id}
          label={label}
          open={state.builderOpen}
          onToggle={toggleBuilder}
          compact={false}
        />
      </div>
      <label className="inline-check">
        <input
          type="checkbox"
          checked={state.regex}
          onChange={(event) =>
            onChange({
              ...state,
              regex: event.target.checked,
              pattern: event.target.checked
                ? state.pattern || state.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                : state.pattern,
            })
          }
        />
        Use regular expression
      </label>
      <p className="search-summary" id={summaryId} aria-live="polite">
        {describeSearch(state)}
        {hasCounts ? ` Showing ${binding.visibleCount} of ${binding.totalCount}.` : ""}
        {binding.description ? ` ${binding.description}` : ""}
      </p>
      {state.builderOpen && (
        <BuilderPanel
          binding={binding}
          analysis={analysis}
          flagVerdict={flagVerdict}
          onClose={closeBuilder}
          onToken={addToken}
        />
      )}
    </div>
  );
}

/**
 * A single-row search field for a panel, dialog or table header. It carries the
 * same builder; only the layout is smaller.
 */
export function CompactSearchWithBuilder(binding: SearchBinding): ReactNode {
  const { id, label, placeholder, state, onChange } = binding;
  const { inputRef, analysis, flagVerdict, closeBuilder, toggleBuilder, addToken } =
    useBuilderController(binding);

  return (
    <div className="search-builder compact" id={id} tabIndex={-1}>
      <div className="search-row">
        <input
          ref={inputRef}
          id={`${id}-input`}
          type="search"
          value={state.regex ? state.pattern : state.query}
          placeholder={placeholder ?? label}
          aria-label={label}
          maxLength={MAX_PATTERN_LENGTH}
          onKeyDown={(event) => {
            if (event.key === "Escape" && state.builderOpen) {
              event.stopPropagation();
              closeBuilder();
            }
          }}
          onChange={(event) =>
            onChange(
              state.regex
                ? { ...state, pattern: event.target.value }
                : { ...state, query: event.target.value },
            )
          }
        />
        <label className="inline-check compact-regex">
          <input
            type="checkbox"
            checked={state.regex}
            aria-label={`${label}: use regular expression`}
            onChange={(event) => onChange({ ...state, regex: event.target.checked })}
          />
          <span aria-hidden="true">re</span>
        </label>
        <ToggleButton
          id={id}
          label={label}
          open={state.builderOpen}
          onToggle={toggleBuilder}
          compact
        />
      </div>
      {state.builderOpen && (
        <BuilderPanel
          binding={binding}
          analysis={analysis}
          flagVerdict={flagVerdict}
          onClose={closeBuilder}
          onToken={addToken}
        />
      )}
    </div>
  );
}

export type MenuOption = {
  value: string;
  label: string;
  detail?: string;
};

/**
 * A filterable menu: the fast segmented path stays available to the caller,
 * and this control gives the same choice a searchable list so a builder has a
 * collection to anchor to.
 */
export function MenuFilterWithBuilder({
  binding,
  options,
  selected,
  onSelect,
  emptyMessage = "No matching choice.",
}: {
  binding: SearchBinding;
  options: readonly MenuOption[];
  selected: string;
  onSelect: (value: string) => void;
  emptyMessage?: string;
}): ReactNode {
  const listId = useId();
  const [openOption, setOpenOption] = useState(0);
  const visible = options.filter((option) =>
    matchesOption(option, binding.state),
  );
  const activeIndex = Math.min(openOption, Math.max(0, visible.length - 1));

  return (
    <div className="menu-filter">
      <CompactSearchWithBuilder {...binding} />
      <ul className="menu-filter-list" id={listId} role="listbox" aria-label={binding.label}>
        {visible.map((option, index) => (
          <li key={option.value} role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={option.value === selected}
              tabIndex={index === activeIndex ? 0 : -1}
              onFocus={() => setOpenOption(index)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const next =
                    event.key === "ArrowDown"
                      ? (index + 1) % visible.length
                      : (index - 1 + visible.length) % visible.length;
                  setOpenOption(next);
                  const list = document.getElementById(listId);
                  const buttons = list?.querySelectorAll<HTMLButtonElement>('button[role="option"]');
                  buttons?.item(next)?.focus();
                }
              }}
              onClick={() => onSelect(option.value)}
            >
              <span>{option.label}</span>
              {option.detail && <small>{option.detail}</small>}
            </button>
          </li>
        ))}
        {visible.length === 0 && <li className="menu-filter-empty" role="presentation">{emptyMessage}</li>}
      </ul>
    </div>
  );
}

function matchesOption(option: MenuOption, state: SearchState): boolean {
  return matchesSearch(`${option.label} ${option.detail ?? ""} ${option.value}`, state);
}
