# Local coding-assistant changelog

## Unreleased

### Added

- Added executable discovery and bounded version probing for local Codex CLI and OpenCode installations without relying on PATH alone.
- Added enumerated read-only and workspace-writing profiles with guided recommended defaults.
- Added selected-context prompt construction, sensitive-data redaction, exact preview and provider-network acknowledgements, and fail-closed launch preflight.
- Added direct allowlisted process launch contracts that prohibit arbitrary shell text, command concatenation, unvalidated environment expansion, and unapproved working directories.
- Preserved the no-electronic-filing boundary, mandatory manual mail-in PDF review, and taxpayer-review requirement in every prompt and preflight.

- Added `test/launch-preflight.test.ts`, an executable regression proving the launch-plan assertion refuses a mutated argument list, a replaced sandbox argument, an added environment override, a working directory outside the allowed roots, and an executable missing from the current discovery results — in every case without reaching the process launcher.

### Verification

The following were run and their output observed:

- `node --test --experimental-strip-types packages/local-coding-assistants/test/*.test.ts` — 6 tests passed, 0 failed.

Lint, type checks, reviews, real runtime launches of Codex CLI or OpenCode, captures, builds and packaging were not run and no claim is made about them. The regression uses an injected launch host; no external process was started.
