# Feature documentation

This directory is the repository's feature record. Every capability that exists in source has an article here describing what it does, how it is configured, how it fails, what it keeps, and what has not been verified about it. Alongside the articles, `feature-inventory.json` holds the same picture in machine-readable form, one row per capability per surface.

Nothing in this directory is a release announcement. The repository contains source. It contains no installer, no release asset, and no download control, and no article here may be read as evidence that an application was built for distribution, packaged, installed, launched, or exercised by a person.

## Which subtree owns which surface

| Directory | Surface it documents | Implementation it describes |
| --- | --- | --- |
| [`site/`](site/README.md) | The public documentation and landing website | `apps/site/` |
| [`desktop/`](desktop/README.md) | The Windows desktop application | `apps/desktop/` |
| [`shared-surface-kernel/`](shared-surface-kernel/README.md) | The engines both surfaces import | `packages/surface-kernel/` |
| [`local-ollama-suite/`](local-ollama-suite/README.md) | The loopback-only local model suite | `packages/local-ollama/` |
| [`local-coding-assistants/`](local-coding-assistants/README.md) | Guided, fail-closed local coding-assistant contracts | `packages/local-coding-assistants/` |
| [`tax/`](tax/README.md) | The tax-domain model, rules, and boundaries | `packages/tax-domain/` |
| [`pdf/`](pdf/README.md) | Paper-package preparation and mandatory manual review | `packages/cra-pdf/` |
| [`slip-parser/`](slip-parser/README.md) | Local slip admission, classification, and extraction | `packages/slip-parser/` |

A change edits the subtree that owns the surface it changed. This index, the inventory, and the website documentation under [`docs/site/`](../site/README.md) are the only files that describe the repository as a whole.

## How to read the inventory

`feature-inventory.json` is hand-written and reviewed like any other source file. It is not generated, and no build step updates it.

Its top level records the schema version, the repository name, the surfaces covered, the evidence policy, and the permanent product boundary. Its `features` array holds one entry per capability per surface. A row is identified by its `id` and `surface` together: the same canonical `id` appears once for the website and once for the desktop application when both implement it, because the two surfaces are verified separately and can hold different states.

Each row carries:

- `implementation` — the repository-relative files that contain the capability, optionally narrowed to a symbol with `#`;
- `documentation` — the articles that describe it, which must already exist;
- `changelog` — the changelog files that record it;
- `test` — the automated tests that exercise it, empty when there are none;
- `runtimeInteraction` — what a person would have to do to exercise the capability, written so a reader can see that nobody has done it yet;
- `captureEvidence` — a screenshot, recording, or other capture, and `"none"` when none exists; and
- `boundaryNote` — how the capability relates to the paper-only product boundary and to local-only data.

### What each state means

| `state` | Meaning |
| --- | --- |
| `implemented` | The capability is present in source in the named implementation files, in the form the article describes. |
| `partial` | Source exists but does not cover the whole capability the article describes. The row's `runtimeInteraction` or `boundaryNote` names what is missing. |
| `absent` | No source implements the capability on this surface. |

`state` is derived from the source, never from the documentation. An article describing a capability does not make it `implemented`, and a missing article does not make an implemented capability `partial`. None of the three values says anything about verification: a row can be `implemented` with an empty `test` array, no capture, and no runtime interaction, and that combination is the normal state of this repository today.

### The evidence rule

Empty arrays and `"none"` are the honest default. They record an absence, not an omission, and must never be filled with intent, with a plan, or with a path that does not yet exist. A row may claim runtime or capture evidence only after a real built surface was exercised and the result recorded. Reading source never upgrades a row.

## How an article is written

An article describes shipped behaviour only, in the present tense. Anything that is designed, intended, or planned but not present in source belongs under a clearly labelled **Not yet available** heading, written as a description of what does not exist rather than as a feature. A control that cannot work is named as unavailable, with the reason, rather than shown as a placeholder.

Every article ends with a Verification section that names exactly what was and was not run for it.

## The public wording contract

This repository is public. Every user-visible string in it — documentation, source comments, interface copy, changelog entries, commit messages, and workflow output — satisfies all of the following.

1. **Ordinary professional English.** No private operational terminology, personal filesystem paths, host names, tunnel or builder identifiers, tokens, or internal infrastructure references appear anywhere, in line with the Public records section of the repository instructions in `AGENTS.md`.
2. **The filing boundary is permanent.** No copy implements, offers, advertises, simulates, or implies NETFILE, EFILE, electronic submission, direct transmission to a tax authority, or automatic filing. Each feature article restates that its surface does not move the paper-only boundary. The boundary may be described and prohibited; it is never approached.
3. **No unearned verification claim.** No copy asserts a build, installer, release, test, lint, type check, accessibility check, screenshot, capture, performance measurement, or native-speaker review that did not happen. "The source contains" is never written as "the product does". Every article ends in a Verification section naming exactly what was not run.
4. **No fabricated tax content.** No real taxpayer data, no fabricated sample return, no demonstration form output, and no realistic-looking example figures, slips, addresses, or project files. Test fixtures are invented values, labelled as synthetic.
5. **Intent and shipped behaviour stay visibly separate.** An unavailable capability is named as unavailable. It is not rendered as a disabled placeholder that reads like a feature, and it is not written in the present tense.
6. **Tax statements are sourced.** Any tax statement names its tax year and cites a current official Canada Revenue Agency or Ontario source. No rate, rule, form, mailing address, or deadline is invented, inferred, or carried forward from an earlier year without a citation.
7. **No premature download.** No download control, link, asset name, filename, size, or digest appears before a verified immutable release asset exists.
8. **One product name.** The existing public product name is kept and no new brand is introduced. No name or mark is positioned so that it implies Canada Revenue Agency endorsement, certification, or affiliation.
9. **Bilingual copy agrees on facts.** English and Hong Kong-style Cantonese forms are factually identical, and the humour level never changes a factual, legal, or boundary statement. Where a string carries a fact, its humour variants are the same string.
10. **Manifests and lockfiles stay synchronized.** A change that edits a package manifest also regenerates both the root `package-lock.json` and the `apps/site/package-lock.json` that the publish workflow installs from at `.github/workflows/pages.yml`. A documentation change that would require a manifest edit is routed through the lane that owns the manifest instead of editing a lockfile beside the prose.

## Verification status

This index and `feature-inventory.json` were written by reading the repository's source and the articles they reference, and by parsing the inventory to confirm that every path it names exists. No application was launched, no capture was taken, and no test, lint check, type check, accessibility check, browser interaction, desktop interaction, packaging run, installer, tag, or release was produced for this change. The record of what has and has not been proven for the website is [the website verification status](../site/verification-status.md).
