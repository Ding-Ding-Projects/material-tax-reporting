# Installer and releases

## Status

**No verified public installer is currently available.**

## Behavior

The website may include an installer area, but it must remain explicitly unavailable and must not expose a download button until a published release asset has been verified. A repository archive, source checkout, placeholder URL, guessed release path, or workflow artifact is not a desktop installer.

The site's transfer states, and the release manifest that drives them, are documented in [the website download surfaces article](../features/site/download-surfaces.md). That manifest carries no assets, because none has been published and verified, so the site renders its unavailable state and no download control, link, asset name, size, or digest appears anywhere. The desktop equivalent, which covers only transfers the application itself performs on the user's computer, is documented in [the desktop transfer surfaces article](../features/desktop/transfer-surfaces.md).

When an installer becomes available, the website should identify:

- the exact application version;
- the supported platform and architecture;
- the release page and immutable asset URL;
- the asset filename and size;
- the published integrity digest when available; and
- any unsigned-publisher warning or installation limitation that applies.

Installer availability does not change the product boundary. A released application must still end at generation of a manually reviewed CRA mail-in PDF package and must not offer or imply electronic filing.

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

- [Website download surfaces](../features/site/download-surfaces.md)
- [Canadian tax-report preparation](canadian-tax-report-preparation.md)
- [Mail-in PDF and manual review](mail-in-pdf-and-manual-review.md)
- [Local-first privacy](local-first-privacy.md)
- [Verification status](verification-status.md)
