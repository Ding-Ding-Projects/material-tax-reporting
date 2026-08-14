# Contributing

Thank you for helping establish Material Tax Reporting.

## Current stage

The repository currently contains only governance, workspace manifests, and bootstrap entry points. It does not yet contain an application, installer, tax engine, PDF generator, documentation site, tests, or release automation. Do not describe unimplemented work as available or verified.

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

There is currently no runnable build or test suite. `download-dependencies.bat` only validates that the foundation remains dependency-free. `build.bat` and `build-installer.bat` intentionally exit nonzero until real build and installer scripts are added.

When tooling is introduced, document exact setup, build, verification, and packaging commands in the same change. Report checks that were actually run; do not infer results.

## Pull requests

A pull request should:

- state the problem and the bounded change;
- list affected files and any official sources used;
- explain privacy or security implications;
- report the exact verification performed, including anything not run;
- update relevant documentation without making shipped-product claims.

By participating, you agree to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
