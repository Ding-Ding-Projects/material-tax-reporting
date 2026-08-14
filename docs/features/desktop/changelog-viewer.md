# Changelog viewer

## What this is

The application build parses the tracked changelog files into a bounded record and adds the recorded commits for the
application paths. No version-control process is ever started at application run time: the viewer reads only the
record the build produced, from an allowlisted packaged location.

## What the viewer shows

Each entry is presented verbatim as generated: its area, version, date, category, entry text and commit identifier.
A from-and-to date filter and a text search with its own builder narrow the list. Entries that carry no commit
identifier say so instead of showing a guessed one.

The viewer presents the current unreleased heading exactly as written, including any statement about which checks
were and were not run. It does not label anything a release, a tag or a verified build.

## Commit links

A commit link is built only from a recorded repository address and a real commit identifier. Opening one leaves the
application, so it happens only after an explicit confirmation. When no repository address was recorded, no link is
offered.

## Boundaries

The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.

## Failure modes

- When no packaged changelog record is present, the destination names the searched locations and says the build has
  not been run for this copy.
- A malformed or over-large record is ignored rather than partially trusted.

## Verification status

The application build (`npm run build --workspace @material-tax-reporting/desktop`) was run and completed, and the generated main, preload and renderer bundles were parsed to confirm they are syntactically valid. No tests, lint, type checks, packaging, installer creation, release, runtime launch, screenshot, accessibility conformance check, performance measurement or native-speaker language review were run for this change, so none is claimed here.

## Related articles

- [Documentation browser](documentation-browser.md)
- [Transfer surfaces](transfer-surfaces.md)
- [Settings and preferences](settings-and-preferences.md)
