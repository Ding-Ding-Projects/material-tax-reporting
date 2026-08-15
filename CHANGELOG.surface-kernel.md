# Shared surface kernel changelog

## Unreleased

### Added

- Added `@material-tax-reporting/surface-kernel`, a dependency-free TypeScript package compiled against the ES2022 standard library only, so React, Electron and DOM types cannot enter the shared layer.
- Added `ports.ts` with the key-value store, clock, identifier, byte-source, abort-signal and Web Cryptography interfaces every stateful engine receives, plus system and fixed implementations for use in tests.
- Added one anchored regular-expression search engine with a flag allowlist, bounded pattern and sample lengths, a zero-width match guard, global-flag semantics fixed per purpose, and a builder palette that includes explicit start-anchor and end-anchor tokens.
- Added the shared preference record, its validator, its patch helper, and versioned storage keys with an upgrade from the previously shipped version 1 preference record.
- Added language resolution across five humour levels per language and `assertFactsInvariant`, which reports copy keys whose humour variants disagree on a fact-bearing token.
- Added personal-vocabulary validation, compilation and single-pass whole-token substitution with immutable spans that are never rewritten.
- Added the command registry, its search, its teleport target resolution, and a coverage check that reports preference keys no command can reach.
- Added notification state with the rule that progress and error notices never auto-dismiss, plus filtering and bulk-scope selection.
- Added the append-only history model: the widened action list, redaction rules, filtering, a cap helper, and a restore that returns a new record without mutating the supplied history.
- Added export serialization for JSON, CSV, Markdown and plain text with an export manifest, and CSV cell neutralization that prevents a cell from executing as a spreadsheet formula.
- Added per-element appearance overrides bounded by a custom-property allowlist and an inert-value check, with preset export and import.
- Added colour parsing, conversion and formatting across hexadecimal, RGB, HSL, HWB, Lab, LCH, Oklab and Oklch, WCAG 2 contrast ratios and verdicts, and honest out-of-gamut reporting.
- Added presentation locks backed by salted PBKDF2-SHA-256 verifiers with length-constant comparison, together with a constant disclosure sentence stating they are not a security control.
- Added the tab model: ordering, pinning, grouping, dock-aware keyboard movement, overflow, and a bulk close that reports its exact matched set for confirmation.
- Added time-of-day presentation schedules with a documented precedence of manual override over active rule over stored default, and validation of an external presentation-settings document against an https origin allowlist.
- Added a narration queue that keeps exactly one utterance in flight with ordered English-then-Cantonese segments, and a list of field kinds that are never read aloud.
- Added display-name and logo handling, including rejection of vector images and a check of the leading bytes against the declared image type.
- Added a fail-closed conversion registry that returns a named refusal for an unregistered source and target pair.
- Added a documentation parser that produces typed nodes rather than markup, a documentation index with heading outlines and resolved internal links, and documentation search.
- Added changelog parsing and filtering, with commit links produced only from a recorded commit identifier.
- Added an RFC 4226 and RFC 6238 one-time-password utility over Web Cryptography, bound to no account and granting access to nothing, and a dependency-free QR matrix encoder that contacts no external service.
- Added local support tickets whose bodies are redacted before storage or export.
- Added a transfer state machine that cannot reach a complete phase without a measured byte count and that carries `unsigned` as a literal `true`.
- Added the Material 3 token stylesheet with a complete light palette on bare `:root`, a system dark palette guarded against an explicit light choice, and an explicit dark palette, plus the matching token names in TypeScript.
- Added nine `node --test` test files covering the search engine, vocabulary validation, CSV neutralization, append-only history, the RFC 6238 vectors, colour contrast and gamut reporting, schedule precedence, the transfer reducer, and the humour fact invariant.

### Changed

- Declared the new package as a dependency of the documentation site, the desktop application and the local model package, added build and test scripts to the local model and local coding-assistant packages, and regenerated both `package-lock.json` and `apps/site/package-lock.json` so the manifests and lockfiles agree.
- The documentation site references the two internal packages by relative path, because its lockfile is installed on its own with `npm ci --workspaces=false` and a version range cannot resolve an unpublished package in that mode.
- Split the package entry point by consumer, because a single entry could not serve both. The `.` export is now conditional: bundlers continue to take `default` and read `src/index.ts`, exactly as the documentation site and the desktop renderer bundle always have, while Node takes a new `node` condition and reads a compiled `dist/index.js`. The previous entry offered raw TypeScript to everyone, and Node cannot load a `.ts` file — it strips types only when explicitly asked, and not by default until a release newer than the pinned toolchain — so every file Node executed directly that imported this package by name failed on its first import with `ERR_UNKNOWN_FILE_EXTENSION`. That had already been worked around once in the documentation-site build configuration and was, separately, stopping the desktop application build. A consumer that now reaches the compiled entry before it has been built gets `ERR_MODULE_NOT_FOUND` naming the exact missing file, which says what to do; the error it replaces did not.
- Replaced the package's `build` script, which invoked `tsc` and could never have run: TypeScript is not a declared dependency of this repository or of any workspace in it, and no `tsc` binary is installed. The script now runs a committed build that bundles the source with the same transpiler the desktop application already depends on. It transpiles and does not type-check, deliberately, so the release path depends on a compiler that produces an artifact rather than on a checker that produces a verdict; it pins its own working directory so the artifact is byte-identical wherever it is invoked from; and it asserts that a non-empty file was actually written rather than trusting the transpiler's exit code.

### Verification

Run in this lane, with the observed result:

- `tsc -p tsconfig.json` in `packages/surface-kernel`: no diagnostics; a full emit also completed and the generated directory was then removed.
- `node --test --experimental-strip-types test/*.test.ts` in `packages/surface-kernel`: 89 tests, 89 passing, 0 failing.
- `npm install` at the repository root and `npm install --package-lock-only --workspaces=false` in `apps/site`: both completed; `npm ci --prefix . --workspaces=false` in `apps/site` then installed from the regenerated lockfile and linked both workspace packages.
- The QR encoder's format-information and version-information bits were checked against the published tables for error-correction level M, and the non-function module counts for versions 1 to 10 against the published remainder-bit counts; both matched.
- The colour conversions for sRGB red were checked against the published CIE Lab and Oklch values and matched.

Not run in this lane: lint, accessibility checks, screen captures, browser or desktop runtime interaction, a site or desktop build, packaging, installers, and releases. No rendered QR code was scanned by a reader. No performance measurement and no native-speaker review of Cantonese wording were performed.
