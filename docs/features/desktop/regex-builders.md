# Regex builders

## What this is

One reusable anchored search builder, bound to the shared search engine, is instantiated independently beside every
search, filter, lookup, picker and menu filter in the application. Each instance owns its own pattern, flags,
validation message, sample text, live match list and capture-group readout.

Plain text is the default, so a person who never opens a builder sees an ordinary search box and no change in
behaviour.

## Where builders are attached

The history search and the history action filter, the notifications search, the changelog search, the documentation
search, the converter catalogue search, the tab overflow filter, the bulk-close filter, the settings search, the
appearance element finder, the locks search, the ticket search, the palette input, and every search scope inside the
local model destination.

## Fixed semantics

Filtering compiles without the global flag, so a test is not stateful. Analysis compiles with the global flag so every
match can be listed, and a zero-width match advances the cursor instead of looping. An over-long pattern or sample
returns a reason string instead of throwing. Only the documented flag set is accepted, repeated flags are refused, and
the two Unicode flags cannot be combined.

## The append-only store stays safe

The local history store keeps plain lowercased substring matching unless an explicit validated pattern search is
requested. Record enumeration and the current-revision lookup happen before any matching runs, so a malformed pattern
can never affect them; it simply matches nothing and the compile error is reported.

## Boundaries

The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.

## Failure modes

- An invalid pattern shows its compile error and matches nothing.
- An over-long sample reports its limit rather than being analysed.

## Verification status

The application build (`npm run build --workspace @material-tax-reporting/desktop`) was run and completed, and the generated main, preload and renderer bundles were parsed to confirm they are syntactically valid. No tests, lint, type checks, packaging, installer creation, release, runtime launch, screenshot, accessibility conformance check, performance measurement or native-speaker language review were run for this change, so none is claimed here.

## Related articles

- [Command palette](command-palette.md)
- [Append-only local history](local-history.md)
- [Notifications](notifications.md)
