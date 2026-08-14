# Download surfaces

## Behaviour

`apps/site/app/data/releases.json` is the single source of truth for these surfaces. It ships with an empty asset list, so the site renders its honest unavailable state, and the counts shown elsewhere on the site are derived from that file rather than written by hand.

When an asset is recorded, three surfaces follow. The Start surface names the asset, the version, the published size and the published hash, states plainly that the artifact is unsigned, and requires that statement to be acknowledged before any transfer begins. The Downloading surface is driven by real byte counts read from the response stream and offers a working cancel. The Complete surface reports the measured size and the hash this browser computed, compared against the published one.

The kernel reducer cannot enter the complete phase without a measured byte count, so no surface can announce a transfer it did not measure, and the unsigned flag is a literal, so no code path can express a signature-authenticity claim.

A transfer is a transfer. Nothing here installs, files, submits or transmits anything, and no completion wording says otherwise.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

The manifest carries a schema version and a list of assets, each with a name, a version, an address, a byte length, a published hash and a publication date. An empty list is the shipped state.

## Failure modes

- A request that fails, is refused, or is cancelled moves to a failed state with the exact reason and offers to start again.
- A measured size that does not match the published size, or a measured hash that does not match the published hash, fails rather than completing.
- A browser that exposes no digest interface reports that the hash was not computed instead of claiming a match.

## Privacy and security

No release asset exists, so no transfer is possible today. Nothing about a transfer is reported anywhere; the measurement stays in the browser that performed it.

## Verification status

This lane ran the site build (`npm run pages:build` in `apps/site`) and the source checks in `apps/site/src/checks`. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [Material 3 shell and appearance](material-3-shell-and-appearance.md)
- [Changelog viewer](changelog-viewer.md)
