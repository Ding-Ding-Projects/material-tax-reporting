# Local history

## Behaviour

Every personalization change is recorded in this browser: preferences, appearance overrides, the tab strip, locks, schedule rules, support notes, exports and vocabulary changes. The store is append-only and backed by the browser's indexed database, so a long record list does not have to be held in one string.

Restoring a recorded state writes a new record. Nothing recorded earlier is rewritten, amended or removed, and the confirmation names the exact values that would be reapplied before anything happens.

The panel filters by date range and by recorded action, carries an anchored builder over entry text, and shows a before-and-after difference for each record. The silent truncation the site previously performed is replaced by a documented cap with a visible prune control that reports exactly how many records it removed.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

- A date range and an action filter.
- A search field with its own anchored builder.
- Export of the filtered view or of the current selection.
- A prune control bounded by the kernel's cap.

## Failure modes

- A browser that exposes no indexed database reports that and the panel stays readable.
- A failed write reports the browser's own reason and the change is not shown as recorded.
- A restore of a revision that is not present reports that instead of guessing.

## Privacy and security

Records stay in this browser. Personal-vocabulary values are never written to a record: only the key count and the total key and value lengths are kept, and absolute paths are removed by the kernel's redaction pass before a record is stored.

## Verification status

This lane ran the site build (`npm run pages:build` in `apps/site`) and the source checks in `apps/site/src/checks`. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [Personal vocabulary](personal-vocabulary.md)
- [Exports and bulk actions](exports-and-bulk-actions.md)
