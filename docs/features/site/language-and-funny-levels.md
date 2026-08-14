# Language and humour levels

## Behaviour

Every user-facing string on the site lives in one copy bundle, keyed by language and by humour level. There are five levels per language, and the active pair of levels selects one English variant and one Cantonese variant. The language mode then decides what is shown: English only, Cantonese only, or both joined by the kernel's bilingual separator.

Humour changes tone and never a fact. Product limits, official names, the official reference wording and addresses, counts, dates and action labels are identical across all five variants of a key. The rule is enforced rather than promised: `apps/site/src/checks/copy-facts.check.ts` runs the kernel's fact-invariant assertion over the whole bundle and fails when a variant disagrees on a number, a date, an address or an official name.

A separate preference adds a decorative emoji to the toast, notification-centre and command-palette headings. It is hidden from assistive technology, it never replaces a word, and it never carries meaning.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

- Language mode: English, Cantonese, or both.
- English humour level and Cantonese humour level, each between the kernel's minimum and maximum.
- Decorative dialog emoji: on or off.

## Failure modes

- A copy key with no entry renders the key itself, so a gap is visible rather than blank.
- A humour level outside the supported range is clamped by the kernel before it is used.
- A key whose variants disagree on a fact is reported by name when the check is run.

## Privacy and security

The bundle ships with the site. Nothing about the reader's choices is transmitted.

## Verification status

This lane ran the site build (`npm run pages:build` in `apps/site`) and the source checks in `apps/site/src/checks`. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [Personal vocabulary](personal-vocabulary.md)
- [Read aloud](narration.md)
- [Command palette](command-palette.md)
