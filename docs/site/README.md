# Material Tax Reporting documentation

Material Tax Reporting is being developed as a local-first desktop application for preparing Canadian tax reports within a Canada and Ontario scope. Its workflow ends with generation of a CRA mail-in PDF package after mandatory manual review. It does not and will not provide electronic filing or direct transmission to the Canada Revenue Agency (CRA). This documentation establishes the public product boundary without claiming that an installer, tax calculation, PDF package, or production release has been verified.

## Current public status

- Implementation source for the website exists in the repository and produces a static bundle when the publish workflow's build command is run. No browser behaviour, accessibility conformance, responsive layout, or deployment has been verified.
- No desktop release or installer is currently verified for public download.
- No supported tax form, calculation rule, or paper-package workflow is claimed until it is implemented and verified in a published release.
- NETFILE, EFILE, electronic submission, direct CRA transmission, and automatic filing are permanently outside the product boundary. The application must not implement, offer, advertise, simulate, or imply any of them.
- Before export or print, the user must manually inspect every populated form, calculation, attachment, mailing destination, and signature field, then explicitly acknowledge that review.
- The product is intended to support preparation and generation of a mail-in PDF package, not to replace professional advice or an official filing service.

## Website feature inventory

One row per capability the website's source implements. The state column repeats the value the repository's machine-readable record, `docs/features/feature-inventory.json`, holds for the same row; the two are kept identical. A state of `implemented` or `partial` describes source, not verified behaviour: nothing in this table has been exercised in a browser, and every row's evidence gaps are listed in that file.

| Capability | State | Documentation |
| --- | --- | --- |
| Material 3 shell | implemented | [Material 3 shell and appearance](../features/site/material-3-shell-and-appearance.md) |
| Language modes, humour levels, and decorative emoji | implemented | [Language and humour levels](../features/site/language-and-funny-levels.md) |
| Personal vocabulary | implemented | [Personal vocabulary](../features/site/personal-vocabulary.md) |
| Read aloud | implemented | [Read aloud](../features/site/narration.md) |
| Scheduled and external presentation settings | partial | [Scheduled and external presentation settings](../features/site/scheduled-and-external-settings.md) |
| Display name and mark | implemented | [Display name and mark](../features/site/display-name-and-logo.md) |
| File converter | implemented | [File converter](../features/site/file-converter.md) |
| Local model runtime view | partial | [Local Ollama suite](../features/local-ollama-suite/README.md) |
| Tabs and navigation | implemented | [Tabs and navigation](../features/site/tabs-and-navigation.md) |
| Appearance editor and colour translator | implemented | [Appearance editor](../features/site/appearance-editor.md) |
| Element locks | partial | [Element locks](../features/site/element-locks.md) |
| Authenticator utility and support notes | implemented | [Authenticator utility and support notes](../features/site/authenticator-and-support.md) |
| Local history | implemented | [Local history](../features/site/local-history.md) |
| Notifications | implemented | [Notifications](../features/site/notifications.md) |
| Changelog viewer | implemented | [Changelog viewer](../features/site/changelog-viewer.md) |
| Documentation browser | implemented | [Documentation browser](../features/site/documentation-browser.md) |
| Command palette | implemented | [Command palette](../features/site/command-palette.md) |
| Regular-expression builders | implemented | [Regular-expression builders](../features/site/regex-builders.md) |
| Exports and bulk actions | partial | [Exports and bulk actions](../features/site/exports-and-bulk-actions.md) |
| Transfer surfaces | partial | [Download surfaces](../features/site/download-surfaces.md) |

None of these capabilities is a tax capability. Every one of them is a documentation, navigation, or personalization surface, and none of them changes a tax figure, a rule citation, the paper-only product boundary, or the manual-review requirement.

## Product boundary articles

| Area | Public status | Documentation |
| --- | --- | --- |
| Canadian tax-report preparation | Product scope defined; released implementation not yet verified | [Canadian tax-report preparation](canadian-tax-report-preparation.md) |
| Mail-in PDF and mandatory manual review | Permanent paper-only boundary defined; released implementation not yet verified | [Mail-in PDF and manual review](mail-in-pdf-and-manual-review.md) |
| Canada and Ontario boundary | Defined documentation boundary; detailed form coverage not yet published | [Canada and Ontario boundary](canada-ontario-boundaries.md) |
| Local-first privacy | Product requirement defined; packaged-runtime verification not yet published | [Local-first privacy](local-first-privacy.md) |
| Website preferences, search, and accessibility | Implemented in source; no browser verification has been performed | [Website preferences and search](website-preferences-and-search.md) |
| Installer delivery | Unavailable until a verified release asset exists | [Installer and releases](installer-and-releases.md) |
| Verification evidence | Recorded explicitly, including everything that was not run | [Verification status](verification-status.md) |

## Reading order

1. Start with [Canadian tax-report preparation](canadian-tax-report-preparation.md) to understand what the product is intended to do.
2. Read [Mail-in PDF and manual review](mail-in-pdf-and-manual-review.md) for the permanent no-electronic-filing boundary and required pre-export review.
3. Read [Canada and Ontario boundary](canada-ontario-boundaries.md) before relying on any jurisdiction-specific output.
4. Review [Local-first privacy](local-first-privacy.md) for the intended data-handling model and its limits.
5. Check [Installer and releases](installer-and-releases.md) before looking for a download.
6. Use [Verification status](verification-status.md) to distinguish documented intent from verified behavior.
7. Read the [feature documentation index](../features/README.md) for the per-capability record and the wording contract that governs every public string in this repository.

## Important notice

Material Tax Reporting is not tax, legal, accounting, or financial advice. Tax rules, forms, filing requirements, and mailing destinations can change. Users remain responsible for checking current requirements with the Canada Revenue Agency, the Government of Ontario, and a qualified professional when appropriate. The application generates a package for the user to review, print, sign where required, assemble, and mail; it never files on the user's behalf.
