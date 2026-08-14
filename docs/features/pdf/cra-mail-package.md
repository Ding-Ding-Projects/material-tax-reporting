# CRA mail-in PDF package

## Purpose and boundary

The CRA PDF package prepares a local, reviewable 2025 Ontario personal income tax return package from a versioned calculation snapshot. Its endpoint is a PDF that the taxpayer reviews, prints, signs, and mails.

It is not CRA-certified, does not determine universal eligibility, and does not provide tax or legal advice. It never offers NETFILE, EFILE, electronic submission, direct CRA transmission, simulated filing, or automatic filing.

## Tax-year and form catalog

The catalog is explicit and fail-closed. The only supported tax year is 2025 and the only supported province is Ontario. A different year or province is rejected rather than silently mapped to the latest known form.

Always included:

| Document | Official form | Purpose |
| --- | --- | --- |
| T1 | 5006-R | Ontario Income Tax and Benefit Return |
| ON428 | 5006-C | Ontario tax and non-refundable credits |

Conditionally included:

| Document | Official form | Inclusion reason |
| --- | --- | --- |
| S2 | 5000-S2 | Federal spouse or common-law partner transfers |
| S3 | 5000-S3 | Capital gains or losses within the bounded eligibility rules |
| S5 | 5000-S5 | Spouse, eligible dependant, and caregiver claims |
| S6 | 5000-S6 | Canada Workers Benefit |
| S7 | 5000-S7 | RRSP, PRPP, SPP, HBP, or LLP activity |
| S8 | 5000-S8 | Applicable CPP calculations or overpayment |
| S9 | 5000-S9 | Donations and gifts |
| S11 | 5000-S11 | Federal tuition and Canada Training Credit |
| S12 | 5000-S12 | Multigenerational Home Renovation Tax Credit |
| S13 | 5000-S13 | EI premiums on self-employment or other eligible earnings |
| S15 | 5000-S15 | FHSA contributions, transfers, or activities |
| ON479 | 5006-TC | Ontario refundable credits |
| ON-BEN | 5006-TG | Application for applicable 2026 Ontario benefit payments based on the 2025 return |
| ON428-A | 5006-A | Low-income Individuals and Families Tax Credit |
| ON479-A | 5006-TCA | Ontario Childcare Access and Relief from Expenses Tax Credit |
| ON(S2) | 5006-S2 | Ontario spouse or common-law partner transfers |
| ON(S11) | 5006-S11 | Ontario tuition and education carry-forward or transfer amounts |

The official 2025 package does not list a Schedule 1. Federal tax is calculated in the current T1 return and guide, so this implementation does not create a historical Schedule 1 substitute.

## Deterministic field mapping

Every calculation amount is integer Canadian cents and carries a document-qualified key such as `T1:10100` or `ON428:58040`. The engine converts it to a fixed two-decimal string and a stable semantic field such as `T1.line.10100`.

Physical PDF field names are version-specific implementation details. A field profile is accepted only when it identifies the same form, tax year, and official source URL as the catalog; pins the exact template SHA-256 established by the host application; maps every populated semantic field to an existing physical field; and leaves no requested semantic field unmapped.

The package rejects missing fields, changed digests, source mismatches, active PDF content, embedded files, encryption, invalid PDFs, empty PDFs, and inconsistent output metadata.

## Local adapter and assembly

The package does not download forms. The host supplies local templates obtained from the official URLs and implements the PDF adapter. The adapter must declare disabled network access, local-only storage, atomic destination writes, and only inspect, fill, overlay, merge, preview, local export, and local print operations. It must explicitly prohibit every electronic and automatic filing route.

The engine independently inspects each template, prepared form, attachment, and final assembly. A final page count must equal the sum of all included pages. The manifest records each document's title, sequence, local handle, page count, SHA-256, and output declaration.

`filled official CRA form` means the host-supplied template matched the pinned digest and its verified field profile. `CRA form geometry overlay requiring visual review` means a local overlay was produced against the selected official print form. Neither declaration means CRA certification or acceptance.

