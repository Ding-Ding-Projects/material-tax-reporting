# Test suite inventory

A hand-written record of every automated test suite in this repository: where it lives, the exact
command that runs it, what it covers, and what evidence it provides. It is written and reviewed like
any other source file. Nothing generates it, and no build step updates it.

It exists because a rule-shaped guard only ever checks the surfaces it has already found. A workspace
with no tests at all satisfies "every suite must pass" perfectly, by having nothing that can fail. The
table below therefore names every workspace, including the ones with no suite, so an absence is a
visible row rather than a silent gap.

> **Nothing here gates a release.** No workflow runs any of these suites, and no check withholds a
> build or a publication on their verdict. That is a standing decision for this repository: the
> pipeline builds, packages and publishes, and checking happens locally, before a push, by whoever
> made the change. A failing suite is still a defect to fix in the same task — it is simply not a gate.
> The cost is stated plainly: a release can ship from a commit whose tests would have failed, and the
> first thing to notice will be a person running it.

## Running them

Every suite uses Node's built-in test runner. No test framework is installed, and none should be.

```
npm ci                                   # once, at the repository root
npm test --workspace <workspace-name>    # one workspace
```

`npm ci` at the root is a genuine prerequisite for two of the suites rather than a formality. It
installs the workspace links and runs the `prepare` hook that compiles `packages/surface-kernel` to
`dist/`, which `apps/desktop` and `apps/site` both load through Node's `node` export condition. Without
that build, those two suites fail at their first import with `ERR_MODULE_NOT_FOUND`.

## Every workspace

| Workspace | Suite | Tests | Command |
| --- | --- | ---: | --- |
| `packages/tax-domain` | 5 files | 88 | `npm test --workspace @material-tax-reporting/tax-domain` |
| `packages/cra-pdf` | 3 files | 68 | `npm test --workspace @material-tax-reporting/cra-pdf` |
| `packages/slip-parser` | 3 files | 67 | `npm test --workspace @material-tax-reporting/slip-parser` |
| `packages/surface-kernel` | 9 files | 89 | `npm test --workspace @material-tax-reporting/surface-kernel` |
| `packages/local-ollama` | 7 files | 37 | `npm test --workspace @material-tax-reporting/local-ollama` |
| `packages/local-coding-assistants` | 1 file | 6 | `npm test --workspace @material-tax-reporting/local-coding-assistants` |
| `apps/desktop` | 2 files | 44 | `npm test --workspace @material-tax-reporting/desktop` |
| `apps/site` | 1 file | 31 | `npm test --workspace @material-tax-reporting/site` |
| repository root | **none, and none intended** | — | the root is the workspace container and holds no source |

**430 tests across eight workspaces**, all passing as recorded here.

## What each suite covers

### `packages/tax-domain` — 88 tests

The highest-value suite in the repository, because this is the code that computes real Canadian and
Ontario tax.

| File | Tests | Scope |
| --- | ---: | --- |
| `rules-2025-match-research.test.ts` | 20 | Every 2025 constant against the committed research |
| `federal-and-ontario-tax.test.ts` | 16 | The calculation against an independent reference model |
| `validation.test.ts` | 20 | Refusals, review severities, the product boundary |
| `serialization.test.ts` | 16 | Import bounds and export redaction |
| `return-aggregation.test.ts` | 16 | Slips and deductions becoming return lines |

**Evidence it provides.** `rules-2025-match-research.test.ts` reads
`research/rates-calculation/federal-2025.parameters.json` and `ontario-2025.parameters.json` off disk
on every run and asserts every bracket bound, rate and base tax, the basic-personal-amount phase-out,
the top-up credit, the Canada employment amount, the medical threshold, the Ontario basic personal
amount, both surtax components, the tax-reduction amounts and all eleven health-premium bands against
them. Because the research is read rather than copied, editing either side alone turns the suite red.

`federal-and-ontario-tax.test.ts` rebuilds the official calculation from those same parameters as a
second, independent model and compares it against the package at every bracket edge and the cent
either side. Rounding follows the convention both parameter files state in identical words, using
exact integer rationals recovered from each printed decimal.

**What it does not cover.** Charitable-donation credit rates are not verified, because the committed
research does not transcribe them: it records the Schedule 9 and ON428 line 58969 dependency and
leaves the calculation with those forms. Four of the five rates in `donationRates` are asserted only
to reuse rates the research states elsewhere; the 29% federal remainder band is recorded as having no
committed backing rather than asserted as correct. **Do not treat that rate as verified.** Also
uncovered: dividend gross-up and credit percentages, CPP and EI schedule mechanics, alternative
minimum tax, the Canada workers benefit, the LIFT and CARE credits, and every refundable Ontario
credit — all of which the package takes as caller-supplied inputs rather than computing.

