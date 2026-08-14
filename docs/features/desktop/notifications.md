# Notifications

## What this is

The transient notice region stays where it was. Behind it, a bounded local log records every notice with its
severity, its message, the recovery sentence the privileged boundary produces, its timestamp and the action that
raised it.

## What a notice body never contains

A notice body never carries the Social Insurance Number or an answer value. Only the field path is recorded, in the
same way a project mutation is summarized.

## Behaviour

- Failure notices are persistent: they stay until they are acknowledged, and they do not disappear on a timer.
- Search uses the shared search builder, and severity and date-range filters narrow the list further.
- Rows can be multi-selected. A bulk acknowledge or bulk delete first previews exactly how many entries and which
  filter the action covers, and names the first few by title.
- Blocking browser confirmations and prompts have been replaced by in-application dialogs that match the existing
  dialog pattern.

## Boundaries

The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing. A notice never claims that anything was filed or transmitted.

## Failure modes

- A log file over its size limit is trimmed to the newest half rather than being discarded.
- An entry with an unknown severity is dropped during validation.

## Verification status

The application build (`npm run build --workspace @material-tax-reporting/desktop`) was run and completed, and the generated main, preload and renderer bundles were parsed to confirm they are syntactically valid. No tests, lint, type checks, packaging, installer creation, release, runtime launch, screenshot, accessibility conformance check, performance measurement or native-speaker language review were run for this change, so none is claimed here.

## Related articles

- [Transfer surfaces](transfer-surfaces.md)
- [Exports and bulk actions](exports-and-bulk-actions.md)
- [Regex builders](regex-builders.md)
