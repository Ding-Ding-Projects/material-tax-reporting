# Material Tax Reporting

Material Tax Reporting is a public repository foundation for a future Windows desktop application and documentation site focused on preparing Canadian and Ontario annual income tax reports.

> **Project status:** Foundation only. This repository does not currently ship an application, installer, tax engine, PDF generator, documentation site, or release. It contains governance files, an empty npm workspace layout, and honest bootstrap entry points for future development.

## Filing boundary

This project is intended to end at generation of a CRA mail-in PDF package. It must never implement, offer, advertise, simulate, or imply NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.

Before any future export or print action is allowed, the product must require a manual review workflow. The user must inspect every populated form, calculation, attachment, mailing destination, and signature field, then explicitly acknowledge that review. Software output is not a substitute for professional tax advice or current instructions from the Canada Revenue Agency and the Government of Ontario.

## Repository map

- `apps/desktop` — reserved workspace for the future Windows desktop application.
- `apps/site` — reserved workspace for the future documentation site.
- `packages/tax-domain` — reserved workspace for future tax-domain code.
- `packages/cra-pdf` — reserved workspace for future paper-package generation code.
- `packages/local-coding-assistants` — guided, fail-closed contracts for local Codex CLI and OpenCode assistance.

The repository now includes tax-domain, slip-parser, CRA PDF, and guided local coding-assistant contracts. It contains no sample taxpayer data, demonstration return content, or build output.

## Development status

The root package is a dependency-free npm workspace skeleton. No Node.js version, package dependency, binary dependency, compiler, or packaging tool has been selected or pinned yet.

- `download-dependencies.bat` validates that the dependency manifest, package manifests, and lockfile remain dependency-free. It downloads nothing.
- `build.bat` exits with a nonzero status because no runnable application or build script exists yet.
- `build-installer.bat` exits with a nonzero status because no installer configuration or package script exists yet.

All three scripts accept `/s` and `--silent`; `SILENT=1` is also recognized. Silent mode suppresses prompts, but it does not turn an unavailable build into a successful one.

<details>
<summary>Governance and contributions</summary>

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [LICENSE](LICENSE). Contributions must preserve the paper-only filing boundary and must not include real taxpayer information.

</details>

## License

This repository is licensed under the MIT License. See [LICENSE](LICENSE).
