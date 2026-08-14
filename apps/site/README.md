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

## Release availability

`app/data/releases.json` is the single source of truth for the transfer
surfaces, and it ships with an empty asset list. The site therefore renders its
unavailable state, and the counts shown on the home surface are derived from
that file rather than written into a component. A transfer control appears only
after a verified asset is recorded there.

## Local visitor preferences

Theme, density, accent colour, font scale, motion, tab docking, language,
humour levels, the decorative dialog emoji, the display name and mark, the
read-aloud settings, the tab strip, appearance overrides, element locks,
schedule rules, support notes, notifications, and the validated personal
vocabulary are stored only in the visitor's browser, under the versioned keys
the shared surface kernel declares. Local history is kept in the browser's
indexed database. Search patterns and builder sample text are evaluated locally
and are not persisted. The site does not accept or collect taxpayer records.

## Architecture

Every engine comes from `@material-tax-reporting/surface-kernel`; this package
contributes React bindings and CSS only. The local model runtime surface renders
the view model published by `@material-tax-reporting/local-ollama`.

- `app/data/copy.ts` holds every user-facing string, five humour levels per
  language.
- `app/data/docs.ts` and `app/data/changelog.ts` are generated at build time
  from the tracked Markdown by `build/sites-vite-plugin.ts`. They are committed
  so a checkout is buildable and reviewable, and rewritten on every build so
  neither view can drift from the repository.
- `app/search-builder.tsx` is the only module that renders a search field, so a
  field cannot exist without its anchored builder.

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

## Source checks

Three checks run without a browser and print their result:

```bash
node --experimental-strip-types src/checks/copy-facts.check.ts
node --experimental-strip-types src/checks/search-builders.check.ts
node --experimental-strip-types src/checks/command-coverage.check.ts
```

They assert, in order, that humour never changes a fact and that no built-in
vocabulary ships; that every search field comes from the builder module and no
field identifier is duplicated; and that the command palette can reach every
preference key.

A fourth check renders the whole shell once on the server and reports what the
markup actually contains. It is not a browser check and makes no claim about how
the site looks or behaves:

```bash
npx vite build --config src/checks/render-smoke.config.ts
node dist/render-smoke/render-smoke.entry.js
```

## Publication status

The repository workflow is configured to build and publish `dist/pages` after a
push to `main` or a manual workflow dispatch. The change that added the feature
set ran `npm run pages:build`, the three source checks above and the render
smoke check, and observed their real output. It did not run tests, lint checks, type checks, accessibility
checks, reviews, screenshots or other captures, or browser-based user-interface
quality assurance. It did not deploy the site, create a tag, or create a
release. Those states remain unverified until their respective commands and the
publication workflow complete successfully.
