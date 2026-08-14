# Local tax-slip parser

The tax-slip parser is an extraction aid for Canadian income-tax preparation. It reads bounded PDF and image uploads locally, identifies a supported slip and tax year, and produces reviewable field candidates with source locations and confidence. It never files a return and never treats extracted text as verified taxpayer data.

## Non-negotiable product boundary

This feature does not implement, offer, simulate, or imply NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing. Its only downstream filing product may be a CRA mail-in PDF package. Before that package can be produced, the user must manually review every form, calculation, attachment, mailing address, and signature field and explicitly acknowledge that review.

Parser output is provisional. No extracted value may enter return state until the user confirms it side by side with the source page. A confidence score is a reading aid, not a statement that the value or its tax treatment is correct.

## Supported documents

The parser recognizes these document families:

- T4, Statement of Remuneration Paid
- T4A, Statement of Pension, Retirement, Annuity, and Other Income
- T4E, Statement of Employment Insurance and Other Benefits
- T5, Statement of Investment Income
- T3, Statement of Trust Income Allocations and Designations
- T5008, Statement of Securities Transactions
- T2202, Tuition and Enrolment Certificate
- RRSP contribution receipts

Recognition does not mean every box can be assigned to a return line. [Official mappings](official-mappings.md) distinguish direct CRA relationships from calculations and contextual decisions that remain review-only.

## Local processing pipeline

1. Inspect the bytes before selecting a decoder. File extensions and supplied MIME types are hints only.
2. Accept only allowlisted PDF and raster-image signatures within configured byte, page, pixel, frame, memory, and processing-time limits.
3. Reject malformed, unsupported, or over-limit input atomically. An encrypted PDF is rejected unless the user supplies access through the application’s private local credential flow.
4. Select an extraction adapter only when its complete runtime is bundled with the installed product and declared in the adapter registry. A runtime discovered on `PATH`, a developer tool, or an optional network service cannot enable an adapter.
5. Prefer the bounded built-in PDF text layer when it is available. Otherwise rasterize PDF pages locally with the bundled PDF.js and Windows canvas packages, or decode the admitted image, and recognize both English and French with bundled Tesseract.js trained data.
   The OCR adapter supports scanned PDF pages plus PNG, JPEG, and WebP images. TIFF remains admission-checked but fails closed at extraction because the bundled decoder does not claim a memory-bounded TIFF path.
6. Extract text and geometry in a least-privileged local worker with no network access. Cloud OCR, remote document conversion, analytics, telemetry, URL inputs, runtime downloads, and network fallback are prohibited.
7. Detect the document family and tax year. An absent, conflicting, unsupported, or low-confidence result prevents return integration.
8. Emit candidates with their page, source-relative bounding box, raw text, normalized value, confidence, source digest, raster-page digest, token-evidence digest, and warnings.
9. Present the source and candidates side by side. Only an explicit per-field user confirmation that also acknowledges the extraction evidence can create an integration instruction.

No failure may partially apply values. A rejected document and an abandoned confirmation session leave return state unchanged.

## Structured output

The parser contract is intentionally separate from return mutation. A result contains:

- a non-sensitive, session-scoped document identifier;
- detected document family and tax year, each with confidence and evidence references;
- page count and adapter identity/version;
- an extraction-evidence digest covering the adapter, source digest, pages, tokens, geometry, confidence, and warnings;
- extracted fields with box identifier, raw text, normalized value, page number, bounding rectangle, confidence, and warning codes;
- mapping candidates with their official source URL, tax-year scope, target form or line, and status (`direct`, `calculation-required`, `context-required`, or `unsupported`);
- document-level warnings and a final `manual-confirmation-required` state.

The result must not contain the original document bytes. Integrators must treat coordinates as page-relative geometry and preserve the link between every normalized value and its source region.

## Integration contract

An integration layer may accept a field only when all of the following are true:

- the document family and tax year are confirmed by the user;
- the field has a non-empty source region on a valid page;
- the field is not missing, ambiguous, duplicated, conflicting, or below the configured confidence threshold;
- the mapping is supported for that exact tax year by a versioned mapping artifact and an official CRA source;
- the user has compared the candidate with the rendered source and explicitly confirmed it;
- any required calculation, residency choice, schedule, footnote, eligibility test, or taxpayer classification has been completed outside the parser and separately confirmed.

Confirmation produces an explicit instruction; it does not directly mutate a return. The return engine must revalidate type, currency, sign, range, tax year, destination, duplication, and prerequisite calculations before committing the instruction atomically.

Changing the source document, OCR result, tax year, mapping version, or normalized value invalidates earlier confirmation. Bulk confirmation is not permitted.

## OCR resource and cancellation limits

