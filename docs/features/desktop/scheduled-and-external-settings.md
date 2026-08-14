# Scheduled and external settings

## What this is

Presentation settings can follow a time of day, and can optionally come from an external document. Both carry
presentation settings only.

## Precedence

The order is fixed and reported: an explicit manual override beats an active schedule rule, and an active rule beats
the stored default. The schedules editor lists, target by target, which layer is currently winning and why, and names
the rules that are active at the moment of evaluation.

Rules are evaluated against a named time zone. A window that crosses midnight stays active until its end time on the
following day. An unusable time zone is reported rather than silently substituted.

## External sources

External sources are opt-in and off by default. Because the interface process is forbidden from opening connections,
any read happens in the privileged boundary, against an https address whose origin the person added to an allowlist,
with a bounded schema, a bounded response size and a short timeout. A received document is shown as received and not
applied until it validates. On failure the last applied local value stays in force and the surface says so.

No project answer, attachment name or vocabulary content is ever transmitted on this path.

## Boundaries

The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing. An external document can change presentation settings only. It cannot change an answer, a limit, a
validation rule or the boundary statement.

## Failure modes

- An address that is not on the allowlist is refused before any request is made.
- A non-success status, a timeout or an unreadable body leaves the last applied value in force.
- A document that fails the bounded schema is reported as received and not applied, with the exact reason.

## Verification status

The application build (`npm run build --workspace @material-tax-reporting/desktop`) was run and completed, and the generated main, preload and renderer bundles were parsed to confirm they are syntactically valid. No tests, lint, type checks, packaging, installer creation, release, runtime launch, screenshot, accessibility conformance check, performance measurement or native-speaker language review were run for this change, so none is claimed here.

## Related articles

- [Settings and preferences](settings-and-preferences.md)
- [Appearance editor](appearance-editor.md)
- [Notifications](notifications.md)
