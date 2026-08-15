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
- Portable document text layer to plain text.

## Portable document text extraction

The document adapter reads the text layer a document already carries. It is bundled: extraction uses the runtime's
own zlib to decode the `FlateDecode` streams that hold page content, so nothing is downloaded, nothing is discovered
on the machine, no extra dependency is installed and no packaged resource directory is required. It makes no network
request.

Objects are located by scanning the file rather than by following the cross-reference table, so a document that was
saved incrementally, that uses a cross-reference stream, or whose table is damaged is still readable. Compressed
object streams are expanded, because that is where a document produced by current software keeps its page tree.
Characters are mapped through a font's `ToUnicode` map when the font supplies one and through Windows-1252 when it
does not.

Two limits are worth stating because they shape the output. Glyph widths are not resolved from the embedded font
program, so the space between two separately positioned runs on one line is inferred from an estimated advance; a
document that positions text word by word reads correctly, and a document that positions every glyph individually is
left unsplit rather than being given a space between every letter. A glyph that the font maps through a private
encoding with no `ToUnicode` entry cannot be recovered and is dropped rather than guessed at.

The adapter refuses rather than producing a plausible-looking wrong answer:

- A page with no text layer is a scanned picture. The adapter says so and names the optical-character-recognition
  row, instead of returning an empty file that reads as a successful conversion.
- An encrypted document is refused with instructions to save an unencrypted copy first.
- A file whose bytes are not a document is refused on its content, even when it is named `.pdf`.
- Page content compressed with a predictor this build does not un-filter is reported as unread rather than decoded
  into noise.

## Adapters that are not bundled

Scanned-image text extraction is listed as a disabled row. It reports the result of the packaged offline
optical-character-recognition discovery that the application already performs, so the reason shown is the real one
rather than a generic message. It is the only disabled row in the catalogue.

## How a conversion runs

Every conversion runs in the privileged boundary against files the person chose. Each file is bounded by the same
96 MB limit that applies to an attachment, output is written only to a folder chosen through a dialog, and an
existing output file is never overwritten. Each file returns its own validated result with an explicit failure
reason. A conversion is strictly offline.

Progress is reported as each output lands rather than in one jump at the end, and a cancel raised on the surrounding
transfer stops the batch at the next file boundary. Each converted file carries the digest of the bytes written. When
the batch produced exactly one file the transfer reports that file's digest; when it produced several it reports a
digest over the manifest of output names and digests, named as a manifest digest rather than presented as a file
hash.

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
- A document with no readable text layer, an encrypted document, and a file that is not a document at all are each
  refused by name; the rest of the batch still runs.

## Verification status

The application build (`npm run build --workspace @material-tax-reporting/desktop`) was run and completed, and the generated main, preload and renderer bundles were parsed to confirm they are syntactically valid.

The document adapter was additionally exercised directly against the shipped module, outside the packaged
application, using a scratch script that was not committed. Eight constructed documents covered uncompressed page
content, `FlateDecode` page content, multi-page tree order, a `Type0` font with a `ToUnicode` map, a page whose only
content is an image, an encrypted document, a file that is not a document, and a page dictionary held inside a
compressed object stream; all eight behaved as this article describes. Three real documents present on the
verification machine were extracted, the largest being 88 pages in about 0.7 seconds. The whole converter path was
then exercised through `FileConverter` itself, confirming the catalogue state, the per-file preview blockers,
progress reporting, cancellation, refusal to overwrite an existing output, and a reported digest equal to the digest
of the bytes on disk.

This is module-level evidence, not runtime evidence. The application was not launched, the converter destination was
not operated by a person, and no capture was taken. No tests, lint, type checks, packaging, installer creation,
release, screenshot, accessibility conformance check, performance measurement or native-speaker language review were
run for this change, so none is claimed here.

## Related articles

- [Transfer surfaces](transfer-surfaces.md)
- [Encrypted project files](encrypted-project-files.md)
- [Guided report wizard](guided-report-wizard.md)
