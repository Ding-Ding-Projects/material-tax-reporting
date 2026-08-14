# Transfer surfaces

## What this is

Start, Downloading and Complete states for the transfers this application actually performs: saving the project,
saving a password-wrapped copy, choosing an import copy destination, taking in an attachment, writing converter
output and writing an export.

There is no browser-extension capture path in this repository, and none is claimed. No state here describes a build,
an installer or a release, because this repository produces none.

## Start

A pre-flight dialog names the source, the exact destination path, the expected byte size and the unsigned status, and
requires explicit confirmation. Nothing is written before that confirmation. When the size cannot be known before the
data is prepared, the surface says so rather than showing a fabricated figure.

## Downloading

A non-modal progress surface driven by the single allowlisted progress channel shows the bytes written and the
elapsed time, and offers a cancel. The encrypted project container is written in bounded chunks so progress is real;
cancelling aborts the write and removes the partial temporary file, leaving the destination untouched.

## Complete

A non-blocking completion surface names the final path, the measured byte count and the content hash, and offers
reveal-in-folder and open-in-an-external-editor. It states that the resulting file is unsigned and makes no
signature-authenticity claim.

The underlying state machine cannot enter its complete state without a measured byte count, so a finished transfer
can never be announced without having been measured.

## Boundaries

The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing. A transfer copies data on this computer. It never sends anything anywhere.

## Failure modes

- A reported size that moves backwards, or that exceeds the expected total, fails the transfer rather than being
  smoothed over.
- A cancelled transfer reports that the partial file was removed.
- A failed transfer leaves the previous destination file in place.

## Verification status

The application build (`npm run build --workspace @material-tax-reporting/desktop`) was run and completed, and the generated main, preload and renderer bundles were parsed to confirm they are syntactically valid. No tests, lint, type checks, packaging, installer creation, release, runtime launch, screenshot, accessibility conformance check, performance measurement or native-speaker language review were run for this change, so none is claimed here.

## Related articles

- [Exports and bulk actions](exports-and-bulk-actions.md)
- [File converter](file-converter.md)
- [Encrypted project files](encrypted-project-files.md)
