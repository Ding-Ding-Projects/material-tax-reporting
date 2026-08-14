# Encrypted project files

## Behaviour

Each report is saved as one `.mtrproject` file. The file contains:

- the encrypted current report state;
- encrypted local attachments;
- tax year and official-rule-source metadata;
- parser-confirmation metadata;
- the manual PDF review checklist;
- the complete app-private Git working data, object database, refs, and append-only revision history; and
- a password-wrapped portable data key.

The local working repository lives below the application's private data directory, not inside the folder holding the user-selected project file and never as a `.git` directory in a user document folder.

## Cryptography and bounds

Project state snapshots, attachments, and the complete outer archive use AES-256-GCM with purpose-specific authenticated data. The random 256-bit project data key is protected locally by the operating system and wrapped for portability with a password-derived scrypt key. The scrypt parameters are fixed and validated on import; unsupported or weakened parameters fail closed.

The container validates its magic and schema version before decryption. It enforces bounded header, payload, entry-count, per-entry, total-size, path-length, and path-depth limits. Every member must have one normalized relative path. Absolute paths, drive paths, UNC paths, empty path segments, traversal segments, alternate separators, device names, duplicates, links, and archive paths that could escape the destination are rejected before extraction.

Every member carries a SHA-256 digest and a contiguous byte range. The complete decrypted payload carries its own size and digest. Authentication and all hashes must succeed before preview data is shown.

## Git validation

An imported file must include `.git/HEAD`, `.git/config`, object data, and a resolvable head. The app extracts only into a new temporary directory and runs strict, full Git object-graph validation before presenting import choices. The temporary preview is discarded without changing the open project when validation or activation fails.

## Import preview choices

- **Create copy** keeps the complete validated history in a new app-private instance and asks for a new destination. An existing file is never overwritten.
- **Reconcile** is available only for another copy of the same stable project using the same data key. It imports the other object graph, preserves unique encrypted records, and creates a new reconciliation commit whose parents retain both histories.
- **Replace** requires an open project and the exact confirmation phrase. Validation completes before the current local instance changes.

## Atomicity and recovery

The app writes a fresh sibling file, flushes it, and renames it into place. Save copy and Create copy refuse an existing destination. Import extraction uses exclusive file creation beneath a validated temporary root. A failed operation leaves the previous project file available and never reports a partial project as active.

## Verification status

No tests, build, package, runtime launch, review, or screenshots were run in this ultra-speed lane. The next authorized verification pass should exercise authentication failure, every size and path bound, corrupted hashes, wrong passwords, invalid Git objects and refs, copy/reconcile/replace, interrupted saves, and packaged-resource discovery against the built application.

## Suggested articles

- [Guided report wizard](guided-report-wizard.md)
- [Append-only local history](local-history.md)
- [Local-first privacy](../../site/local-first-privacy.md)
