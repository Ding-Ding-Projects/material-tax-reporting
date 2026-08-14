# Encrypted local history

The Windows desktop application keeps an isolated Git repository under its stable per-user application-data directory. The repository is outside project folders, has no remote, and exposes no API for adding one. Initialization and every later public operation re-check the no-remote invariant and fail closed if a remote appears.

The live state is stored separately from the Git repository. Both the complete live state and every historical snapshot are encrypted with AES-256-GCM. The encryption key is generated locally and stored in Windows Credential Manager under a stable application credential target. Secret material crosses the credential-manager helper through standard input and in-memory buffers, never command arguments, logs, repository files, or exports.

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

## Retention and pruning

There is no artificial revision-count cap and no automatic expiry. The history surface reports repository, live-state, and total storage use so the user can decide whether pruning is necessary.

Pruning is optional and user-directed. It requires two independent acknowledgements, a full-range confirmation slider, and explicit acknowledgement that the operation is irreversible. The service appends an authorization audit revision before rebuilding the local repository without the selected revisions. It never configures a remote or silently runs retention in the background. If compaction fails, the implementation preserves or restores the prior repository when recovery is possible and reports the failure.

## Privacy boundary

The local-history repository is never synchronized or pushed. It contains encrypted envelopes and generic action metadata only. Application logs and public exports exclude taxpayer data, secrets, and snapshot contents. The feature makes no network request.
