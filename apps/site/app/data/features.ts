/**
 * The feature library.
 *
 * One row per capability this site ships, each pointing at the article that
 * documents it. The state column is not written here: it is read at runtime
 * from the tracked verification-status article, so a claim about what has been
 * checked cannot be invented in a component.
 */

export type FeatureRow = {
  id: string;
  label: string;
  summary: string;
  /** Slug of the generated documentation entry, as produced by the build. */
  docSlug: string;
};

const SITE_DOC = (name: string) => `docs-features-site-${name}`;

export const FEATURE_ROWS: readonly FeatureRow[] = [
  {
    id: "material-3-shell",
    label: "Material 3 shell",
    summary: "Tokens, theme, density, motion and the responsive shell.",
    docSlug: SITE_DOC("material-3-shell-and-appearance"),
  },
  {
    id: "language-funny-emoji",
    label: "Language, humour levels and decorative emoji",
    summary: "Five humour levels per language, with facts held constant.",
    docSlug: SITE_DOC("language-and-funny-levels"),
  },
  {
    id: "school-mode-vocabulary",
    label: "Personal vocabulary",
    summary: "A local wording map applied to every string at render time.",
    docSlug: SITE_DOC("personal-vocabulary"),
  },
  {
    id: "narration-voices",
    label: "Read aloud",
    summary: "Browser speech synthesis, started only from an explicit control.",
    docSlug: SITE_DOC("narration"),
  },
  {
    id: "scheduled-external-settings",
    label: "Scheduled and external presentation settings",
    summary: "Time-window overlays and an opt-in allowlisted https source.",
    docSlug: SITE_DOC("scheduled-and-external-settings"),
  },
  {
    id: "rename-logo",
    label: "Display name and mark",
    summary: "A local name and a shipped or locally chosen mark.",
    docSlug: SITE_DOC("display-name-and-logo"),
  },
  {
    id: "file-converter",
    label: "File converter",
    summary: "Conversions between this site's own record formats.",
    docSlug: SITE_DOC("file-converter"),
  },
  {
    id: "ollama-suite",
    label: "Local model runtime",
    summary: "An observed-state view of a loopback runtime on this computer.",
    docSlug: "docs-features-local-ollama-suite-readme",
  },
  {
    id: "tabs-navigation",
    label: "Tabs and navigation",
    summary: "Docking, reordering, pinning, groups, overflow and bulk close.",
    docSlug: SITE_DOC("tabs-and-navigation"),
  },
  {
    id: "appearance-editor",
    label: "Appearance editor and colour translator",
    summary: "Per-element overrides and colour conversion with contrast verdicts.",
    docSlug: SITE_DOC("appearance-editor"),
  },
  {
    id: "element-locks",
    label: "Element locks",
    summary: "A presentation guard against accidental edits.",
    docSlug: SITE_DOC("element-locks"),
  },
  {
    id: "authenticator-qr-support",
    label: "Authenticator utility and support notes",
    summary: "A standards utility bound to no account, and browser-local notes.",
    docSlug: SITE_DOC("authenticator-and-support"),
  },
  {
    id: "local-history",
    label: "Local history",
    summary: "An append-only record of personalization changes in this browser.",
    docSlug: SITE_DOC("local-history"),
  },
  {
    id: "notifications-centre",
    label: "Notifications",
    summary: "A filterable centre with bulk actions and persistent progress notices.",
    docSlug: SITE_DOC("notifications"),
  },
  {
    id: "changelog-viewer",
    label: "Changelog viewer",
    summary: "Parsed from the tracked changelog files at build time.",
    docSlug: SITE_DOC("changelog-viewer"),
  },
  {
    id: "docs-browser",
    label: "Documentation browser",
    summary: "The tracked Markdown, bundled at build time and readable offline.",
    docSlug: SITE_DOC("documentation-browser"),
  },
  {
    id: "command-palette",
    label: "Command palette",
    summary: "Every destination and every setting, with live inline controls.",
    docSlug: SITE_DOC("command-palette"),
  },
  {
    id: "regex-every-surface",
    label: "Regular-expression builders",
    summary: "One engine, and a builder beside every search field.",
    docSlug: SITE_DOC("regex-builders"),
  },
  {
    id: "exports-bulk-editor",
    label: "Exports and bulk actions",
    summary: "Four formats, a stamped manifest and a shared selection layer.",
    docSlug: SITE_DOC("exports-and-bulk-actions"),
  },
  {
    id: "browser-download-surfaces",
    label: "Download surfaces",
    summary: "Start, Downloading and Complete, driven by the release manifest.",
    docSlug: SITE_DOC("download-surfaces"),
  },
];
