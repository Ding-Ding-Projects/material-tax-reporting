# Exports and bulk actions

## Behaviour

An export is serialized by the kernel into JSON, comma-separated, Markdown or plain text, and always carries a manifest stating the surface, the collection, the moment, the exact filter that produced it, the row count, and what was omitted or redacted. Comma-separated cells are neutralized so a value cannot be interpreted as a formula by a spreadsheet application.

Preferences, appearance overrides, local history, notifications, the changelog view, the documentation index, support notes, locks and converter results all use the same path.

A shared selection layer gives every list per-row checkboxes, select-all-visible, shift-range selection and a live selected count. A destructive bulk action is gated behind a confirmation naming the exact count and listing what would be affected.

Delivery is honest about the browser sandbox. Where the browser supports it, an export can be written to a folder the reader chooses; elsewhere it is delivered as an ordinary download; and a copy-to-clipboard path is always available. The limitation is stated in the interface instead of offering an editor button that cannot work from a page.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

- Four formats.
- A folder-choosing save where the browser supports it, a download fallback, and a clipboard path.
- Selection controls on every list with bulk actions.

## Failure modes

- A refused save reports the browser's own reason and nothing is written.
- A browser without clipboard access reports that rather than silently doing nothing.
- A destructive action cancelled at the confirmation changes nothing.

## Privacy and security

Personal-vocabulary values are redacted from every export, which carries key counts and lengths only. The temporary object address used by the download path is released immediately after the download is dispatched.

## Verification status

This lane ran the site build (`npm run pages:build` in `apps/site`) and the source checks in `apps/site/src/checks`. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [Local history](local-history.md)
- [Notifications](notifications.md)
