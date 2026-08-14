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

## Official sources

- [OpenAI Codex CLI developer command reference](https://developers.openai.com/codex/cli/reference) — `codex exec`, `--cd`, `--sandbox`, `--ask-for-approval`, `--ephemeral`, and stdin prompt transport.
- [OpenCode CLI reference](https://opencode.ai/docs/cli) — `opencode run`, `--agent`, `--dir`, `--pure`, message arguments, and `--version`.
- [OpenCode agent reference](https://opencode.ai/docs/agents) — built-in Build and Plan profiles and their permission posture.
- [OpenCode permission reference](https://opencode.ai/docs/permissions) — ask/allow/deny behavior and the reason automatic approval is omitted.

Sources were retrieved on 2026-08-14. Reconcile the fixed profiles with the current official references before changing their arguments.

## Verification status

Tests, lint, type checks, reviews, runtime launches, captures, builds, and packaging were intentionally not run for this ultra-speed implementation.
