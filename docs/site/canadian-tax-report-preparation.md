# Canadian tax-report preparation

## Status

**Product scope defined; released implementation not yet verified.**

This article describes the intended role of the desktop product. It does not claim that a particular report, form, calculation, import, export, or filing workflow is currently available.

## Behavior

Material Tax Reporting is intended to help a user organize information and prepare reports for Canadian tax work. Preparation means helping a user assemble, review, and present information. It does not, by itself, mean that the application submits a return, communicates with a government account, or certifies that a result is complete or correct.

The public website must name an individual workflow as available only after the corresponding desktop behavior has been implemented and verified in a published release. Until then, the website uses explicit unavailable or not-yet-verified states.

## Configuration

No authoritative list of supported tax years, forms, slips, schedules, calculations, import formats, or export formats has been published yet. A future release must identify each supported item and its applicable jurisdiction and tax year before users can rely on it.

The product boundary is Canada and Ontario. See [Canada and Ontario boundary](canada-ontario-boundaries.md) for the jurisdiction rules.

## Failure modes

Preparation can be incomplete or unsuitable when:

- a required form, field, tax year, or jurisdiction is not explicitly supported;
- source information is missing, stale, inconsistent, or entered incorrectly;
- legislation, agency guidance, thresholds, or forms have changed since the software release;
- a user interprets a preparation report as an official filing confirmation;
- an exported report is treated as accepted by an agency without separate official confirmation.

The application and website should present unsupported and unverified states directly rather than guessing, silently omitting data, or implying that preparation equals filing.

## Security and privacy

Tax information can be highly sensitive. The intended product model is local-first and must not imply that information is uploaded merely because a report is prepared. See [Local-first privacy](local-first-privacy.md) for the documented privacy boundary.

## Verification status

This initial documentation change did not verify desktop behavior, calculations, form coverage, government integration, or packaged application behavior. No such capability should be inferred from this article.

## Related articles

- [Canada and Ontario boundary](canada-ontario-boundaries.md)
- [Local-first privacy](local-first-privacy.md)
- [Installer and releases](installer-and-releases.md)
- [Verification status](verification-status.md)
