# Mail-in PDF and mandatory manual review

## Status

**Permanent product boundary defined; released implementation not yet verified.**

Material Tax Reporting ends with generation of a CRA mail-in PDF package. It does not and will not provide electronic filing.

## Behavior

The application must not implement, offer, advertise, simulate, or imply:

- NETFILE;
- EFILE;
- electronic submission;
- direct transmission to the Canada Revenue Agency (CRA);
- automatic filing;
- a simulated government submission or acceptance; or
- a confirmation number or delivery status that suggests the CRA received a return.

The final application action is generation of a PDF package for paper filing by mail. The user remains responsible for printing the package, signing every required field, attaching the required documents, choosing the current correct mailing destination, adding postage, and mailing it. PDF generation, export, or printing is not filing and is not proof that the CRA received or accepted anything.

### Mandatory manual review before export or print

Export and print must remain unavailable until the user completes a manual review workflow. The workflow must present every item in a reviewable form and require the user to inspect:

1. every populated form;
2. every calculation and the inputs that produced it;
3. every required or included attachment;
4. the mailing destination selected from current official CRA guidance; and
5. every signature field, including whether it must be signed after printing.

After inspecting all five categories, the user must explicitly acknowledge that the review is complete. A generic acknowledgement shown before the items, a preselected checkbox, or silent progress is not sufficient. Changing any reviewed value that affects the package must invalidate the acknowledgement and require review again before export or print.

The generated package must retain a clear notice that it has not been filed or transmitted.

## Configuration and official sources

The workflow must direct users to current official CRA sources rather than hard-coding mailing addresses, changing figures, or instructions that may become stale:

- [File an income tax and benefit return on paper](https://www.canada.ca/en/services/taxes/income-tax/personal-income-tax/how-file/paper.html)
- [Where to mail your paper T1 return](https://www.canada.ca/en/revenue-agency/corporate/contact-information/where-mail-your-paper-t1-return.html)
- [General income tax and benefit packages by year](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package.html)
- [Ontario 2025 tax package guidance](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-pc.html)

The application may help the user reach the relevant official page, but it must not scrape a changing mailing address into a permanent product default or treat an external page as permission to transmit user data.

## Failure modes

Export and print must remain unavailable when:

- any populated form or calculation has not been inspected;
- an attachment is missing, unresolved, or not reviewed;
- the mailing destination has not been checked against current official CRA guidance;
- a signature field is unresolved or not reviewed;
- the user has not explicitly acknowledged completion;
- a reviewed value changes after acknowledgement;
- the application cannot display the complete package for review; or
- PDF generation cannot produce a complete, readable package.

The application must report the incomplete item and return the user to it. It must not bypass review, generate a partial package as complete, silently omit a form or attachment, or fall back to any electronic submission route.

## Security and privacy

The review and PDF-generation workflow is local-first. It must not upload tax records, attachments, calculations, signatures, or the generated package to the CRA or a third-party filing service. Official CRA links may open guidance in a browser, but no taxpayer data should be placed in the URL, query string, analytics, logs, or browser request.

The generated PDF contains sensitive information. Users should store, print, and dispose of it appropriately for their circumstances. The application must describe the actual local storage and deletion behavior in a verified release.

## Verification status

This documentation change did not verify the manual review workflow, acknowledgement invalidation, PDF generation, printing, package completeness, official-link handling, or packaged desktop behavior. The prohibition on electronic filing is a permanent product requirement, not an unimplemented feature awaiting a future release.

## Related articles

- [Canadian tax-report preparation](canadian-tax-report-preparation.md)
- [Canada and Ontario boundary](canada-ontario-boundaries.md)
- [Local-first privacy](local-first-privacy.md)
- [Verification status](verification-status.md)
