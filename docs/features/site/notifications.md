# Notifications

## Behaviour

Notices carry a kind, a read flag and a full timestamp. Errors are announced assertively; success, information and progress notices stay polite. A progress notice is persistent: it waits for its outcome instead of disappearing on a timer, and the timer used for dismissible notices is cleared when the surface is removed.

The centre is a real list, not a log. It filters by kind and by date range, carries an anchored builder over title and body, offers per-row checkboxes with select-all-visible and shift-range selection, supports bulk mark-read and bulk dismiss, and exports the filtered view. Dismissing everything is gated behind a confirmation that states the exact count and lists what would go.

The badge in the header counts unread notices only.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

- Kind filters, a date range, and a search field with its own builder.
- Bulk mark-read and bulk dismiss over the current selection.
- Export of the filtered view through the shared export path.

## Failure modes

- A stored record that is not a notification is discarded when the list is read.
- The kernel's cap drops the oldest read, non-persistent notices first, so a progress or error notice is never dropped to make room.
- A browser that refuses local storage keeps the centre in memory for the session.

## Privacy and security

Notices stay in this browser. Bodies are bounded when they are restored, and nothing is transmitted.

## Verification status

This lane ran the site build (`npm run pages:build` in `apps/site`) and the source checks in `apps/site/src/checks`. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [Local history](local-history.md)
- [Read aloud](narration.md)
