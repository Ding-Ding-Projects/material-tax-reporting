# Local coding-assistant changelog

## Unreleased

### Added

- Added executable discovery and bounded version probing for local Codex CLI and OpenCode installations without relying on PATH alone.
- Added enumerated read-only and workspace-writing profiles with guided recommended defaults.
- Added selected-context prompt construction, sensitive-data redaction, exact preview and provider-network acknowledgements, and fail-closed launch preflight.
- Added direct allowlisted process launch contracts that prohibit arbitrary shell text, command concatenation, unvalidated environment expansion, and unapproved working directories.
- Preserved the no-electronic-filing boundary, mandatory manual mail-in PDF review, and taxpayer-review requirement in every prompt and preflight.

- Added `test/launch-preflight.test.ts`, an executable regression proving the launch-plan assertion refuses a mutated argument list, a replaced sandbox argument, an added environment override, a working directory outside the allowed roots, and an executable missing from the current discovery results — in every case without reaching the process launcher.

### Fixed

- Fixed the package entry so a Node runtime that strips types can load it. Every module under `src/` referenced its siblings with a compiled `.js` extension for files that only ever existed as `.ts`, so importing the entry failed with `ERR_MODULE_NOT_FOUND` naming `src/types.js` even on a runtime new enough to run TypeScript. Only a bundler, or the test's own resolver shim, ever made those specifiers resolve. The specifiers now name the real `.ts` files, matching `packages/surface-kernel`.
- Removed `test/typescript-source-resolver.ts` and its use in the regression. It existed solely to rewrite those `.js` specifiers, and a shim whose stated reason has stopped being true is worse than no shim.
- Aligned `tsconfig.json` with the source by enabling `allowImportingTsExtensions` and `rewriteRelativeImportExtensions`, as `packages/surface-kernel` already does. No compiler is installed in this repository and nothing invokes this configuration, so this keeps a dormant file honest rather than changing any build.

### Documentation

- Recorded, in `package.json` and in the package README, why this package deliberately has no compiled entry and no `node` export condition: nothing that Node executes directly imports it by name, so a build step would be one nobody runs. Both notes name the exact failure a future direct import would hit, and state that adding a `node` condition is a two-part change — a transpile-only build plus the wiring that runs it in every consumer resolving that condition, including the bundler.

### Verification

The following were run and their output observed:

- `node --test --experimental-strip-types packages/local-coding-assistants/test/*.test.ts` — 6 tests passed, 0 failed, both before and after these changes.
- Importing `packages/local-coding-assistants/src/index.ts` directly on Node 26.4.0 — before: failed with `ERR_MODULE_NOT_FOUND` naming `src/types.js`; after: resolved and exported the expected seven names.
- The same import under `--no-experimental-strip-types`, which stands in for the pinned toolchain — failed with `ERR_UNKNOWN_FILE_EXTENSION` naming `src/index.ts`, before and after. That is the residual behaviour the new notes describe, and it is why nothing Node executes directly may import this package by name until a compiled entry exists.
- A bundler probe outside the repository, against a package shaped like this one carrying a `node` export condition: with a `dist` directory present the `node`-platform bundle inlined `dist/index.js` rather than the TypeScript source, and with `dist` removed the bundle failed to resolve the package at all. This is the evidence behind the two-part warning in the notes.

Lint, type checks, reviews, real runtime launches of Codex CLI or OpenCode, captures, builds and packaging were not run and no claim is made about them. The regression uses an injected launch host; no external process was started. No Node matching the pinned toolchain version was installed on the machine that ran these checks, so its behaviour was reproduced by disabling type stripping rather than by running that version; and the bundler probe used a different patch version of the bundler than the one this repository pins.
