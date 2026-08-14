"use client";

/**
 * The command palette.
 *
 * Every destination and every setting is reachable from here. A navigate
 * command moves focus to the element it names; a control command renders the
 * real control inline, so changing a setting updates the site immediately
 * without closing the dialog.
 *
 * Focus is moved to the search field on open, Tab is trapped inside the dialog,
 * and focus returns to the control that opened it on close.
 */

import {
  type CommandDescriptor,
  type ControlDescriptor,
  type Preferences,
  CommandRegistry,
  searchCommands,
} from "@material-tax-reporting/surface-kernel";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { SearchWithBuilder, type SearchBinding } from "./search-builder.tsx";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function PreferenceControl({
  command,
  control,
  preferences,
  onChange,
}: {
  command: CommandDescriptor;
  control: ControlDescriptor;
  preferences: Preferences;
  onChange: (patch: Partial<Preferences>, summary: string) => void;
}): ReactNode {
  const key = control.preferenceKey as keyof Preferences;
  const controlId = `palette-control-${command.id}`;

  if (control.control === "switch") {
    const checked =
      key === "narration" ? preferences.narration.enabled : preferences[key] === true;
    return (
      <label className="inline-check" htmlFor={controlId}>
        <input
          id={controlId}
          type="checkbox"
          checked={checked}
          onChange={(event) =>
            onChange(
              key === "narration"
                ? { narration: { ...preferences.narration, enabled: event.target.checked } }
                : ({ [key]: event.target.checked } as Partial<Preferences>),
              `Set ${String(key)} to ${event.target.checked}`,
            )
          }
        />
        <span className="visually-hidden">{command.label}</span>
      </label>
    );
  }

  if (control.control === "colour") {
    return (
      <input
        id={controlId}
        type="color"
        aria-label={command.label}
        value={String(preferences[key])}
        onChange={(event) =>
          onChange({ [key]: event.target.value } as Partial<Preferences>, `Set ${String(key)}`)
        }
      />
    );
  }

  if (control.control === "range") {
    return (
      <input
        id={controlId}
        type="range"
        aria-label={command.label}
        min={control.min}
        max={control.max}
        step={control.step}
        value={Number(preferences[key])}
        onChange={(event) =>
          onChange({ [key]: Number(event.target.value) } as Partial<Preferences>, `Set ${String(key)}`)
        }
      />
    );
  }

  const currentValue =
    key === "logo"
      ? preferences.logo.kind === "local"
        ? "local"
        : (preferences.logo.id ?? "sheets")
      : String(preferences[key]);

  const applyChoice = (value: string) => {
    if (key === "logo") {
      onChange(
        value === "local" ? { logo: preferences.logo } : { logo: { kind: "shipped", id: value } },
        "Set the mark",
      );
      return;
    }
    onChange({ [key]: value } as Partial<Preferences>, `Set ${String(key)}`);
  };

  if (control.control === "segmented") {
    return (
      <div className="segmented" role="group" aria-label={command.label}>
        {control.options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={currentValue === option.value}
            onClick={() => applyChoice(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <select
      id={controlId}
      aria-label={command.label}
      value={currentValue}
      onChange={(event) => applyChoice(event.target.value)}
    >
      {control.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function CommandPalette({
  registry,
  binding,
  preferences,
  onPreferenceChange,
  onNavigate,
  onClose,
  emoji,
  copy,
}: {
  registry: CommandRegistry;
  binding: SearchBinding;
  preferences: Preferences;
  onPreferenceChange: (patch: Partial<Preferences>, summary: string) => void;
  onNavigate: (command: CommandDescriptor) => void;
  onClose: () => void;
  emoji: string | null;
  copy: (key: string) => string;
}): ReactNode {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const commands = useMemo(() => searchCommands(registry, binding.state), [binding.state, registry]);
  const listId = "command-palette-list";

  useEffect(() => {
    window.requestAnimationFrame(() => document.getElementById(`${binding.id}-input`)?.focus());
  }, [binding.id]);

  useEffect(() => {
    setActiveIndex(0);
  }, [binding.state]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === "Tab") {
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (commands.length === 0) return;
      event.preventDefault();
      const next =
        event.key === "ArrowDown"
          ? (activeIndex + 1) % commands.length
          : (activeIndex - 1 + commands.length) % commands.length;
      setActiveIndex(next);
      document.getElementById(`${listId}-option-${next}`)?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (event.key === "Enter") {
      const command = commands[activeIndex];
      if (command && command.kind === "navigate") {
        event.preventDefault();
        onNavigate(command);
      }
    }
  };

  return (
    <div
      className="dialog-scrim"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby="palette-title"
        onKeyDown={onKeyDown}
        ref={dialogRef as unknown as React.RefObject<HTMLElement>}
      >
        <div className="palette-heading">
          <div>
            <p className="eyebrow">{copy("palette.eyebrow")}</p>
            <h2 id="palette-title">
              {emoji && (
                <span aria-hidden="true" className="decorative-emoji">
                  {emoji}
                </span>
              )}
              {copy("palette.title")}
            </h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close the command palette" onClick={onClose}>
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <SearchWithBuilder {...binding} visibleCount={commands.length} totalCount={registry.list().length} />

        <ul className="command-list" id={listId} role="listbox" aria-label={copy("palette.searchLabel")}>
          {commands.map((command, index) => (
            <li key={command.id} role="presentation">
              <div
                className="command-row"
                id={`${listId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
              >
                {command.kind === "navigate" ? (
                  <button type="button" onClick={() => onNavigate(command)}>
                    <span>
                      <strong>{command.label}</strong>
                      <small>{command.detail}</small>
                    </span>
                    <span aria-hidden="true">↵</span>
                  </button>
                ) : (
                  <div className="command-control">
                    <span>
                      <strong>{command.label}</strong>
                      <small>{command.detail}</small>
                    </span>
                    {command.control && (
                      <PreferenceControl
                        command={command}
                        control={command.control}
                        preferences={preferences}
                        onChange={onPreferenceChange}
                      />
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
          {commands.length === 0 && <li className="empty-command" role="presentation">{copy("palette.empty")}</li>}
        </ul>
      </section>
    </div>
  );
}
