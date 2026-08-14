# Append-only local history

## Behaviour

Every app-managed report owns a real local Git repository below the application data directory. Each changed user answer, attachment addition, attachment confirmation, attachment removal, manual-review acknowledgement, restore, undo, imported copy, replacement, and reconciliation is represented by its own commit.

The repository stores a new immutable encrypted snapshot record per revision and a pointer to the current revision. Restoring or undoing decrypts the selected historical snapshot and commits that state again as a new revision. Neither action resets, rebases, amends, deletes, or otherwise rewrites earlier history.

## History browser

The application provides a first-class browser that can:

- search revision summaries and user labels;
- filter by one or more recorded action types and a date range;
- identify the current revision;
- show changed state paths without placing taxpayer values in logs;
- label a revision;
- restore a selected revision;
- undo to the previous revision; and
- run strict Git object-graph validation.

## Confidentiality

Git records contain encrypted snapshot envelopes and redacted mutation metadata. Stable identifiers are keyed so private field values do not appear in commit subjects, summaries, filenames, refs, or repository configuration. Taxpayer values, passwords, protected keys, attachment bytes, and usable credentials never enter Git as plaintext.

The local project data key is a random 256-bit value protected with the operating system's encrypted storage. The portable project file carries a separately password-wrapped representation. Losing both the operating-system-protected key and every portable password-protected project file makes the encrypted history unrecoverable; the app does not claim otherwise.

## Failure modes

- A missing or unreadable protected key blocks decryption without altering history.
- A failed Git command prevents the mutation from being reported as saved.
- A snapshot with invalid authentication metadata, digest, project identifier, or revision identifier fails closed.
- A failed restore leaves the current revision selected and keeps all prior commits.
- An invalid imported object graph never reaches an active local repository.

## Verification status

No checks or runtime interaction were performed in the ultra-speed implementation lane. A later authorized verification pass should use an app-private disposable profile and independently inspect the real Git graph after every mutation and restore.

## Suggested articles

- [Encrypted project files](encrypted-project-files.md)
- [Guided report wizard](guided-report-wizard.md)
- [Manual PDF review](../pdf/manual-review.md)
