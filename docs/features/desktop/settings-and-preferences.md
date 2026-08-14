# Settings and preferences

## What this is

The application keeps one bounded, schema-validated preference record in the application data directory, beside the
application-private project instances root and the protected key store. The record holds the personalization
preferences, the per-element appearance overrides, the tab layout, the presentation schedules, lock metadata, and the
pointers to the notification log and to the accepted personal vocabulary.

## Where the record lives and what it never touches

Preferences are application level. They are never written into an encrypted project file and never into a history
record, so sharing a project file with another person cannot disclose one person's settings. The record is read
through a bounded validator: an unknown field, an over-long value or a corrupted document falls back to the shipped
defaults rather than widening what the application accepts.

## Boundaries

The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing. Nothing on the settings destination changes a field name, a validation rule, a numeric limit or the
mail-in-only boundary statement.

## Failure modes

- An unreadable or malformed preference record is replaced in memory by the shipped defaults; the file on disk is
  only rewritten when a setting is next changed.
- A preference value outside its documented range is clamped to the range by the shared validator.
- A request to store more than the bounded number of entries is refused with a plain message.

## Verification status

The application build (`npm run build --workspace @material-tax-reporting/desktop`) was run and completed, and the generated main, preload and renderer bundles were parsed to confirm they are syntactically valid. No tests, lint, type checks, packaging, installer creation, release, runtime launch, screenshot, accessibility conformance check, performance measurement or native-speaker language review were run for this change, so none is claimed here.

## Related articles

- [Language modes and humour levels](language-and-funny-levels.md)
- [Appearance editor](appearance-editor.md)
- [Command palette](command-palette.md)