### `packages/cra-pdf` — 68 tests

| File | Tests | Scope |
| --- | ---: | --- |
| `catalog-and-mapping.test.ts` | 22 | The 2025 form catalogue and fill-plan generation |
| `review-and-package.test.ts` | 27 | Assembly, manual review, and the export gate |
| `validation-and-eligibility.test.ts` | 19 | Case-file validation and blocking situations |

**Evidence it provides.** The catalogue is checked as a set — nineteen documents, unique form numbers,
two always-included forms, seventeen conditional forms on seventeen distinct flags — and every
template URL is asserted as a derivation of its own form number, which is what makes a one-character
typo in an official link visible before a download fails.

The engine is driven end to end against a recording fake adapter through plan, fill, merge, review,
acknowledge, authorize and export, with assertions reading what the adapter was asked to do rather
than what the engine reported. Preparation is proven to refuse a blocked case before touching a
template, and export to stay shut until every review item is confirmed and the exact acknowledgement
sentence is given.

**What it does not cover.** No real PDF bytes are produced or parsed anywhere; the package delegates
all of that across the adapter boundary and the suite supplies a fake. The `official-print-overlay`
output mode is unreachable through the public API because no catalogue entry selects it, so its branch
is untested. `mapping/2025.ts` contains no physical PDF field names at all — those come from a
host-supplied profile at runtime — so nothing here verifies that a semantic field lands on the right
widget of a real form.

### `packages/slip-parser` — 67 tests

| File | Tests | Scope |
| --- | ---: | --- |
| `admission.test.ts` | 19 | Byte bounds, signatures, refusals, and the digest |
| `classification-and-extraction.test.ts` | 25 | Slip recognition and box-value extraction |
| `mappings-and-confirmation.test.ts` | 23 | The official mapping table and manual confirmation |

**Evidence it provides.** Admission is the code that meets a file the product did not write, so it
carries the most tests: byte bounds, header versions, missing end markers, object and page limits,
image dimension and pixel bounds against a decompression bomb, and the whole-document refusal of an
encrypted file with its promise that no partial data comes back. The hand-rolled SHA-256 is checked
against the published test vectors, because an implementation that is subtly wrong still produces
confident, stable, useless hex that nothing else would notice.

**What it does not cover.** These suites deliberately import the pure modules directly rather than the
package index, because the index re-exports the offline OCR surface and loads a native canvas addon
plus the whole PDF and OCR stack at module-evaluation time. Consequently **`parser.ts`,
`offline-ocr.ts`, `builtin-pdf-text-layer.ts` and `adapters.ts` end-to-end are not covered**: no test
runs a real document through a real adapter, no OCR path is exercised, and `image/tiff` — which
admission accepts but no bundled adapter supports — is never followed to its dead end. That is the
largest untested area in the repository and the obvious next piece of work.

### `apps/desktop` — 44 tests

| File | Tests | Scope |
| --- | ---: | --- |
| `pdf-text.test.js` | 22 | The dependency-free document text extractor |
| `transfer-progress.test.js` | 22 | The local transfer coordinator and its states |

**Evidence it provides.** `pdf-text.js` is tested with hand-built byte strings against every refusal it
can emit, each asserted by its own sentence, plus real `FlateDecode` inflation through Node's `zlib`.
The distinction the tests protect is between "this page has no text" and "this page has text we could
not decode", which need different answers from the surrounding application. `transfer-progress.js` is
tested through its recorded broadcasts: progress cannot run backwards, cannot exceed a published size,
and a transfer cannot reach `complete` without measured bytes.

**What it does not cover.** Only two of the seventeen main-process modules are tested. The other
fifteen — `main.js`, `project-bundle.js`, `history-store.js`, `preferences-store.js`, `converter.js`,
`element-locks.js`, `totp.js`, `key-vault.js`, `ollama-bridge.js`, `support-tickets.js`,
`notification-log.js`, `settings-schedule.js`, `docs-library.js`, `changelog-library.js` and
`editor-handoff.js` — have no tests. Several require `electron` at module level, directly or through
`key-vault`, and cannot load in a plain Node process without a stub; `history-store.js` additionally
shells out to a real `git` binary and deserves a genuine temporary-directory integration test rather
than a mocked one. **No renderer code, no preload bridge, and no built artifact is exercised anywhere.**

### `apps/site` — 31 tests

| File | Tests | Scope |
| --- | ---: | --- |
| `tabs-and-copy.test.ts` | 31 | The tab-strip validator, converter registry, and site copy |