## Attachments, signatures, and mailing

Supporting documents use opaque local handles. The package never puts attachment bytes or local paths in portable exports. Each attachment is independently inspected, hashed, listed in the manifest, included in page-count reconciliation, and added as its own mandatory review item.

The CRA federal guide states that paper filers attach applicable information slips, completed forms and schedules when instructed, and specified supporting statements. Signature fields are never populated by this package. The review checklist confirms that the printed package leaves the required signature and date fields ready for manual completion.

The CRA currently routes resident Ontario paper returns between the Winnipeg and Sudbury tax centres based on the listed Ontario area. The package does not guess from a free-text city. The host shows the current official address page, lets the user select the applicable listed-area group, and records that explicit choice. The selected address is a mandatory review item and a changed destination invalidates the package review.

## Eligibility and unsupported cases

Preparation stops for non-resident or deemed-resident status, immigration or emigration during the year, deceased or bankruptcy returns, multiple-jurisdiction business income, farming or fishing income, trust or estate reporting, alternative minimum tax, tax on split income, foreign tax credits, possible T1135 obligations, and complex capital transactions.

The bounded form set does not generate T2125, T776, T778, T1-M, T777, T2203, T2209, T2036, T691, T1206, or T1135. A T1135 warning is especially important: the CRA treats it as a separate foreign-information return, and its current form page is not a tax-year-specific 2025 template. The application directs the user to the official source or professional assistance without representing that the mail package satisfied that obligation.

## Carry-forward import and export

The versioned `cra-carry-forward.v1` schema contains only typed amounts, origin years, and provenance. It excludes identity, social insurance number, addresses, source attachments, signatures, and PDF content. Imports reject unknown schema versions, unsupported years or provinces, negative amounts, and non-integer cents.

## Privacy, security, and failure behavior

All case data, PDF templates, generated artifacts, previews, field profiles, and attachments remain local. The adapter must not log taxpayer values, government identifiers, PDF bytes, local handles, or destination paths. The package makes no network request and has no transmission surface.

Preparation fails closed for invalid schemas, unsupported years or provinces, missing acknowledgements, unsafe or changed PDFs, duplicate or changed attachments, omitted conditional forms, incomplete field profiles, page-count mismatch, unsupported tax situations, and missing official-source metadata. Export and print fail closed when review is incomplete or when authorization differs from the current package id or digest.

The application never collects bank or payment credentials. Payments, refunds, and direct deposit are separate CRA processes.

## Official sources

All source facts were retrieved on 2026-08-14 from official Canada.ca pages:

- [Ontario – 2025 Income tax package](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario.html)
- [2025 Ontario T1 return, 5006-R](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-r.html)
- [2025 Ontario tax form, ON428](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-c.html)
- [Federal Income Tax and Benefit Information for 2025](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-g.html)
- [Ontario tax information for 2025](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-pc.html)
- [Other forms and publications that may be needed](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/other-forms-publications.html)
- [Filing a paper tax return](https://www.canada.ca/en/services/taxes/income-tax/personal-income-tax/how-file/paper.html)
- [Where to mail a paper T1 return](https://www.canada.ca/en/revenue-agency/corporate/contact-information/where-mail-your-paper-t1-return.html)
- [T1135 Foreign Income Verification Statement](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t1135.html)
- [About CRA forms and publications](https://www.canada.ca/en/revenue-agency/services/forms-publications/about-forms-publications.html)
- [Due dates and payment dates](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/important-dates-individuals.html)
- [Payment options for personal income tax](https://www.canada.ca/en/revenue-agency/services/payments/payments-cra/individual-payments/make-payment/payment-options-type-payment-you-are-making.html)
- [Tax refunds](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/refunds.html)

Each individual form's official landing page and fillable PDF URL are stored in the versioned source catalog.

## Verification status

No tests, lint, type checking, build, packaging, runtime PDF interaction, accessibility checks, review, browser interaction, or captures were run. The implementation remains unverified under the expedited delivery boundary.
