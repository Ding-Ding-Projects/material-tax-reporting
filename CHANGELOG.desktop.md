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

### Boundaries

- The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.
- No tests, lint, type checks, builds, packages, runtime launches, audits, reviews, or screenshots were run for this ultra-speed implementation lane.
