# Canadian tax-report preparation

## Status

**Product scope defined; released implementation not yet verified.**

This article describes the intended role of the desktop product. It does not claim that a particular report, form, calculation, import, export, or mail-in PDF workflow is currently available.

## Behavior

Material Tax Reporting is intended to help a user organize information and prepare reports for Canadian tax work. Preparation means helping a user assemble, review, and present information. The application workflow ends with generation of a CRA mail-in PDF package for the user to print, sign where required, assemble, and mail.

The application must not implement, offer, advertise, simulate, or imply NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing. It must not show a simulated submission, acceptance, confirmation number, or government-delivery status. Generating, exporting, or printing a PDF is not filing.

Before export or print becomes available, the application must require a manual review in which the user inspects every populated form, calculation, attachment, mailing destination, and signature field. The user must then explicitly acknowledge that the review is complete. See [Mail-in PDF and manual review](mail-in-pdf-and-manual-review.md) for the complete workflow.

The public website must name an individual workflow as available only after the corresponding desktop behavior has been implemented and verified in a published release. Until then, the website uses explicit unavailable or not-yet-verified states.

## Configuration

No authoritative list of supported tax years, forms, slips, schedules, calculations, import formats, or export formats has been published yet. A future release must identify each supported item and its applicable jurisdiction and tax year before users can rely on it.

The product boundary is Canada and Ontario. See [Canada and Ontario boundary](canada-ontario-boundaries.md) for the jurisdiction rules. Mailing instructions and destinations must come from current official CRA guidance; they must not be hard-coded from documentation that can become stale.

## Failure modes

Preparation can be incomplete or unsuitable when:

- a required form, field, tax year, or jurisdiction is not explicitly supported;
- source information is missing, stale, inconsistent, or entered incorrectly;
- legislation, agency guidance, thresholds, or forms have changed since the software release;
- the mandatory review finds an incomplete form, calculation, attachment, mailing destination, or signature field;
- the application cannot present every populated item for review;
- a user interprets a generated, exported, or printed package as an official filing confirmation;
- an exported report is treated as received or accepted by the CRA.

The application and website should present unsupported and unverified states directly rather than guessing, silently omitting data, or implying that preparation or PDF generation equals filing. If mandatory review is incomplete, export and print must remain unavailable.

## Security and privacy

Tax information can be highly sensitive. The intended product model is local-first. Tax records and package contents must not be transmitted to the CRA or another filing service. Opening official guidance is not permission to upload the user's data. See [Local-first privacy](local-first-privacy.md) for the documented privacy boundary.

## Verification status

This initial documentation change did not verify desktop behavior, calculations, form coverage, the mandatory review workflow, PDF generation, printing, or packaged application behavior. Electronic submission is not awaiting verification; it is prohibited by the product contract.

## Related articles

- [Canada and Ontario boundary](canada-ontario-boundaries.md)
- [Mail-in PDF and manual review](mail-in-pdf-and-manual-review.md)
- [Local-first privacy](local-first-privacy.md)
- [Installer and releases](installer-and-releases.md)
- [Verification status](verification-status.md)
