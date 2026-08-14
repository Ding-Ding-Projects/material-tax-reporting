# Slip parser changelog

## Unreleased

- Added a local-only TypeScript package for bounded PDF and image admission using byte and structural signature inspection.
- Added a fail-closed adapter registry that enables only package-declared bundled offline artifacts.
- Added bundled offline English and French OCR for PNG, JPEG, WebP, and scanned PDF pages using pinned Tesseract.js, PDF.js, and Windows canvas packages, with no `PATH` lookup, runtime download, URL input, cloud fallback, telemetry, or network route. TIFF remains admission-checked and fails closed because the bundled decoder does not claim a memory-bounded TIFF path.
- Added bounded sequential PDF rasterization, process-wide OCR concurrency and memory reservations, cancellation and timeout termination, deterministic raster/language/PDF/worker cleanup, and atomic rejection without partial output.
- Added source-relative geometry, confidence, source digest, raster-page digest, token evidence digest, and document extraction-evidence digest, plus mandatory acknowledgement of that evidence during side-by-side confirmation.
- Added an installer staging manifest and script that copies the complete offline runtime closure, verifies worker/core/WASM/language/PDF/native assets, and records per-file byte sizes and SHA-256 digests.
- Added bounded uncompressed PDF text-layer extraction with page coordinates and confidence evidence.
- Added tax-year and slip-type classification for T4, T4A, T4E, T5, T3, T5008, T2202, and RRSP contribution receipts.
- Added official CRA mapping metadata with formula and review-only distinctions for contextual relationships.
- Added digest-bound side-by-side manual confirmation that covers every candidate, ambiguity, warning, and final mail-in review item before a new return-entry projection can be created.
- Documented that the product supports only a CRA mail-in PDF package after mandatory manual review and does not support NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.

No tests, lint, type checks, captures, builds, releases, or runtime verification were performed for this ultra-speed implementation pass.
