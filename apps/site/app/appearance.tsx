"use client";

/**
 * Per-element appearance overrides and the colour translator.
 *
 * An override is emitted as a scoped CSS custom property on the target element,
 * so the cascade does the work and no stylesheet is rewritten at runtime. The
 * kernel owns the property allowlist, the value guard and the preset format.
 *
 * Two properties are structural rather than promised in prose: the allowlist
 * contains no outline, box-shadow, transition or animation property, so an
 * override cannot remove the focus ring and cannot defeat the reduced-motion
 * path. Both are declared in the stylesheet and read no `--element-*` value.
 */

import {
  type AppearanceStore,
  type ColorSpace,
  type ParsedColor,
  APPEARANCE_PROPERTIES,
  MAX_APPEARANCE_VALUE_LENGTH,
  NAMED_COLORS,
  contrastRatio,
  convertColor,
  exportAppearancePreset,
  formatColor,
  importAppearancePreset,
  isOutOfGamut,
  matchesSearch,
  parseColor,
  resetAppearanceProperty,
  resetElementAppearance,
  setAppearanceProperty,
  wcagVerdict,
} from "@material-tax-reporting/surface-kernel";
import { type CSSProperties, type ReactNode, useMemo, useState } from "react";
import { SETTING_DESCRIPTORS } from "./data/commands.ts";
import { SITE_TABS } from "./tabs.ts";
import { CompactSearchWithBuilder, type SearchBinding } from "./search-builder.tsx";

export type AppearanceElement = {
  id: string;
  label: string;
  group: string;
};

/** Every element the appearance editor may target, by stable identifier. */
export const APPEARANCE_ELEMENTS: readonly AppearanceElement[] = [
  { id: "top-bar", label: "Header bar", group: "Shell" },
  { id: "tab-rail", label: "Tab strip", group: "Shell" },
  { id: "main-content", label: "Content area", group: "Shell" },
  { id: "site-footer", label: "Footer", group: "Shell" },
  ...SITE_TABS.map((tab) => ({ id: `tab-${tab.id}`, label: `Tab: ${tab.en}`, group: "Tabs" })),
  ...SITE_TABS.map((tab) => ({ id: `panel-${tab.id}`, label: `Panel: ${tab.en}`, group: "Panels" })),
  ...SETTING_DESCRIPTORS.map((descriptor) => ({
    id: descriptor.id,
    label: `Setting: ${descriptor.keywords.split(" ").slice(0, 2).join(" ")}`,
    group: "Settings",
  })),
];

const ELEMENT_BY_ID = new Map(APPEARANCE_ELEMENTS.map((element) => [element.id, element]));

/** Shipped font stacks. A person picks a stack, never an arbitrary value. */
export const FONT_STACKS: readonly { id: string; label: string; value: string }[] = [
  { id: "system", label: "System sans", value: "ui-sans-serif, system-ui, sans-serif" },
  { id: "serif", label: "System serif", value: "ui-serif, Georgia, serif" },
  { id: "mono", label: "Monospace", value: "ui-monospace, SFMono-Regular, monospace" },
  { id: "rounded", label: "Rounded sans", value: "ui-rounded, \"Segoe UI\", sans-serif" },
];

export const FONT_WEIGHTS: readonly string[] = ["400", "500", "600", "700", "800"];
export const FONT_SIZE_STEPS: readonly string[] = ["0.85rem", "0.95rem", "1rem", "1.1rem", "1.25rem", "1.5rem"];
export const LINE_HEIGHTS: readonly string[] = ["1.1", "1.25", "1.4", "1.55", "1.7"];
export const LETTER_SPACINGS: readonly string[] = ["-0.03em", "-0.01em", "0", "0.02em", "0.08em"];

export const COLOR_SPACES: readonly ColorSpace[] = [
  "hex",
  "rgb",
  "hsl",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "named",
];

/** The custom properties a target element receives, or an empty object. */
export function appearanceStyle(store: AppearanceStore, elementId: string): CSSProperties {
  const overrides = store[elementId];
  if (!overrides) return {};
  return { ...overrides } as CSSProperties;
}

/** The element label used in menus and confirmations. */
export function appearanceLabel(elementId: string): string {
  return ELEMENT_BY_ID.get(elementId)?.label ?? elementId;
}

function propertyKind(property: string): "typography" | "colour" | "shape" {
  if (property.includes("font") || property.includes("line-height") || property.includes("letter-spacing") || property.includes("text-transform")) {
    return "typography";
  }
  if (property.includes("radius") || property.includes("padding")) return "shape";
  return "colour";
}

