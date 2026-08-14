# Desktop application changelog

## Unreleased

### Added

- Added a real Windows Electron desktop application with a plain-language, one-question-at-a-time tax-report wizard.
- Added an app-private Git repository that records each user-value mutation as one append-only encrypted snapshot commit. Restore and undo create new commits instead of rewriting history.
- Added a first-class history browser with action, date, and text filters, changed-path inspection, revision labels, restore, undo, and Git object-graph verification.
- Added a single bounded `.mtrproject` file containing authenticated encrypted state and attachments together with the complete local Git object database, refs, and history.
- Added project import preview actions for Create copy, Reconcile, and explicit Replace without silently overwriting an existing project file.
- Added atomic project-file writes, bounded entry and payload validation, normalized relative-member paths, per-member hashes, AES-256-GCM payload authentication, a password-wrapped portable data key using scrypt, and embedded Git graph validation.
- Added privileged packaged-resource discovery for the bundled offline OCR runtime. A missing-runtime status returns every searched location without PATH discovery or runtime downloads.
- Added an application-level preference record beside the app-private instances root and the protected key store. It is versioned, bounded and schema-validated, holds the preferences, per-element appearance overrides, tab layout, schedules, lock metadata and the notification and vocabulary pointers, and is never written into an encrypted project file or a history record.
- Added exactly one allowlisted subscription channel set to the preload boundary — transfer progress, local model state, notification pushes and applied schedules — with no wildcard channel.
- Added English, Hong Kong-style Cantonese and bilingual language modes with independent 1-to-5 humour levels per language and a separate non-semantic dialog-emoji switch. Fact-bearing strings are declared as fixed text, so a humour level cannot change a field name, a validation rule, a numeric limit or the mail-in-only boundary statement.
- Added a personal vocabulary control that accepts a bounded local JSON wording map, preserves the official names and the product boundary spans, keeps the parsed cache in the application data directory only, and adds a renamable shared mode that suppresses the non-English wording features while it is on.
- Added read-aloud narration that is off by default, enumerates installed voices, selects English and Cantonese voices independently, reports truthfully when no voice for a language is installed, and never reads the Social Insurance Number field, a mailing address, an unlock answer or an attachment display name.
- Added presentation schedules evaluated against a named time zone with the documented precedence order, an editor that reports which layer is winning and why, and an opt-in external presentation-settings path that reads only an allowlisted https origin in the privileged boundary and shows a received document as not applied until it validates.
- Added a bounded display name, a shipped-mark or local-image logo validated in the privileged boundary, and an About card stating that renaming is presentation only.
- Added a converter destination with the bundled adapters this build carries and disabled rows naming exactly what is missing for the ones it does not, bounded by the existing attachment size limit, writing only to a chosen folder, and stating that converted output still has to pass the manual parser-confirmation step.
- Added the privileged half of the local model suite behind named channels, rendering the shared package's state in the application's own chrome, with the honest unavailable states for an unreachable runtime, an empty or stale catalogue cache, an unknown hardware verdict, undetected executables, cart blockers and harness pre-flight blockers.
- Added a real tab model with all four docking edges, correct keyboard semantics per orientation, tablist roles with roving focus, an overflow menu with its own filter, pinning, groups and a bulk close that names the matched set before it runs.
- Added a shared-token palette with both dark paths and a complete reduced-motion path, plus a per-element appearance editor with typography controls, colour translation across every supported space with honest out-of-gamut reporting, bounded preset export and import, and a refusal for any override that would make a required disclosure unreadable.
- Added per-element and per-property presentation locks whose verifiers are derived and sealed in the privileged boundary, rate limited there, recorded in the append-only history, and refused outright on the review checklist, the boundary disclosure and the save and close controls.
- Added a standards-only authenticator utility that generates a pairing three ways on this computer, seals the shared secret with protected storage, and states plainly that there is no network, no email and no server-side recovery; and local support tickets whose bodies are redacted before storage.
- Added a notifications destination backed by a bounded local log with severity, recovery text, timestamp and originating action, search and filters, multi-select and scoped bulk actions that preview their exact scope, and in-application dialogs replacing the blocking browser confirmations and prompts.
- Added a packaged changelog record and a packaged documentation library generated by the application build, read at run time from allowlisted packaged locations only, rendered from a typed Markdown node list, with wizard steps deep-linking to the article that owns them.
- Added a command palette on Control, Shift and F and on a visible title-bar button, covering every destination, wizard question, project action, history action and personalization setting, operating setting results inline and teleporting to the exact element otherwise.
- Added one reusable anchored search builder instantiated independently beside every search, filter, picker and menu filter, with the append-only history store keeping plain substring matching unless an explicit validated pattern is passed.
- Added exports of the currently filtered view with a manifest stating the encoding, schema version, exact filter, row count and omissions, identity redaction on by default behind a typed confirmation, bulk actions that preview their scope, and an external-editor handoff that opens only the file just written or its folder.
- Added Start, Downloading and Complete surfaces for the transfers this application performs, with chunked project-container writes, a working cancel that removes the partial temporary file, and a completion surface that names the path, measured byte count and content hash while making no signature-authenticity claim.

### Boundaries

- The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.
- No browser-extension download capture exists in this repository and none is claimed. The transfer surfaces cover only the local transfers the application genuinely performs.
- No installer, release asset, tag or download control is produced by this change.

### Verification

- Run and observed: `npm run build --workspace @material-tax-reporting/desktop` completed and wrote the main, preload, renderer, changelog, documentation-manifest and provenance outputs.
- Run and observed: the generated main and preload bundles were parsed with the Node syntax checker, and the inlined renderer bundle was parsed as a script; all three parsed without error.
- Not run, and therefore not claimed: tests, lint, type checks, packaging, installer creation, release, application launch, screenshots, accessibility conformance checks, performance measurements and native-speaker language review.
- The earlier statement that no build was run applies to the previous implementation lane recorded above; it is superseded for this change by the two run-and-observed lines.
