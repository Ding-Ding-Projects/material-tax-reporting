# Language modes and humour levels

## What this is

User-facing wording is resolved from a copy bundle rather than from strings embedded in the interface code. Three
language modes are available: English, Hong Kong-style Cantonese, and both together. Each language carries its own
humour level from 1 to 5, and the two levels are independent.

A separate switch adds a decorative emoji to dialog headings. The emoji is non-semantic: it never carries meaning and
never replaces a word.

## The rule humour cannot break

Humour changes tone and never changes a fact. Strings that carry a field name, a validation rule, a numeric limit or
the mail-in-only boundary statement are declared as fixed text, so all five variants of those strings are literally
identical and no humour level can alter them. The shared kernel exposes a check that reports any copy key whose
variants disagree on a fact-bearing token.

## Boundaries

The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing. The boundary statement on the welcome destination and the boundary statement in the manual review step are
fixed text in both languages.

## Failure modes

- A missing copy key resolves to the key itself, so a gap is visible instead of blank.
- A humour level outside 1 to 5 is clamped by the shared resolver.

## Verification status

The application build (`npm run build --workspace @material-tax-reporting/desktop`) was run and completed, and the generated main, preload and renderer bundles were parsed to confirm they are syntactically valid. No tests, lint, type checks, packaging, installer creation, release, runtime launch, screenshot, accessibility conformance check, performance measurement or native-speaker language review were run for this change, so none is claimed here.

## Related articles

- [Settings and preferences](settings-and-preferences.md)
- [Personal vocabulary](personal-vocabulary.md)
- [Read aloud](narration.md)