function optionsFor(property: string): readonly string[] {
  switch (property) {
    case "--element-font-family":
      return FONT_STACKS.map((stack) => stack.value);
    case "--element-font-weight":
      return FONT_WEIGHTS;
    case "--element-font-size":
      return FONT_SIZE_STEPS;
    case "--element-line-height":
      return LINE_HEIGHTS;
    case "--element-letter-spacing":
      return LETTER_SPACINGS;
    case "--element-text-transform":
      return ["none", "uppercase", "lowercase", "capitalize"];
    case "--element-radius":
      return ["0.25rem", "0.5rem", "0.9rem", "1.5rem", "2.5rem"];
    case "--element-padding":
      return ["0.5rem", "0.75rem", "1rem", "1.4rem", "2rem"];
    default:
      return [];
  }
}

function readSurface(elementId: string): string {
  if (typeof document === "undefined") return "#ffffff";
  const element = document.getElementById(elementId);
  const target = element ?? document.body;
  const computed = getComputedStyle(target).backgroundColor;
  return computed && computed !== "rgba(0, 0, 0, 0)" ? computed : getComputedStyle(document.body).backgroundColor;
}

export function ColourTranslator({
  value,
  onChange,
  surface,
  binding,
}: {
  value: string;
  onChange: (value: string) => void;
  surface: string;
  binding: SearchBinding;
}): ReactNode {
  const parsed = useMemo(() => parseColor(value), [value]);
  const surfaceColor = useMemo(() => parseColor(surface), [surface]);
  const ratio =
    "error" in parsed || "error" in surfaceColor ? null : contrastRatio(parsed, surfaceColor);
  const spaces = COLOR_SPACES.filter((space) =>
    matchesSearch(space, binding.state),
  );

  return (
    <div className="colour-translator">
      <label className="field-label" htmlFor="colour-translator-input">
        Colour value
      </label>
      <input
        id="colour-translator-input"
        type="text"
        value={value}
        spellCheck={false}
        aria-describedby="colour-translator-status"
        onChange={(event) => onChange(event.target.value.slice(0, MAX_APPEARANCE_VALUE_LENGTH))}
      />
      <p className="colour-status" id="colour-translator-status" role="status">
        {"error" in parsed
          ? parsed.error
          : `Parsed as ${parsed.space}. ${
              ratio === null
                ? "The surface colour could not be resolved, so no contrast ratio is shown."
                : `Contrast against the resolved surface is ${ratio.toFixed(2)} to 1: ${wcagVerdict(ratio, "normal")} at normal size, ${wcagVerdict(ratio, "large")} at large size.`
            }`}
      </p>
      <CompactSearchWithBuilder {...binding} />
      {!("error" in parsed) && (
        <table className="colour-table">
          <caption>Every supported representation of the same colour</caption>
          <thead>
            <tr>
              <th scope="col">Space</th>
              <th scope="col">Value</th>
              <th scope="col">In gamut</th>
            </tr>
          </thead>
          <tbody>
            {spaces.map((space) => {
              const converted = convertColor(parsed as ParsedColor, space);
              return (
                <tr key={space}>
                  <th scope="row">{space}</th>
                  <td>
                    <code>{formatColor(converted, space)}</code>
                  </td>
                  <td>{isOutOfGamut(converted, space) ? "Out of gamut" : "In gamut"}</td>
                </tr>
              );
            })}
            {spaces.length === 0 && (
              <tr>
                <td colSpan={3}>No colour space matches the filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      <details>
        <summary>Named colours this translator accepts</summary>
        <p>{Object.keys(NAMED_COLORS).join(", ")}</p>
      </details>
    </div>
  );
}

export function AppearanceEditor({
  elementId,
  store,
  onChange,
  onClose,
  onNotify,
  isLocked,
  propertySearch,
  colourSearch,
}: {
  elementId: string;
  store: AppearanceStore;
  onChange: (store: AppearanceStore, summary: string) => void;
  onClose: () => void;
  onNotify: (kind: "success" | "error", title: string, body: string) => void;
  isLocked: (elementId: string, property?: string) => boolean;
  propertySearch: SearchBinding;
  colourSearch: SearchBinding;
}): ReactNode {
  const label = appearanceLabel(elementId);
  const current = store[elementId] ?? {};
  const [colourDraft, setColourDraft] = useState(current["--element-on-surface"] ?? "#4355b9");
  const [presetName, setPresetName] = useState("My preset");
  const [presetStatus, setPresetStatus] = useState("No preset has been imported in this browser.");
  const surface = useMemo(() => readSurface(elementId), [elementId]);

  const properties = APPEARANCE_PROPERTIES.filter((property) =>
    matchesSearch(`${property} ${propertyKind(property)}`, propertySearch.state),
  );

  const setProperty = (property: string, value: string) => {
    if (isLocked(elementId, property)) {
      onNotify("error", "Locked", `${label} · ${property} is locked. Unlock it before changing it.`);
      return;
    }
    const next = setAppearanceProperty(store, elementId, property, value);
    if (next === store) {
      onNotify("error", "Value refused", `“${value}” is not an accepted value for ${property}.`);
      return;
    }
    onChange(next, `Set ${property} on ${label}`);
  };

  const clearProperty = (property: string) => {
    if (isLocked(elementId, property)) {
      onNotify("error", "Locked", `${label} · ${property} is locked. Unlock it before changing it.`);
      return;
    }
    onChange(resetAppearanceProperty(store, elementId, property), `Cleared ${property} on ${label}`);
  };

  return (
    <section className="appearance-editor" aria-labelledby="appearance-editor-title">
      <div className="palette-heading">
        <div>
          <p className="eyebrow">Per-element appearance</p>
          <h2 id="appearance-editor-title">{label}</h2>
        </div>
        <button type="button" className="icon-button" aria-label="Close the appearance editor" onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <CompactSearchWithBuilder {...propertySearch} />

      <ul className="appearance-property-list">
        {properties.map((property) => {
          const options = optionsFor(property);
          const value = current[property] ?? "";
          const locked = isLocked(elementId, property);
          const controlId = `appearance-${elementId}-${property.replace(/[^a-z]/g, "")}`;
          return (
            <li key={property}>
              <label className="field-label" htmlFor={controlId}>
                {property}
              </label>
              {options.length > 0 ? (
                <select
                  id={controlId}
                  value={value}
                  disabled={locked}
                  onChange={(event) =>
                    event.target.value === ""
                      ? clearProperty(property)
                      : setProperty(property, event.target.value)
                  }
                >
                  <option value="">Not overridden</option>
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={controlId}
                  type="text"
                  value={value}
                  disabled={locked}
                  maxLength={MAX_APPEARANCE_VALUE_LENGTH}
                  placeholder="Not overridden"
                  onChange={(event) =>
                    event.target.value === ""
                      ? clearProperty(property)
                      : setProperty(property, event.target.value)
                  }
                />
              )}
              <button
                type="button"
                className="text-button"
                disabled={locked || value === ""}
                onClick={() => clearProperty(property)}
              >
                Reset this property
              </button>
              {locked && <small>This property is locked in this browser.</small>}
            </li>
          );
        })}
        {properties.length === 0 && <li>No property matches the filter.</li>}
      </ul>

      <ColourTranslator
        value={colourDraft}
        onChange={setColourDraft}
        surface={surface}
        binding={colourSearch}
      />

      <div className="appearance-actions">
        <button
          type="button"
          className="outlined-button"
          onClick={() => onChange(resetElementAppearance(store, elementId), `Reset every override on ${label}`)}
        >
          Reset all overrides on this element
        </button>
        <label className="field-label" htmlFor="appearance-preset-name">
          Preset name
        </label>
        <input
          id="appearance-preset-name"
          type="text"
          value={presetName}
          maxLength={80}
          onChange={(event) => setPresetName(event.target.value)}
        />
        <button
          type="button"
          className="outlined-button"
          onClick={() => {
            const body = exportAppearancePreset(store, presetName);
            void navigator.clipboard
              ?.writeText(body)
              .then(() => onNotify("success", "Preset copied", "The preset was copied to the clipboard."))
              .catch(() => onNotify("error", "Preset not copied", "This browser refused clipboard access."));
          }}
        >
          Copy preset to clipboard
        </button>
        <label className="filled-button file-button">
          Import a preset file
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const verdict = importAppearancePreset(await file.text());
              if (!verdict.ok) {
                setPresetStatus(`Preset rejected: ${verdict.reason}`);
                onNotify("error", "Preset rejected", verdict.reason);
                return;
              }
              onChange(verdict.store, "Imported an appearance preset");
              setPresetStatus(
                `Imported ${Object.keys(verdict.store).length} element override group${Object.keys(verdict.store).length === 1 ? "" : "s"}.`,
              );
              onNotify("success", "Preset imported", "The preset replaced the current overrides.");
            }}
          />
        </label>
        <p className="file-status" role="status">
          {presetStatus}
        </p>
      </div>
    </section>
  );
}