**Evidence it provides.** The persisted tab strip reads a record written by a previous visit, possibly
by a different version of the site or by somebody editing browser storage, so its validator is tested
against unreadable input, unknown identifiers, a missing home tab, a forged `closable` flag, an
invented group, and an unbounded stored group name. The product boundary is asserted on the shipped
copy constants, including that official citation wording and addresses are in the immutable-span list
a personal vocabulary file may never rewrite.

**What it does not cover.** Everything with a user interface. All twenty-one `.tsx` components need a
DOM and are untested, which is most of the site. So are `scheduling.ts`, `notifications.ts`,
`history.ts`, `narration.ts`, `exports.ts` and `storage.ts`, whose pure functions sit beside React
hooks or browser APIs at module level. The `src/checks/` scripts are runnable assertion files wired to
no npm script; they are not part of any suite. **No page is rendered and no built site is loaded.**

### Pre-existing suites

`packages/surface-kernel` (89), `packages/local-ollama` (37) and `packages/local-coding-assistants` (6)
were already present and are unchanged by this inventory. They cover the shared engines — TOTP against
the RFC 6238 vectors, scheduling precedence, colour contrast, CSV export, append-only history, the
regex builder, download states, vocabulary and language invariants — the local model suite's catalogue
completeness, hardware-fit evidence, pull-queue preflight, chat attachment capability, harness shell
refusal and payment-semantics guard, and the coding-assistant launch preflight.

## Defects and gaps these suites found

Each is pinned by a test that records the present behaviour exactly and turns red if it changes. None
was silently worked around, and none was fixed by editing product code.

| Where | What | Pinned by |
| --- | --- | --- |
| `packages/tax-domain/src/calculate.ts` | At the federal $114,750.00 bracket edge, one more cent of taxable income yields **one cent less federal tax**, and it reaches `totalPayable`. The printed base-tax constants come from an unrounded official chain while the implementation rounds each multiplication to the cent. | `federal-and-ontario-tax.test.ts` |
| `packages/tax-domain/src/rules.ts` | The charitable-donation credit rates have no backing in the committed research. The 29% federal remainder band is unverified. | `rules-2025-match-research.test.ts` |
| `packages/cra-pdf/src/review.ts` | `assertPrintAuthorization` never inspects the review state or the `prohibits` list, so a hand-assembled authorization literal walks past the entire manual-review chain and exports. | `review-and-package.test.ts` |
| `packages/slip-parser/src/classification.ts` | The bare-year pattern consumes its own trailing separator, so two years printed in one recognised token read as one. | `classification-and-extraction.test.ts` |
| `packages/slip-parser/src/official-mappings.ts` | Two T3 formula mappings subtract boxes 30 and 31, which the table never defines. | `mappings-and-confirmation.test.ts` |

The rounding seam and the authorization gap are the two worth a decision rather than a patch: the
first is a rounding-convention choice that both parameter files flag for manual review at exactly
these fractional-cent boundaries, and the second is a design question about how an authorization
proves where it came from.

## How these suites were verified

Every suite was watched failing before it was trusted. A guard nobody has seen go red is decoration,
and this repository has the discipline written down precisely because a test that cannot fail is
worse than no test — it makes coverage look real.

For each workspace, defects were injected into product code one at a time, the suite was run and
confirmed red on the expected test, and the source was restored from a backup and confirmed byte-clean
against `git diff` before the suite was run again and confirmed green.

| Workspace | Defects injected and caught |
| --- | --- |
| `packages/tax-domain` | A corrupted bracket rate, a wrong Ontario personal amount, a shifted health-premium band floor, a removed employment-amount cap, a dropped surtax component, a removed export redaction |
| `packages/cra-pdf` | A corrupted form number, a disabled acknowledgement check |
| `packages/slip-parser` | A corrupted SHA-256 round constant, a disabled encryption refusal, a removed checklist key |
| `apps/desktop` | A reworded encryption refusal, removed length bounds on broadcast strings |
| `apps/site` | A disabled home-tab restoration, a filing route dropped from the boundary sentence |

One injection attempt in `apps/desktop` was caught doing the wrong thing: removing a single
`.slice(0, 240)` did not turn the bound test red, because the file has three and the first one is not
the one that test guards. Removing all three did. That is recorded because it is exactly the kind of
half-verified guard this process exists to catch.

## Related

- [Feature documentation index](README.md)
- [Tax domain](tax/README.md) · [Paper package](pdf/README.md) · [Slip parser](slip-parser/README.md)
- [Desktop application](desktop/README.md) · [Website](site/README.md)
