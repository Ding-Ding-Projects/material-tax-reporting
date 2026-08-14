# Installer and releases

## Status

**No verified public installer is currently available.**

## Behavior

The website may include an installer area, but it must remain explicitly unavailable and must not expose a download button until a published release asset has been verified. A repository archive, source checkout, placeholder URL, guessed release path, or workflow artifact is not a desktop installer.

When an installer becomes available, the website should identify:

- the exact application version;
- the supported platform and architecture;
- the release page and immutable asset URL;
- the asset filename and size;
- the published integrity digest when available; and
- any unsigned-publisher warning or installation limitation that applies.

## Configuration

There is no installer configuration for visitors while the installer is unavailable. The site must not ask users to choose a channel, architecture, or version that has not been verified and published.

## Failure modes

- No release exists for the intended version.
- A release exists but has no expected installer asset.
- An asset URL is mutable, missing, or does not resolve to the named file.
- An asset belongs to a different commit or version.
- A release is a draft or otherwise not intended for public installation.

In all of these cases, the website should keep the installer unavailable and explain that no verified download is ready. It must not fall back to a source archive or unrelated asset.

## Security and privacy

Visitors should obtain a future installer only from the repository's verified release page or the immutable release asset linked by this website. The site must not request credentials to download a public installer.

An installer, when published, may be unsigned. The release and website must state that condition plainly rather than implying code-signing verification.

## Verification status

No installer, release asset, download URL, digest, installation flow, update flow, or packaged desktop runtime was verified as part of this documentation change.

## Related articles

- [Canadian tax-report preparation](canadian-tax-report-preparation.md)
- [Local-first privacy](local-first-privacy.md)
- [Verification status](verification-status.md)
