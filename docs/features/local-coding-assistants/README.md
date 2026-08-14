# Guided local coding assistants

The local coding-assistant contract gives the future desktop application a guided route to an installed Codex CLI or OpenCode executable. It is an assistance surface for project work, not an autonomous filing feature.

## Guided flow

1. Discover installed native executables from explicit local installation locations, with PATH used only as a supplemental lookup.
2. Show the exact executable path, detected version, installation source, and any launch blocker.
3. Choose one of the enumerated profiles. Codex read-only and OpenCode Plan are the recommended defaults; workspace-writing profiles remain explicit choices.
4. Choose an allowlisted project directory through a directory picker.
5. Enter the specific assistance request and select only the local project or report context needed for it.
6. Review the selected source, the complete redacted prompt, detected redaction counts, model-provider network notice, access level, executable, version, arguments, and working directory.
7. Explicitly accept the prompt preview and provider network disclosure before launch.

No free-form executable, shell command, concatenated command, environment override, relative working directory, or unreviewed attachment is accepted. The final process call is direct, uses a fixed argument array, and sets `shell: false`. OpenCode runs with its documented `--pure` global flag so external plugins are not loaded for this handoff.

## Context and privacy

The surface never sweeps a project directory or tax-report folder for context. Each item is selected independently from content already visible to the user. Tax documents are not attached automatically. A tax-document excerpt is eligible only after explicit selection and source review.

The preview redacts common SIN, email, phone, credential, and caller-identified sensitive values. The user must still review the whole preview because pattern-based redaction cannot identify every private fact.

The executables run locally, but the selected tool may send the reviewed prompt to its configured model provider. The surface must state that boundary and cannot claim offline processing unless the selected tool and provider configuration independently prove it.

## Failure modes

- **No executable found:** show the searched locations and keep launch disabled.
- **Only a command wrapper found:** explain that shell-backed wrappers are refused; the launch contract requires a native executable.
- **Version probe failed or timed out:** report the bounded `--version` probe failure and keep launch disabled.
- **Directory outside allowed roots:** retain the chosen value for correction but do not launch.
- **Unreviewed context or preview:** identify the incomplete acknowledgement directly beside the launch control.
- **Tool exits nonzero:** report its exit code and bounded output without claiming that assistance completed.

## Tax and filing boundary

Codex CLI and OpenCode assist with local preparation work and never replace taxpayer review, professional advice, or current official instructions. They do not create authority to electronically file, transmit, or automatically submit a return. The application remains limited to a CRA mail-in PDF package. Every populated form, calculation, attachment, mailing destination, and signature field still requires manual review and explicit acknowledgement before export or print.

## Official sources

- [OpenAI Codex CLI developer command reference](https://developers.openai.com/codex/cli/reference)
- [OpenCode CLI reference](https://opencode.ai/docs/cli)
- [OpenCode agent reference](https://opencode.ai/docs/agents)
- [OpenCode permission reference](https://opencode.ai/docs/permissions)

Retrieved on 2026-08-14.

## Verification status

Tests, lint, type checks, reviews, runtime launches, captures, builds, and packaging were intentionally not run for this ultra-speed implementation.
