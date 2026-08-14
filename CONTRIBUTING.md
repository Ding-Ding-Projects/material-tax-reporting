# Contributing

Thank you for helping establish Material Tax Reporting.

## Current stage

The repository contains governance, workspace manifests, bootstrap entry points, and implementation source: a documentation site in `apps/site`, a desktop application in `apps/desktop`, and the `surface-kernel`, `tax-domain`, `cra-pdf`, `slip-parser`, `local-ollama`, and `local-coding-assistants` packages under `packages/`. A workflow that builds and publishes the documentation site is defined at `.github/workflows/pages.yml`.

There is no installer, no release asset, and no download control, and neither application has been packaged, installed, launched, or exercised by a person. Source is not a product: describe what a file contains, not what a user experienced. Do not describe unimplemented work as available, and do not describe unexercised work as verified.

## Filing scope

All contributions must preserve the product boundary:

- The intended endpoint is a CRA mail-in PDF package.
- The project must not implement, offer, advertise, simulate, or imply NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.
- Future export and print actions must remain unavailable until the user manually reviews every populated form, calculation, attachment, mailing destination, and signature field and explicitly acknowledges that review.

## Before contributing

1. Search existing issues and pull requests before proposing overlapping work.
2. Keep changes focused and explain their user or repository impact.
3. Use only synthetic data. Never commit or post real taxpayer information, credentials, government identifiers, or completed tax forms.
4. Cite current official CRA or Ontario sources for future tax requirements. Clearly identify the tax year and effective date.
5. Preserve unrelated work and generated lockfile accuracy.

## Development commands

Workspace-level commands exist. Install dependencies with `npm install` at the repository root, then use:

- `npm run build --workspace @material-tax-reporting/desktop` — bundles the desktop main, preload, and renderer sources into `apps/desktop/dist`.
- `npm run pages:build --workspace @material-tax-reporting/site` — produces the static documentation site, and is the same command the publish workflow runs.
- `npm test --workspace @material-tax-reporting/surface-kernel` — runs the shared kernel's `node --test` suite.
- `npm test --workspace @material-tax-reporting/local-ollama` and `npm test --workspace @material-tax-reporting/local-coding-assistants` — run the two package suites that have one.

There is no repository-wide test, lint, type-check, accessibility, or packaging command, and no automated check runs against `apps/site` or `apps/desktop`. The root scripts stay fail-closed: `download-dependencies.bat` only validates the bootstrap contract, and `build.bat` and `build-installer.bat` intentionally exit nonzero until real repository-wide build and installer routes exist. A nonzero exit from those scripts is the correct result and must not be replaced with a simulated success.

When tooling is introduced, document exact setup, build, verification, and packaging commands in the same change. Report checks that were actually run, quote what they printed, and name what was not run; do not infer results.

## Pull requests

A pull request should:

- state the problem and the bounded change;
- list affected files and any official sources used;
- explain privacy or security implications;
- report the exact verification performed, including anything not run;
- update relevant documentation without making shipped-product claims.

By participating, you agree to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
