# Material Tax Reporting

Material Tax Reporting is a public repository for a Windows desktop application and documentation site focused on preparing Canadian and Ontario annual income tax reports.

> **Project status:** Implementation source, and source only. The repository contains a guided Electron desktop application, a documentation site, a shared surface kernel, tax-domain and CRA PDF preparation packages, a local slip parser with bundled offline OCR contracts, a local Ollama suite, and guided local coding-assistant contracts. There is no installer, no release asset, and no download control, and neither application has been packaged, installed, launched, or exercised by a person. Per-capability status, including exactly what has not been checked, is recorded in [`docs/features/feature-inventory.json`](docs/features/feature-inventory.json).

## Filing boundary

This project is intended to end at generation of a CRA mail-in PDF package. It must never implement, offer, advertise, simulate, or imply NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.

Before any future export or print action is allowed, the product must require a manual review workflow. The user must inspect every populated form, calculation, attachment, mailing destination, and signature field, then explicitly acknowledge that review. Software output is not a substitute for professional tax advice or current instructions from the Canada Revenue Agency and the Government of Ontario.

## Repository map

- `apps/desktop` — guided Windows Electron application with encrypted single-file projects and app-private append-only local history.
- `apps/site` — documentation and landing site; its build command produces a static bundle, and a workflow that publishes one is defined at `.github/workflows/pages.yml`.
- `packages/surface-kernel` — framework-neutral engines shared by both surfaces: search, preferences, language, vocabulary, commands, notifications, history, exports, appearance, colour, locks, tabs, scheduling, narration, identity, conversion, documentation indexing, changelog parsing, one-time passwords, QR encoding, support notes, transfer states, and the Material 3 tokens.
- `packages/tax-domain` — tax-domain model, rules, calculation, validation, and serialization source.
- `packages/cra-pdf` — paper-package preparation source: form catalogue, field mapping, review model, validation, and the generation engine.
- `packages/slip-parser` — local slip admission, classification, extraction, official mappings, and bundled offline OCR contracts.
- `packages/local-coding-assistants` — guided, fail-closed contracts for local Codex CLI and OpenCode assistance.
- `packages/local-ollama` — loopback-only Ollama model store, pull queue, local chat, conservative hardware-fit evidence, and allowlisted harness orchestration, expressed as a portable view model that renders nothing itself.

Everything listed above is source in this repository. Nothing here establishes that either application was built for distribution, packaged, installed, launched, or exercised by a person. There is no verified installer, production release, download control, sample taxpayer data, demonstration return content, or committed build output.

## Documentation

- [Feature documentation index](docs/features/README.md) — how to read the feature tree, what each verification state means, and the wording contract every public string in this repository must satisfy.
- [Feature inventory](docs/features/feature-inventory.json) — one row per capability, naming its implementation files, its article, its verification state, and its explicit evidence gaps.
- [Website documentation](docs/site/README.md) — the public product boundary, privacy model, preferences, installer position, and verification status.
- [Desktop application documentation](docs/features/desktop/README.md) — the guided report, encrypted project container, app-private local history, and the exact, unverified outputs of the build entry point.
- [Shared surface kernel documentation](docs/features/shared-surface-kernel/README.md) — the engines both surfaces import, and the invariants they hold.
- [Local Ollama suite documentation](docs/features/local-ollama-suite/README.md) — its loopback-only API boundary, official model-catalogue refresh, offline states, reviewed tax-data handling, pull queue, local chat, and allowlisted harnesses. It never provides electronic filing or direct government transmission.

## Development status

Install dependencies with `npm install` at the repository root. The workspace commands that exist are:

- `npm run build --workspace @material-tax-reporting/desktop` — bundles the desktop sources into `apps/desktop/dist`.
- `npm run pages:build --workspace @material-tax-reporting/site` — produces the static site, and is the command `.github/workflows/pages.yml` runs.
- `npm test --workspace @material-tax-reporting/surface-kernel` — runs the shared kernel's test suite.

There is no repository-wide test, lint, type-check, accessibility, or packaging command. The root npm workspace lockfile pins the current application and package dependencies. The desktop workspace declares Electron 43.3.0 and esbuild 0.28.0, while the root bootstrap scripts remain fail-closed until the repository-wide build and installer routes are wired.

- `download-dependencies.bat` remains the repository dependency bootstrap entry point; its repository-wide dependency implementation is still incomplete.
- `build.bat` exits with a nonzero status because it is not yet wired to the app-owned desktop build command.
- `build-installer.bat` exits with a nonzero status because no installer configuration or package script exists yet.

All three scripts accept `/s` and `--silent`; `SILENT=1` is also recognized. Silent mode suppresses prompts, but it does not turn an unavailable build into a successful one.

<details>
<summary>Governance and contributions</summary>

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [LICENSE](LICENSE). Contributions must preserve the paper-only filing boundary and must not include real taxpayer information.

</details>

## License

This repository is licensed under the MIT License. See [LICENSE](LICENSE).
