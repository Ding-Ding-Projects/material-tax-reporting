# Encrypted local history inside one project file

The Windows desktop application keeps an isolated Git repository inside the currently open report workspace. The complete repository, including objects, refs, and append-only commits, is packaged inside the report's single `.mtrproject` file. The project file is authoritative; there is no persistent history sidecar. The repository has no remote and exposes no API for adding one. Initialization and every later public operation re-check the no-remote invariant and fail closed if a remote appears.

The live state is stored as another encrypted project member beside the repository. Both the complete live state and every historical snapshot are encrypted with AES-256-GCM. A random portable project data key protects the project payload. That key is never written directly: a key derived from the user-chosen project-file password with bounded scrypt parameters wraps it using authenticated encryption. Passwords exist only in memory during create, open, or save-copy processing and are never logged, characterized, persisted, added to Git metadata, or exported.

Authenticated encryption binds each snapshot to its revision, purpose, and keyed stable-identifier token. The stable identifier survives delete and restore operations without exposing the underlying taxpayer record name in Git metadata.

## Append-only mutation contract

Every supported mutation creates a distinct commit:

- tax value creation;
- tax value edit;
- tax value import;
- parser correction;
- tax value deletion;
- wizard answer;
- settings mutation;
- discard;
- undo;
- redo; and
- restore.

Undo, redo, restore, labelling, pruning authorization, and transactional recovery append new commits. History is never rewritten for those operations. Commit subjects contain only generic action descriptions; taxpayer data, secrets, user labels, stable identifiers, calculations, and file paths remain inside authenticated encrypted payloads.

## Transactional updates and recovery

All value-changing surfaces call one `transact` method. It writes a recovery journal, encrypts the next snapshot, creates the history commit, and only then atomically replaces the encrypted live-state file. If the history commit cannot be created, the value change is refused and the live state remains unchanged. If the later live-state replacement fails, the committed snapshot is preserved, replay state is cleared, and a compensating recovery revision records the failure without accepting the requested live value.

An interrupted transaction is recovered from its bounded journal during initialization. Missing credentials, unreadable snapshots, repository damage, write failures, and invalid operations return a safe result containing a code, message, and recovery action. Query, diff, restore, label, storage, export, and pruning failures are shown as persistent non-blocking notifications. Recovery guidance preserves the credential, repository, and live-state file rather than deleting evidence.

## Browsing and restoring

The Local history tab provides:

- text search over decrypted local metadata;
- date-range and action filters;
- changed-field diffs;
- revision labels stored inside encrypted history;
- append-only restore, undo, and redo;
- storage use and revision count; and
- a redacted metadata export.

The redacted export explicitly omits taxpayer values, calculations, encrypted snapshots, encryption material, stable record identifiers, user labels, summaries, detailed metadata, file paths, and credential identifiers. It records only the revision identifier, local commit identifier, timestamp, and generic action, plus the redaction policy.

## Project container validation

The versioned container uses a fixed magic signature, bounded header, authenticated key wrapper, and authenticated encrypted payload. Every archived member has a normalized relative path, declared byte size, and SHA-256 digest. Import rejects absolute paths, traversal, device paths, duplicate members, unknown versions, unsupported tax years, missing rule-source or review metadata, excessive members, excessive individual or total size, digest mismatches, authentication failures, and embedded Git remotes. Only after extraction into a fresh bounded scratch directory does the application run `git fsck --full --strict`.

Before preview is returned, import also rejects any pending transaction or runtime journal and authenticates the inner live-state envelope with the portable project key. It requires schema version 1, matching project and wizard tax years, exact equality of the five review booleans with the project metadata, bounded parser records, and one-to-one agreement among parser confirmation records, imported slip records, and encrypted attachment members. A failed validation zeroes available key and plaintext buffers, removes only its pending scratch directory, and never creates or replaces live state or the currently active project.

Attachments and parser confirmation records are encrypted project members. The PDF form, calculation, attachment, mailing-address, and signature review checklist is also part of project state. Undo, redo, and restore remain available after a validated import because the imported Git object graph is preserved intact.

### Append-only reconciliation

A validated import can reconcile with the currently open project only when both files have an identical tax year, schema and member paths, and timing-safe identical portable data key. That key equality establishes the same encrypted-history lineage without exposing the key. Reconciliation works in a fresh candidate workspace: it imports the selected project's reachable refs and objects under bounded `refs/mtrproject/imports/...` names, creates a generic redacted reconciliation commit with both histories as parents, and uses the selected imported state as the resulting live state. It configures no remote and validates the candidate with `git fsck --full --strict` before atomically replacing the existing active project file. The selected import file is never modified.

If the keys, tax years, schemas, paths, repository state, refs, or object graph cannot be reconciled safely, no active state or project file changes. The application reports that reconciliation is unavailable and retains the explicit create-copy and replace alternatives.

## Retention and pruning

There is no artificial revision-count cap and no automatic expiry. The history surface reports repository, live-state, and total storage use so the user can decide whether pruning is necessary.

Pruning is optional and user-directed. It requires two independent acknowledgements, a full-range confirmation slider, and explicit acknowledgement that the operation is irreversible. The service appends an authorization audit revision before rebuilding the local repository without the selected revisions. It never configures a remote or silently runs retention in the background. If compaction fails, the implementation preserves or restores the prior repository when recovery is possible and reports the failure.

## Privacy boundary

The local-history repository is never synchronized or pushed. It contains encrypted envelopes and generic action metadata only. The temporary extracted workspace is scratch and is removed on project close or stale-scratch cleanup; cleanup never deletes a `.mtrproject` file. Empty passwords are refused for create, open, create-copy, and save-copy without reporting their length or any other characteristic. Application logs and public exports exclude taxpayer data, secrets, passwords, project keys, and snapshot contents. Project create, open, save, import, and history operations make no network request.
