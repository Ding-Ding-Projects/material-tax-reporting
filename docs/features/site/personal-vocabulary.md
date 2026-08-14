# Personal vocabulary

## Behaviour

A reader may load a private wording map as a small JSON file. Accepted replacements are applied once, at render time, to every string the site produces: the hero, the workflow, the documentation browser, the settings grid, the command palette, the notifications, the toasts and the footer.

The site ships no mappings, no examples and no private defaults. A source check fails when a built-in replacement map appears anywhere in the application sources.

Some spans are never rewritten. The official reference wording and addresses, the paper-only boundary sentence and the two disclaimers are handed to the kernel as immutable spans, so a replacement cannot change what the site says about the product boundary or about an official source.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

The document uses version 1 and contains only a `version` field and a `replacements` object. The kernel enforces the limits: 64 KB, at most 200 replacements, keys of 1 to 80 characters, and values of at most 200 characters. Prototype-shaped keys and unknown root fields are rejected.

## Failure modes

- A rejected file names the exact reason, and the previously accepted map stays active.
- A key that would fall inside an immutable span is not applied there; it still applies elsewhere.
- Clearing the map restores the shipped wording immediately.

## Privacy and security

The map stays in this browser and the source filename is not retained. Replacement values are never written to a history record or to an export: only the key count and the total key and value lengths are kept.

## Verification status

This lane ran the site build (`npm run pages:build` in `apps/site`) and the source checks in `apps/site/src/checks`. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [Language and humour levels](language-and-funny-levels.md)
- [Local history](local-history.md)
- [File converter](file-converter.md)
