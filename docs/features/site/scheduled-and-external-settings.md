# Scheduled and external presentation settings

## Behaviour

This article is about the site's own presentation settings. It has nothing to do with a tax schedule or an official form.

A rule changes a presentation setting during a time window. A rule never writes to the stored preference: the kernel evaluates the active rules into an overlay, and precedence is fixed and documented, with a change made by hand winning over an active rule and an active rule winning over the stored default. Turning a rule off therefore restores the stored value exactly, because that value was never replaced.

The window is evaluated in the browser's own time zone, including a window that crosses midnight. One interval re-evaluates while the tab is visible, and a visibility change re-evaluates immediately, so a tab that was in the background catches up instead of showing a stale window.

The external half is off by default. When it is switched on, one address the reader types may supply presentation values only. The address must be a complete https address, the fetch is bounded by an abort timeout, and the document is validated against the kernel's bounded schema and must declare the same origin it was served from. Any failure falls back to the local rules and states the exact reason.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

- Rules, each with a target setting, a value, a start time, an end time and an optional set of weekdays.
- External presentation settings: off by default, with an address and an explicit read control.

Only presentation settings are reachable: theme, density, motion, dock edge, accent colour, font scale and the decorative emoji. A key outside that set is ignored by name.

## Failure modes

- A malformed time or an empty window makes the rule inactive rather than raising an error.
- A non-https address, a failed request, a timeout, a document that is too large, a document with unknown fields, or a document declaring a different origin all fall back to the local rules with the reason shown.
- Values that are not presentation settings are listed as ignored rather than silently dropped.

## Privacy and security

Nothing is uploaded. The external read is a plain request for a document the reader chose, made without credentials and without following a redirect, and it can change presentation only.

## Verification status

This lane ran the site build (`npm run pages:build` in `apps/site`) and the source checks in `apps/site/src/checks`. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [Material 3 shell and appearance](material-3-shell-and-appearance.md)
- [Local history](local-history.md)
