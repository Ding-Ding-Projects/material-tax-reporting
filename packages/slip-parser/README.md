# Local Canadian tax slip parser

This package provides a local-only TypeScript parsing boundary for uploaded Canadian tax slips and RRSP contribution receipts. It recognizes bounded PDF and image byte signatures, detects the tax year and supported slip type, extracts box candidates with page geometry and confidence, and exposes official CRA line relationships as reviewable suggestions.

It does not file a return. The product boundary is a CRA mail-in PDF package only. NETFILE, EFILE, electronic submission, direct CRA transmission, and automatic filing are not supported. Every populated form, calculation, attachment, mailing address, and signature field must be inspected manually before a mail-in package is produced.

## Processing boundary

1. `admitDocument` enforces byte, signature, PDF object/page, image-dimension, and pixel limits before extraction. Malformed, encrypted, oversized, and unsupported sources are rejected atomically.
2. `AdapterRegistry` enables only adapters that declare an exact package-owned artifact and runtime with `bundled=true`, `declared=true`, offline operation, no network access, and no telemetry.
3. The default registry first uses the dependency-free adapter for bounded, unencrypted PDFs with an uncompressed text layer. When that adapter cannot extract text, a bundled local OCR adapter rasterizes PDF pages or decodes PNG, JPEG, and WebP images, then recognizes English and French with package-owned Tesseract.js language data. TIFF remains admission-checked but fails closed at extraction because the bundled decoder does not claim a memory-bounded TIFF path.
4. The OCR adapter has no `PATH` discovery, runtime download, URL input, cloud fallback, telemetry, or network route. It reads trained data from installed package bytes, keeps Tesseract caching disabled, and processes PDF pages sequentially through the bundled PDF.js and Windows canvas runtime.
5. `parseSlipDocument` classifies T4, T4A, T4E, T5, T3, T5008, T2202, and RRSP contribution receipts. It returns only a `requires-manual-confirmation` draft.
6. `confirmSlipDraft` accepts a complete side-by-side review bound to the source-document digest, extraction-evidence digest, and parser-result digest. Every candidate needs exactly one decision, OCR evidence must be reviewed, every ambiguity must be corrected or excluded, and every issue and final-review checklist item must be acknowledged. Stale or incomplete confirmations are rejected.

The confirmation function returns a new projection and never mutates the parser draft. Even a confirmed projection contains suggestions rather than an automatic filing action.

## Privacy and accuracy

- Document bytes and extracted text stay in process. The API exposes no logger, telemetry, network, persistence, or history integration.
- Rejection results contain no partial fields or source excerpts.
- The returned draft does not retain the source document. The host must keep the source only in its private local review surface for the minimum time needed.
- Field coordinates are evidence for side-by-side review, not proof that extraction is correct.
- Every OCR token carries confidence, source-relative geometry, source digest, raster-page digest, and its own evidence digest. The draft also carries an extraction-evidence digest. These are provenance links, not correctness claims.
- OCR defaults are bounded to 25 pages, 12 million pixels per page, 40 million pixels per document, a 2.5 raster scale, 120 seconds, 512 MiB of reserved working memory, and one concurrent job. The reservation includes the runtime, source copies, admitted decoded-image pixels, and one raster page. Hard ceilings prevent caller-supplied settings from removing those bounds. Cancellation terminates the worker and discards raster bytes and partial output.
- A host cancels work by passing an `AbortSignal` as `parseSlipDocument(bytes, { signal })`. A cancelled or timed-out call returns a rejection state and never a partial draft.
- Official line relationships are year-sensitive. The bundled mapping set is explicitly identified as tax year 2025. Other detected years retain extracted box evidence but all line relationships become review-only until revalidated against that year's official CRA package.
- T5008 adjusted cost base, outlays, property classification, and resulting gain or loss are contextual. The package never invents a direct T1 mapping.

See `docs/features/slip-parser/official-mappings.md` for the exact official CRA sources and supported relationships.

## Bundled offline runtime

The exact runtime declaration is `assets/offline-ocr-runtime.json`. The package pins:

- Tesseract.js 7.0.0 and Tesseract.js Core 7.0.0, Apache-2.0, from <https://github.com/naptha/tesseract.js> and <https://github.com/naptha/tesseract.js-core>
- PDF.js distribution 6.1.200, Apache-2.0, from <https://github.com/mozilla/pdf.js>
- `@napi-rs/canvas` 1.0.6, MIT, from <https://github.com/Brooooooklyn/canvas>
- English and French Tesseract.js language packages 1.0.0, MIT, from <https://github.com/naptha/tessdata>

After an install with lifecycle scripts disabled, stage the complete resolved runtime closure for a Windows installer with:

```powershell
npm run stage:offline-ocr-assets --workspace @material-tax-reporting/slip-parser -- --output <fresh-empty-directory>
```

The staging command accepts only an empty destination, copies the matching Windows native canvas package, verifies the worker, core JavaScript, WebAssembly, PDF.js, and language files, and writes `offline-ocr-assets.lock.json` with every staged file's byte size and SHA-256. The installer must keep that directory unpacked in application resources. Missing or empty required assets are a packaging failure; the application must never recover by downloading them.
