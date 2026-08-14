# Repository documentation changelog

This changelog covers the repository's own status statements, its feature inventory, and the website documentation set under `docs/site/`. Per-surface changes are recorded in the changelog for the surface that owns them.

## Unreleased

### Added

- Added `docs/features/feature-inventory.json`, the repository's hand-written feature-completeness record: one row per capability per surface, naming its implementation files, its documentation article, its changelog, its tests, the interaction a person would have to perform to exercise it, its capture evidence, its relation to the paper-only product boundary, and its explicit evidence gaps.
- Added the inventory's evidence policy, which states that a row may claim runtime or capture evidence only after a real built surface was exercised, and that reading source never upgrades a pending row.
- Added `docs/features/README.md` as the index for the feature tree: how to read the inventory, what each state value means, which subtree owns which surface, and the rule that an article describes shipped behaviour only, with anything unbuilt confined to a clearly labelled "Not yet available" heading rather than written in the present tense.
- Added the public wording contract to `docs/features/README.md`. It states, once and for the whole repository, the ten rules every user-visible string already had to satisfy: ordinary professional English, the permanent filing boundary, no unearned verification claim, no fabricated tax content, visible separation of intent from shipped behaviour, sourced tax statements, no premature download, one product name, bilingual copy that agrees on facts, and synchronized manifests and lockfiles.
- Added a website feature inventory table to `docs/site/README.md` with one row per capability the website's source implements, each carrying the state the machine-readable inventory holds and pointing at the article that owns it.
- Added a "What was verified" section to `docs/site/verification-status.md` naming the four checks that were actually run and their observed results.
- Added a local-wording privacy bullet to `docs/site/local-first-privacy.md` stating that a personal vocabulary, display name, or mark stays in the visitor's own browser and can never rewrite a legal, boundary, or disclosure sentence.
- Added pointers from `docs/site/installer-and-releases.md` to the website and desktop transfer-surface articles, recording that the release manifest carries no assets and that the site therefore renders its unavailable state.

### Changed

- Corrected the "Project state" section of `AGENTS.md`, which said there is no shipped application, installer, tax engine, PDF generator, documentation site, test suite, or release workflow. It now records that implementation source exists for the documentation site, the desktop application, and the `surface-kernel`, `tax-domain`, `cra-pdf`, `slip-parser`, `local-ollama`, and `local-coding-assistants` packages, that a workflow which builds and publishes the documentation site is defined at `.github/workflows/pages.yml`, and that no installer, release asset, download control, or verified build exists. Every other rule in that file is unchanged.
- Corrected the "Current stage" section of `CONTRIBUTING.md`, which said the repository contains only governance, workspace manifests, and bootstrap entry points.
- Corrected the "Development commands" section of `CONTRIBUTING.md`, which said there is no runnable build or test suite. It now names the workspace commands that exist and states that there is no repository-wide test, lint, type-check, accessibility, or packaging command. The fail-closed statement about `build.bat` and `build-installer.bat` is kept, and a nonzero exit from them remains the correct result.
- Corrected the repository map in `README.md`, which called `apps/site`, `packages/tax-domain`, and `packages/cra-pdf` reserved workspaces and omitted `packages/slip-parser` and `packages/surface-kernel` entirely. Each row now describes the source the directory actually contains.
- Resolved the contradiction that followed that map, which stated both that the repository includes the packages' source and that they were reserved. The paragraph now states plainly that everything listed is source, and that nothing in the repository establishes that either application was built for distribution, packaged, installed, launched, or exercised by a person.
- Replaced the project-status note in `README.md` and added a documentation index and a development-status section naming the workspace commands.
- Corrected the opening statement of `docs/site/verification-status.md`, which described the change as the initial public website documentation change, and rewrote "what was not run" and "what is not yet verified" to match the current state: implementation source exists, while browser behaviour, accessibility conformance, responsive layout, packaging, and deployment remain unverified.
- Expanded `docs/site/website-preferences-and-search.md`. Its single clause about an anchored regular-expression builder beside the search field is now a pointer to the articles that own the engine and its bindings, and its vague line about "presentation choices such as theme and navigation state" now names the real preference record and the stores that sit beside it.

### Verification

Verification for this change: the four results below were observed by the lanes that produced them, and the inventory was parsed and its paths checked; no application was launched and no capture was taken.

- The shared surface-kernel package compiled with no diagnostics and its 89 tests passed.
- The local model package compiled with no diagnostics and its 37 tests passed, along with the 6 tests of the local coding-assistant package.
- The website's production build completed and emitted its static bundle.
- The desktop application's build completed and all of its generated bundles parsed.
- `docs/features/feature-inventory.json` was parsed, and every one of the 299 repository-relative paths across its 49 rows was confirmed to exist; the parse also confirmed that no row is duplicated for a surface, that every state is one of the three allowed values, and that no row claims capture evidence.
- Not run for this change: any launch of the website or the desktop application, any screenshot, recording, or other capture, any lint check, any type check beyond the packages' own compilation, any accessibility check, any browser-based or desktop-based user-interface quality assurance, any packaging, installer, tag, or release step, and any performance measurement or native-speaker review.
