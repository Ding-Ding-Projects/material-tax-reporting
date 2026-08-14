# Desktop changelog

## Unreleased

### Added

- Added a runnable frameless Windows Electron shell with Material Design 3 styling and left-docked browser-style navigation.
- Added a beginner-guided return wizard with one question per step, plain-language explanations, answer-location guidance, clearly labelled synthetic examples, inline validation, conditional branching, progress, save/resume behaviour, and an always-visible internal link to the exact review-map form and line target.
- Added local slip-upload entry points behind a replaceable parser adapter. Parsed values remain correction-required drafts and manual entry remains available when no parser is connected.
- Added a mandatory five-part manual review checklist that locks mail-package export and print until every populated form, calculation, attachment, applicable mailing address, and signature field is acknowledged.
- Added a strict paper-only boundary: the desktop application does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.
- Added encrypted, append-only local Git history inside the authoritative `.mtrproject` file, using the password-wrapped portable project data key, authenticated stable identifiers, generic commit metadata, no remote, transactional value updates, append-only undo/redo/restore, search, filters, diffs, labels, storage reporting, redacted export, explicitly confirmed pruning, and persistent code/message/recovery notifications for operation failures.
- Added persisted language, independent English and Cantonese funny-level, theme, and dialog-emoji settings, plus non-blocking notifications, a `Ctrl+Shift+F` command palette, and adjacent guided regular-expression builders for search surfaces.
- Added a versioned single-file `.mtrproject` format containing the encrypted current state, bounded encrypted attachments, rule-source and parser-confirmation metadata, final PDF review state, and complete append-only Git object graph without a persistent sidecar.
- Added atomic project creation and saving, explicit save-copy destinations, password-wrapped portable project keys using bounded scrypt and authenticated encryption, per-member SHA-256 hashes, strict bounded import validation, Git object-graph validation, embedded-remote rejection, and ephemeral scratch cleanup.
- Added validated import previews with explicit create-copy, reconcile, and replace routes. Same-lineage projects can reconcile append-only through namespaced Git refs and a generic reconciliation commit, with imported state winning; incompatible histories fail closed without changing either file.
- Hardened project import previews to reject pending runtime journals, authenticate the inner encrypted live-state envelope, and require matching tax year, review checklist, parser confirmations, imported slip records, and encrypted attachment inventory before activation.
- Added fail-closed empty-password handling for project create, open, create-copy, and save-copy without disclosing password characteristics.

### Verification

- This ultra-speed implementation pass intentionally did not run tests, lint, type checks, builds, captures, or runtime UI verification.
