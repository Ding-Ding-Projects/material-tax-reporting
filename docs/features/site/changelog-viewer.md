# Changelog viewer

## Behaviour

The viewer reads entries produced at build time from the tracked changelog files at the repository root, so it cannot drift from the repository it describes. The site build parses each file with the kernel parser and writes a generated module; the browser performs no fetch.

Entries are grouped by area and by release. Each release shows its own verification block verbatim, so a claim about what was checked travels with the entries it belongs to.

A commit link is rendered only where the kernel produced one from a real recorded identifier. A missing or malformed identifier produces no link rather than a guessed address, and no hash or address is ever synthesized.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

- A search field with its own anchored builder.
- An area filter with its own builder.
- A real date range. A release heading without a date is excluded while a range is set, because its date is unknown rather than assumed.
- Export of the filtered view.

## Failure modes

- A changelog file that cannot be read contributes no entries rather than failing the build.
- A release with no recorded verification block shows none rather than an invented one.
- An empty result reports that the filter matched nothing.

## Privacy and security

Everything is bundled with the site. No request is made while reading the changelog.

## Verification status

This lane ran the site build (`npm run pages:build` in `apps/site`) and the source checks in `apps/site/src/checks`. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [Documentation browser](documentation-browser.md)
- [Exports and bulk actions](exports-and-bulk-actions.md)
