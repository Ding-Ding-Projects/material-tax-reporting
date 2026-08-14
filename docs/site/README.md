# Material Tax Reporting documentation

Material Tax Reporting is being developed as a local-first desktop application for preparing Canadian tax reports within a Canada and Ontario scope. Its workflow ends with generation of a CRA mail-in PDF package after mandatory manual review. It does not and will not provide electronic filing or direct transmission to the Canada Revenue Agency (CRA). This documentation establishes the public product boundary without claiming that an installer, tax calculation, PDF package, or production release has been verified.

## Current public status

- The documentation and landing website are in their initial implementation phase.
- No desktop release or installer is currently verified for public download.
- No supported tax form, calculation rule, or paper-package workflow is claimed until it is implemented and verified in a published release.
- NETFILE, EFILE, electronic submission, direct CRA transmission, and automatic filing are permanently outside the product boundary. The application must not implement, offer, advertise, simulate, or imply any of them.
- Before export or print, the user must manually inspect every populated form, calculation, attachment, mailing destination, and signature field, then explicitly acknowledge that review.
- The product is intended to support preparation and generation of a mail-in PDF package, not to replace professional advice or an official filing service.

## Feature inventory

| Area | Public status | Documentation |
| --- | --- | --- |
| Canadian tax-report preparation | Product scope defined; released implementation not yet verified | [Canadian tax-report preparation](canadian-tax-report-preparation.md) |
| Mail-in PDF and mandatory manual review | Permanent paper-only boundary defined; released implementation not yet verified | [Mail-in PDF and manual review](mail-in-pdf-and-manual-review.md) |
| Canada and Ontario boundary | Defined documentation boundary; detailed form coverage not yet published | [Canada and Ontario boundary](canada-ontario-boundaries.md) |
| Local-first privacy | Product requirement defined; packaged-runtime verification not yet published | [Local-first privacy](local-first-privacy.md) |
| Website preferences, search, and accessibility | Included in the initial website implementation; browser verification not performed in this change | [Website preferences and search](website-preferences-and-search.md) |
| Installer delivery | Unavailable until a verified release asset exists | [Installer and releases](installer-and-releases.md) |
| Verification evidence | Documentation-only status is recorded explicitly | [Verification status](verification-status.md) |

## Reading order

1. Start with [Canadian tax-report preparation](canadian-tax-report-preparation.md) to understand what the product is intended to do.
2. Read [Mail-in PDF and manual review](mail-in-pdf-and-manual-review.md) for the permanent no-electronic-filing boundary and required pre-export review.
3. Read [Canada and Ontario boundary](canada-ontario-boundaries.md) before relying on any jurisdiction-specific output.
4. Review [Local-first privacy](local-first-privacy.md) for the intended data-handling model and its limits.
5. Check [Installer and releases](installer-and-releases.md) before looking for a download.
6. Use [Verification status](verification-status.md) to distinguish documented intent from verified behavior.

## Important notice

Material Tax Reporting is not tax, legal, accounting, or financial advice. Tax rules, forms, filing requirements, and mailing destinations can change. Users remain responsible for checking current requirements with the Canada Revenue Agency, the Government of Ontario, and a qualified professional when appropriate. The application generates a package for the user to review, print, sign where required, assemble, and mail; it never files on the user's behalf.
