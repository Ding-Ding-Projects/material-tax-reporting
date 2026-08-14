# File converter

## What this is

A converter destination that lists guided categories and, inside each category, the adapters this build actually
carries. An adapter that is not bundled stays visible as a disabled row naming exactly what is missing, rather than
being hidden.

## Bundled adapters in this build

- Comma-separated values to JSON.
- JSON rows to comma-separated values.
- Markdown pipe table to comma-separated values.
- Plain text line-ending and trailing-space normalization.

## Adapters that are not bundled

Document text extraction and scanned-image text extraction are listed as disabled rows. The scanned-image row reports
the result of the packaged offline optical-character-recognition discovery that the application already performs, so
the reason shown is the real one rather than a generic message.

## How a conversion runs

Every conversion runs in the privileged boundary against files the person chose. Each file is bounded by the same
96 MB limit that applies to an attachment, output is written only to a folder chosen through a dialog, and an
existing output file is never overwritten. Each file returns its own validated result with an explicit failure
reason. A conversion is strictly offline.

## Converted output is not confirmed tax data

Converted output that later feeds the report must still pass the existing manual parser-confirmation step, so nothing
derived by a converter is ever treated as confirmed tax data.

## Boundaries

The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing. The converter neither prepares nor transmits a return.

## Failure modes

- A file whose detected format does not match the chosen converter is blocked before the batch runs, with the reason
  shown on that row.
- A file over the size limit, an empty file or an unreadable file is refused individually; the rest of the batch
  still runs.
- Cancelling a batch stops the remaining files and reports which ones were not read.

## Verification status

The application build (`npm run build --workspace @material-tax-reporting/desktop`) was run and completed, and the generated main, preload and renderer bundles were parsed to confirm they are syntactically valid. No tests, lint, type checks, packaging, installer creation, release, runtime launch, screenshot, accessibility conformance check, performance measurement or native-speaker language review were run for this change, so none is claimed here.

## Related articles

- [Transfer surfaces](transfer-surfaces.md)
- [Encrypted project files](encrypted-project-files.md)
- [Guided report wizard](guided-report-wizard.md)
