# Local Ollama suite changelog

## Unreleased

### Added

- Added a portable view-model (`src/view-model.ts`) that describes the whole suite as state plus actions, so the documentation site surface and the desktop surface can each render it inside their own shell.
- Added guided real-data choices: detected harness executables with an explicit `unchecked`, `checking`, `none-detected` or `detected` state and a named recovery action; chat and harness model lists enumerated from the installed models; catalog family, capability and quantization facets derived from the cached snapshot; and a troubleshooter branch for every runtime condition, each with an offline next step and a recheck.
- Added a batch cart that sums the reviewed variants, applies the same temporary-file headroom as the pull queue, compares the total against measured free space, states any shortfall in exact bytes before commit, and enqueues the whole batch in one pass through the new `PersistentPullQueue.enqueueBatch`.
- Added capability-gated chat attachments: attachments now reach the chat manager's existing image-capability gate and decoded byte ceiling, and the rejection message is surfaced on its own state field.
- Added one-click harness snapshot restore, backed by a new `list` method on the snapshot store port and `listExecutables` and `listSnapshots` methods on the harness manager. Restore resolves an identifier against the loaded list and never accepts a caller-supplied payload.
- Added an independent search state for every filterable collection — catalog variants, installed models, the pull queue, the chat history, harness profiles and harness snapshots — so a host can attach one builder per collection.
- Added a `test/` suite of executable negative regressions covering catalog completeness, hardware-fit evidence, commerce vocabulary, harness shell and rollback behaviour, chat attachment capability, guided choices, and batch storage preflight.

### Changed

- Replaced the full-page renderer with the view-model. `mountLocalOllamaSuiteSurface`, every DOM helper, and `src/surface.css` were removed; the package no longer compiles against DOM types.
- Replaced the package's own pattern and flag validation, and the separate regular expression compiled inside `filterCatalogVariants`, with the shared anchored search engine from `@material-tax-reporting/surface-kernel`.
- Runtime probes now report the failing local API check names as a list, so the active troubleshooter branch can display them.
- Narrowed the compiler library set from `ES2022, DOM, DOM.Iterable` to `ES2022, WebWorker`. Document and element types are now compile errors, while the web-standard networking types the loopback client genuinely uses — `fetch`, `Response`, `AbortSignal`, `URL`, `TextDecoder` — remain available.
- Relative imports inside the package now name the TypeScript source, matching the shared kernel, so the package's own test script can run the sources directly.

### Fixed

- Fixed two long-standing type errors that prevented the package from compiling: the running-model listing being passed to a parameter typed for the installed-model listing, and an optional abort signal being handed to `fetch` under `exactOptionalPropertyTypes`.

### Verification

The following were run and their output observed:

- `tsc -p packages/local-ollama/tsconfig.json --noEmit` — no errors.
- `node --test --experimental-strip-types packages/local-ollama/test/*.test.ts` — 37 tests passed, 0 failed.

The following were **not** run and no claim is made about them: lint, application builds, packaging, installers, releases, screenshots, accessibility conformance checks, performance measurement, and any interaction with a real Ollama service. No Ollama server was available, so every test is driven by an injected double; no live runtime, model download or chat response was observed.