The shipped defaults admit at most 20 MiB of source bytes and then constrain OCR separately to 25 pages, 12 million raster pixels per page, 40 million raster pixels per document, a 2.5 raster scale, 120 seconds, a 512 MiB working-memory reservation, and one active OCR job. The implementation also has non-configurable ceilings of 100 pages, 25 million pixels per page, 100 million pixels per document, 4x raster scale, five minutes, 1 GiB, and two concurrent jobs.

PDF pages are rendered and recognized sequentially so a document never retains every page raster. Before work starts, the adapter reserves memory for the OCR runtime, source copies, admitted decoded-image pixels, and one page raster. It rejects invalid or exhausted limits without queueing. Cancellation or timeout cancels the active PDF render where possible, terminates the Tesseract worker, zeros language and raster buffers held by the adapter, destroys the PDF decoder, and returns no partial candidates.

The host supplies cancellation through `parseSlipDocument(sourceBytes, { signal })`. An already-aborted signal starts no OCR work. Cancellation while a language load or worker startup is settling schedules disposal as soon as that operation resolves, so late resources cannot become an unowned background worker.

The adapter does not create temporary files. Tesseract cache reads and writes are disabled. Source bytes and OCR plaintext remain process-local and become unreachable when parsing ends; only bounded evidence and candidates enter the manual-review draft.

## Installer assets and upstream sources

`packages/slip-parser/assets/offline-ocr-runtime.json` declares the installer contract, versions, licenses, supported Windows architectures, and required offline properties. `packages/slip-parser/scripts/stage-offline-ocr-assets.mjs` copies the installed production dependency closure into a fresh installer-resource directory and writes a per-file SHA-256 inventory. The staging command fails when the matching Windows native canvas binding, Tesseract worker, Tesseract core JavaScript or WebAssembly variants, English or French model, or PDF.js runtime is missing.

Current supported dependencies were selected from their primary upstream records:

- Tesseract.js 7.0.0 and its local worker/core path options: <https://github.com/naptha/tesseract.js/releases/tag/v7.0.0> and <https://github.com/naptha/tesseract.js/blob/master/docs/api.md>
- Tesseract.js English and French local language packages 1.0.0: <https://github.com/naptha/tessdata>
- PDF.js 6.1.200 and its prebuilt npm distribution: <https://github.com/mozilla/pdf.js> and <https://github.com/mozilla/pdf.js/wiki/setup-pdf.js-in-a-website>
- `@napi-rs/canvas` 1.0.6 for a self-contained native rasterizer: <https://github.com/Brooooooklyn/canvas>

The package and lockfile pin exact versions. Installer staging must run after `npm ci --ignore-scripts --no-audit --fund=false`; no dependency lifecycle script is required for the bundled runtime.

## Review and warning states

The interface must call attention to, and block integration for:

- unsupported or conflicting document type;
- missing, conflicting, or implausible tax year;
- unreadable, truncated, overlapping, or duplicated fields;
- low OCR confidence or a value assembled from multiple uncertain regions;
- a box whose treatment depends on age, residency, account-of-income-versus-capital classification, another box, a footnote, an attached statement, or another form;
- totals that do not reconcile with component boxes;
- a mapping source that does not cover the detected tax year;
- an adapter whose bundled runtime or declared version is missing.

Warnings are additive and remain visible after confirmation. The application must never replace uncertainty with a guessed zero, blank, sign, tax year, slip type, or destination line.

## Privacy and retention

- Source documents, crops, OCR text, government identifiers, addresses, and extracted values remain local and private.
- Document bytes and plaintext extracted data must not enter logs, telemetry, analytics, prompts, public files, repository history, ordinary exports, crash reports, or application history snapshots.
- Temporary files use a private, task-scoped directory, are bounded, and are removed on success, rejection, cancellation, or timeout.
- Diagnostics contain only stable error codes, adapter versions, limit names, and non-sensitive counts.
- If persistence is explicitly required by a later product surface, it must use approved private application storage and encryption; parser output is ephemeral by default.

## Accuracy and tax-year policy

Tax forms, box meanings, schedules, and return lines can change. Mapping data must identify its tax year and cite the exact official CRA page used. A parser version may extract a document from another year, but it must label all return mappings unsupported until a mapping artifact for that exact year exists.

The Canada.ca pages cited in this documentation were checked on 2026-08-14. Their current content primarily describes the 2025 return. The application must revalidate sources and mappings before adding another tax year; a live URL alone is not proof that unchanged instructions apply to an older or newer return.

This software is an aid, not tax, legal, accounting, or financial advice. Users must compare every value with the original document and current CRA forms and instructions. When an issuer’s slip is wrong or unclear, the user should contact the issuer or a qualified tax professional rather than accepting parser output.

