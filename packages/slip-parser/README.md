# Local Canadian tax slip parser

This package provides a local-only TypeScript parsing boundary for uploaded Canadian tax slips and RRSP contribution receipts. It recognizes bounded PDF and image byte signatures, detects the tax year and supported slip type, extracts box candidates with page geometry and confidence, and exposes official CRA line relationships as reviewable suggestions.

It does not file a return. The product boundary is a CRA mail-in PDF package only. NETFILE, EFILE, electronic submission, direct CRA transmission, and automatic filing are not supported. Every populated form, calculation, attachment, mailing address, and signature field must be inspected manually before a mail-in package is produced.

## Processing boundary

1. `admitDocument` enforces byte, signature, PDF object/page, image-dimension, and pixel limits before extraction. Malformed, encrypted, oversized, and unsupported sources are rejected atomically.
2. `AdapterRegistry` enables only adapters that declare an exact package-owned artifact and runtime with `bundled=true`, `declared=true`, offline operation, no network access, and no telemetry.
3. The default registry contains one dependency-free adapter for bounded, unencrypted PDFs with an uncompressed text layer. It does not enable image OCR. Compressed-only PDFs and images fail closed until a package-owned OCR or extraction runtime is bundled and declared.
4. `parseSlipDocument` classifies T4, T4A, T4E, T5, T3, T5008, T2202, and RRSP contribution receipts. It returns only a `requires-manual-confirmation` draft.
5. `confirmSlipDraft` accepts a complete side-by-side review bound to both the source-document digest and parser-result digest. Every candidate needs exactly one decision, every ambiguity must be corrected or excluded, and every issue and final-review checklist item must be acknowledged. Stale or incomplete confirmations are rejected.

The confirmation function returns a new projection and never mutates the parser draft. Even a confirmed projection contains suggestions rather than an automatic filing action.

## Privacy and accuracy

- Document bytes and extracted text stay in process. The API exposes no logger, telemetry, network, persistence, or history integration.
- Rejection results contain no partial fields or source excerpts.
- The returned draft does not retain the source document. The host must keep the source only in its private local review surface for the minimum time needed.
- Field coordinates are evidence for side-by-side review, not proof that extraction is correct.
- Official line relationships are year-sensitive. The bundled mapping set is explicitly identified as tax year 2025. Other detected years retain extracted box evidence but all line relationships become review-only until revalidated against that year's official CRA package.
- T5008 adjusted cost base, outlays, property classification, and resulting gain or loss are contextual. The package never invents a direct T1 mapping.

See `docs/features/slip-parser/official-mappings.md` for the exact official CRA sources and supported relationships.
