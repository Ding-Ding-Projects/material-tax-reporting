# Material Tax Reporting

Material Tax Reporting is a public repository for a Windows desktop application and documentation site focused on preparing Canadian and Ontario annual income tax reports.

> **Project status:** Source implementation in progress. The repository contains a guided Electron desktop application, tax-domain and CRA PDF preparation packages, a local slip parser with bundled offline OCR contracts, a local Ollama suite package and renderer surface, and a documentation site. No desktop installer or production release is verified yet.

## Filing boundary

This project is intended to end at generation of a CRA mail-in PDF package. It must never implement, offer, advertise, simulate, or imply NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.

Before any future export or print action is allowed, the product must require a manual review workflow. The user must inspect every populated form, calculation, attachment, mailing destination, and signature field, then explicitly acknowledge that review. Software output is not a substitute for professional tax advice or current instructions from the Canada Revenue Agency and the Government of Ontario.

## Repository map

- `apps/desktop` — guided Windows Electron application with encrypted single-file projects and app-private append-only Git history.
- `apps/site` — reserved workspace for the future documentation site.
- `packages/tax-domain` — reserved workspace for future tax-domain code.
- `packages/cra-pdf` — reserved workspace for future paper-package generation code.
- `packages/local-coding-assistants` — guided, fail-closed contracts for local Codex CLI and OpenCode assistance.
- `packages/local-ollama` — loopback-only Ollama model store, pull queue, local chat, conservative hardware-fit evidence, allowlisted harness orchestration, and accessible renderer surface.

The repository now includes tax-domain, slip-parser, CRA PDF, guided local coding-assistant, local Ollama, and privileged desktop-shell source. There is no verified installer, production release, sample taxpayer data, demonstration return content, or committed build output. The desktop source has not yet been verified as a built artifact.

The [desktop application documentation](docs/features/desktop/README.md) describes the guided report, encrypted project container, app-private local Git history, and exact unverified build entry outputs.

The [local Ollama suite documentation](docs/features/local-ollama-suite/README.md) describes its loopback-only API boundary, official model-catalog refresh, offline states, reviewed tax-data handling, pull queue, local chat, and allowlisted harnesses. It never provides electronic filing or direct government transmission.

## Development status

The root npm workspace lockfile pins the current application and package dependencies. The desktop workspace declares Electron 43.3.0 and esbuild 0.28.0, while the root bootstrap scripts remain fail-closed until the repository-wide build and installer routes are wired.

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
