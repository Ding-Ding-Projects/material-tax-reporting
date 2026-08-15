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

Each transfer kind reports the digest it can actually measure:

| Kind | Byte count | Digest |
| --- | --- | --- |
| Project save, project save copy | Measured over the container written | The container's own digest |
| Attachment intake | The plaintext size taken in | The plaintext digest, reproducible from the source file |
| Converter output | The total written across the batch | The single output's digest, or a named manifest digest for a batch |
| Export | Measured over the export body | The export body's digest |
| Import copy destination | None; nothing is written at this step | None |

## A step that chooses a destination is not a transfer

Choosing where an imported copy will go writes nothing. That step therefore does not enter the downloading phase and
does not complete: it stays in its start phase, returns the chosen destination, and states that no bytes are written
until the import is activated, at which point the real write reports its own measured size and digest. Passing the
state machine a placeholder byte count to make that step look finished would defeat the one structural promise the
machine exists to make, so it is not done.

## Boundaries

The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing. A transfer copies data on this computer. It never sends anything anywhere.

## Failure modes

- A reported size that moves backwards, or that exceeds the expected total, fails the transfer rather than being
  smoothed over.
- A cancelled transfer reports that the partial file was removed.
- A failed transfer leaves the previous destination file in place.
- A conversion that produced nothing fails the transfer rather than completing with an empty result, and says whether
  it was cancelled or simply converted no file.

## Known gap

The completion card is rendered by the renderer, which words every successful commit as `Written to <path>`. For the
import-copy destination step that wording is wrong: the path shown is where the copy *will* be written, and the card
correctly reports zero bytes and no digest beside it. The main process no longer claims a measured transfer for that
step; aligning the card's wording is a renderer change and has not been made.

## Verification status

The application build (`npm run build --workspace @material-tax-reporting/desktop`) was run and completed, and the generated main, preload and renderer bundles were parsed to confirm they are syntactically valid.

The converter transfer's progress reporting, cancellation relay and digest measurement were exercised directly
against the shipped converter module using a scratch script that was not committed, confirming that the reported byte
total and digest equal the bytes on disk. No transfer has been performed by a running application: the project save,
save copy, attachment intake, export and import-copy paths are unobserved at runtime, and no capture was taken. No
tests, lint, type checks, packaging, installer creation, release, screenshot, accessibility conformance check,
performance measurement or native-speaker language review were run for this change, so none is claimed here.

## Related articles

- [Exports and bulk actions](exports-and-bulk-actions.md)
- [File converter](file-converter.md)
- [Encrypted project files](encrypted-project-files.md)
