# Material Tax Reporting documentation site

This package contains the public static landing page and documentation site for
Material Tax Reporting. The repository is currently a software foundation: no
application, installer, tax engine, PDF generator, documentation release, or
software release has shipped.

## Product boundary

The planned product may end only with generation of a CRA mail-in PDF package.
It must not implement, offer, advertise, simulate, or imply NETFILE, EFILE,
electronic submission, direct CRA transmission, or automatic filing.

Before any future export or print action, the application must require the user
to inspect every populated form, calculation, attachment, mailing destination,
and signature field, then explicitly acknowledge completing that review. The
site provides product documentation and does not provide tax, legal,
accounting, or financial advice or claim CRA certification.

## Installer availability

There is no installer or verified immutable release asset. The site therefore
contains no installer download link or button. A download action must remain
absent until a real release and its immutable asset have been independently
verified.

## Local visitor preferences

Theme, density, accent color, font scale, motion, tab docking, language,
funny-level, and validated personal-vocabulary preferences are stored only in
the visitor's browser. Search patterns and regex-builder sample text are
evaluated locally and are not persisted. The site does not accept or collect
taxpayer records.

## Local development

Node.js 22.13.0 or newer is required. Install the locked dependencies, then use
the dedicated static-site commands:

```bash
npm ci
npm run pages:dev
```

Create the GitHub Pages build with:

```bash
npm run pages:build
```

The static output is written to `dist/pages`. The build uses the repository
base path `/material-tax-reporting/`, matching the intended GitHub Pages URL.

## Publication status

The repository workflow is configured to build and publish `dist/pages` after
a push to `main` or a manual workflow dispatch. This accelerated change did not
run a build, tests, lint, type checks, accessibility checks, review, capture, or
browser quality assurance. It also did not deploy the site, create a tag, or
create a release. Those states must remain unverified until their respective
commands and publication workflow complete successfully.
