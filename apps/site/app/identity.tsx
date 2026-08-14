"use client";

/**
 * Display name and mark.
 *
 * The name and mark change only what this browser shows. The document title
 * stays the shipped product name, so a personalized name never travels in a
 * shared link.
 *
 * A local mark must be a real PNG or JPEG: the kernel checks the declared type,
 * the declared length and the leading bytes, and rejects vector markup outright
 * because an SVG can carry script and external references.
 */

import {
  type LogoSelection,
  type Preferences,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_LOGO_BYTES,
  describeLogoSelection,
  resolveDisplayName,
  validateLogoUpload,
} from "@material-tax-reporting/surface-kernel";
import { type ReactNode, useState } from "react";
import { SHIPPED_LOGOS } from "./data/commands.ts";
import { SHIPPED_PRODUCT_NAME } from "./data/copy.ts";

/** The shipped inline marks. Each is decorative and carries no accessible name. */
export function ShippedMark({ id }: { id: string }): ReactNode {
  if (id === "envelope") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <rect x="2" y="7" width="28" height="18" rx="3" fill="var(--on-accent)" opacity="0.18" />
        <path d="M3 9l13 9 13-9" stroke="var(--on-accent)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <rect x="2" y="7" width="28" height="18" rx="3" stroke="var(--on-accent)" strokeWidth="2.4" fill="none" />
      </svg>
    );
  }
  if (id === "checkmark") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <circle cx="16" cy="16" r="12" fill="var(--on-accent)" opacity="0.18" />
        <path d="M9 16.5l5 5 9-11" stroke="var(--on-accent)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="6" y="4" width="17" height="22" rx="2.5" fill="var(--on-accent)" opacity="0.18" />
      <rect x="9" y="7" width="17" height="22" rx="2.5" stroke="var(--on-accent)" strokeWidth="2.2" fill="none" />
      <path d="M13 13h9M13 18h9M13 23h6" stroke="var(--on-accent)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** The mark rendered in the header: decorative, never the accessible name. */
export function BrandMark({ logo }: { logo: LogoSelection }): ReactNode {
  if (logo.kind === "local" && typeof logo.dataUrl === "string") {
    return (
      <span className="brand-mark" aria-hidden="true">
        <img src={logo.dataUrl} alt="" />
      </span>
    );
  }
  return (
    <span className="brand-mark" aria-hidden="true">
      <ShippedMark id={logo.id ?? "sheets"} />
    </span>
  );
}

export function IdentitySettings({
  preferences,
  onChange,
  onNotify,
  copy,
}: {
  preferences: Preferences;
  onChange: (patch: Partial<Preferences>, summary: string) => void;
  onNotify: (kind: "success" | "error", title: string, body: string) => void;
  copy: (key: string) => string;
}): ReactNode {
  const [draft, setDraft] = useState(preferences.displayName);
  const [logoStatus, setLogoStatus] = useState(describeLogoSelection(preferences.logo));

  return (
    <section className="setting-card wide-setting" id="display-name-setting" tabIndex={-1}>
      <div>
        <h2>{copy("setting.identity.title")}</h2>
        <p>{copy("setting.identity.body")}</p>
      </div>

      <label className="field-label" htmlFor="display-name-input">
        Name shown in this browser
      </label>
      <input
        id="display-name-input"
        type="text"
        value={draft}
        maxLength={MAX_DISPLAY_NAME_LENGTH}
        placeholder={SHIPPED_PRODUCT_NAME}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const trimmed = draft.trim();
          if (trimmed === preferences.displayName) return;
          onChange(
            { displayName: trimmed },
            trimmed.length === 0 ? "Reset the display name to the shipped name" : "Changed the display name",
          );
        }}
      />
      <small>
        1 to {MAX_DISPLAY_NAME_LENGTH} characters. An empty field restores the shipped name,{" "}
        {SHIPPED_PRODUCT_NAME}. The current name is {resolveDisplayName(preferences, SHIPPED_PRODUCT_NAME)}.
      </small>

      <div id="logo-setting" tabIndex={-1}>
        <p className="field-label">Mark</p>
        <div className="segmented" role="group" aria-label="Shipped marks">
          {SHIPPED_LOGOS.map((logo) => (
            <button
              key={logo.id}
              type="button"
              aria-pressed={preferences.logo.kind === "shipped" && (preferences.logo.id ?? "sheets") === logo.id}
              onClick={() => {
                onChange({ logo: { kind: "shipped", id: logo.id } }, `Selected the shipped mark ${logo.id}`);
                setLogoStatus(describeLogoSelection({ kind: "shipped", id: logo.id }));
              }}
            >
              <span className="mark-preview" aria-hidden="true">
                <ShippedMark id={logo.id} />
              </span>
              {logo.label}
            </button>
          ))}
        </div>
        <label className="filled-button file-button">
          Choose a local image
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const verdict = await validateLogoUpload(
                {
                  name: file.name,
                  byteLength: file.size,
                  read: async () => new Uint8Array(await file.arrayBuffer()),
                },
                file.type,
              );
              if (!verdict.ok) {
                setLogoStatus(`Image rejected: ${verdict.reason}`);
                onNotify("error", "Mark not changed", verdict.reason);
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = String(reader.result);
                onChange({ logo: { kind: "local", dataUrl } }, "Selected a local mark");
                setLogoStatus("A locally chosen image is in use.");
                onNotify("success", "Mark changed", "The image stays in this browser and is not transmitted.");
              };
              reader.onerror = () => {
                setLogoStatus("The image could not be read in this browser.");
                onNotify("error", "Mark not changed", "The image could not be read in this browser.");
              };
              reader.readAsDataURL(file);
            }}
          />
        </label>
        <p className="file-status" role="status">
          {logoStatus}
        </p>
        <small>
          PNG or JPEG only, at most {MAX_LOGO_BYTES / 1024} KB. Vector images are rejected. The mark is
          decorative: the accessible name always comes from the text beside it.
        </small>
      </div>
    </section>
  );
}
