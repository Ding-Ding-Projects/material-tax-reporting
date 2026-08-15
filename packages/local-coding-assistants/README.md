# Local coding-assistant launch contracts

This package provides dependency-free contracts for a future desktop surface that guides a user into a local Codex CLI or OpenCode session. It does not install either tool, authenticate an account, choose a model, submit a tax return, or bypass either tool's permission system.

## What it provides

- Searches explicit Windows installation locations before using PATH as a supplemental lookup, then probes the chosen native executable with `--version`.
- Lists four fixed profiles: Codex read-only, Codex workspace-write, OpenCode Plan, and OpenCode Build. The read-only/Plan choices are recommended defaults, and OpenCode launches with external plugins disabled.
- Builds a bounded, redacted preview from an explicit instruction and selected project or report context.
- Requires source review, exact preview acceptance, and acknowledgement that the locally installed CLI may contact its configured model provider.
- Refuses command wrappers, arbitrary shell text, command concatenation, environment overrides, relative paths, and working directories outside caller-supplied allowlisted roots.
- Launches one validated executable directly with an argument array and `shell: false`.

## Privacy and tax boundary

No source tax document is attached automatically. A user must deliberately select a text excerpt, review its source, inspect the redacted prompt preview, and accept the model-provider network disclosure before launch. Common SIN, email, phone, credential, and caller-supplied sensitive values are redacted, but automated redaction is not a substitute for reviewing the complete preview.

Codex CLI and OpenCode are local clients, but their configured model providers may process prompt content over a network. This package neither asserts nor changes provider retention, privacy, authentication, or model settings.

These tools assist with local preparation work. They never replace taxpayer review, professional advice, or current official instructions. They cannot electronically file, transmit, or automatically submit a return. Any generated mail-in PDF remains blocked on manual inspection of every populated form, calculation, attachment, mailing destination, and signature field, plus explicit acknowledgement.

## Integration outline

1. Implement `ExecutableDiscoveryHost` at the privileged desktop boundary.
2. Call `discoverCodingAssistantExecutables` and render its results as a picker, including version and exact blocker text.
3. Render `CODING_ASSISTANT_PROFILES` as a profile picker and default to the recommended profile for the chosen tool.
4. Build context items from user-selected, already visible local project/report text. Never read or attach files merely because they exist in the selected directory.
5. Call `preflightAssistantLaunch`, display its complete preview, exact preflight list, and blockers, and collect both acknowledgements.
6. Pass only a ready plan, the current approved discovery results, and the current allowed workspace roots to `launchCodingAssistant` through a `DirectLaunchHost` that starts the exact executable with `shell: false`.

## Consuming this package

The package entry is TypeScript source, and it is meant for a bundler. Its only importer today is the
desktop main process, which reaches it through `require()` inside a bundle that esbuild builds, so the
specifier is resolved at build time and Node never loads it.

Node cannot load this entry on its own. It runs a `.ts` file only where type stripping is enabled, and the
toolchain pinned in `dependency-manifest.json` is older than the release that made stripping the default —
so a script Node executes directly would fail on the first import with `ERR_UNKNOWN_FILE_EXTENSION` naming
`src/index.ts`. There is no compiled entry here because nothing currently needs one; a build step nobody
runs is worse than none.

If a future script that Node executes directly needs this package, adding a `node` export condition is a
two-part change that has to land in one commit: a transpile-only build producing `dist/index.js`, **and**
the wiring that runs that build in every consumer resolving the condition — which includes esbuild, whose
`node` platform matches the same condition. Without the second half, the desktop bundle stops resolving
this package on any checkout that has not already built it. The note in `package.json` records the exact
evidence.

Modules under `src/` reference their siblings with real `.ts` extensions, so a Node that does strip types
loads the entry as written.

## Official sources

- [OpenAI Codex CLI developer command reference](https://developers.openai.com/codex/cli/reference) — `codex exec`, `--cd`, `--sandbox`, `--ask-for-approval`, `--ephemeral`, and stdin prompt transport.
- [OpenCode CLI reference](https://opencode.ai/docs/cli) — `opencode run`, `--agent`, `--dir`, `--pure`, message arguments, and `--version`.
- [OpenCode agent reference](https://opencode.ai/docs/agents) — built-in Build and Plan profiles and their permission posture.
- [OpenCode permission reference](https://opencode.ai/docs/permissions) — ask/allow/deny behavior and the reason automatic approval is omitted.

Sources were retrieved on 2026-08-14. Reconcile the fixed profiles with the current official references before changing their arguments.

## Verification status

`node --test --experimental-strip-types test/*.test.ts` was run and observed: 6 tests passed, 0 failed. The
package entry was loaded directly on Node 26.4.0 and exported the expected seven names, and the same import
under `--no-experimental-strip-types` was observed to fail with `ERR_UNKNOWN_FILE_EXTENSION`, which is the
behaviour the section above describes.

Lint, type checks, reviews, real runtime launches of Codex CLI or OpenCode, captures, builds, and packaging
were not run and no claim is made about them. The regression uses an injected launch host; no external
process was started. No Node matching the pinned toolchain version was available on the machine that ran
these checks, so the pinned-runtime behaviour above was reproduced by disabling type stripping rather than
by running that version.
