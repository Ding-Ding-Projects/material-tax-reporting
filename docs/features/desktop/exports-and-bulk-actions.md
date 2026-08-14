# Exports and bulk actions

## What this is

The currently filtered view of the history, the notifications, the changelog, the support tickets, an appearance
preset or the settings can be written to a file the person chooses, in JSON, CSV, Markdown or plain text.

## The manifest

Every export carries a header block stating the encoding and line endings, the export schema version, the exact
filter that produced the rows, the row count and what was deliberately left out. Attachment bytes, personal
vocabulary content, lock verifiers and authenticator secrets are always omitted, and the header says so.

CSV cells are neutralized so a value cannot be interpreted as a spreadsheet formula.

## Redaction is on by default

The declared identity answers — the Social Insurance Number, the date of birth and the address — are replaced by a
marker unless the person ticks the option and types the confirmation phrase, modelled on the existing replace-project
gate. The manifest records which choice was made.

## Bulk actions

History rows and notification rows can be multi-selected. Every bulk action previews its exact scope before it runs,
naming the count, the filter and the first few affected rows. A bulk history action is recorded through the
append-only history under the shared action names.

## External editor handoff

The application uses one executable-discovery path, shared with the rest of the repository. A handoff opens only the
file that was just written or the folder containing it; the application-private instances root is never opened or
revealed. When no supported editor is detected, the surface says so and offers reveal-in-folder instead.

## Boundaries

The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing. An export is a local file. It is not a return, and writing one files nothing.

## Failure modes

- A request over the row, column or cell limits is refused with the exact limit.
- A failed write leaves no partial file at the destination.

## Verification status

The application build (`npm run build --workspace @material-tax-reporting/desktop`) was run and completed, and the generated main, preload and renderer bundles were parsed to confirm they are syntactically valid. No tests, lint, type checks, packaging, installer creation, release, runtime launch, screenshot, accessibility conformance check, performance measurement or native-speaker language review were run for this change, so none is claimed here.

## Related articles

- [Transfer surfaces](transfer-surfaces.md)
- [Notifications](notifications.md)
- [Append-only local history](local-history.md)
