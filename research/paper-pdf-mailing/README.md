# CRA paper PDF and mailing requirements

Status: official-source research for the 2025 personal income tax year. Sources were accessed on 2026-08-14. This document is product research, not tax or legal advice. A user must confirm the current CRA form, instructions, facts, deadlines, and destination before mailing.

## Product boundary

This application ends with generation of a CRA mail-in PDF package. It must not implement, offer, advertise, simulate, or imply NETFILE, EFILE, electronic submission, fax submission, direct CRA transmission, or automatic filing. It must not claim that the application, its calculations, or its output are approved or certified by the CRA.

Export and printing must remain unavailable until the user completes a mandatory manual review and explicitly acknowledges all of the following:

1. Every populated return, schedule, worksheet, and form
2. Every calculation and amount transferred between forms
3. Every supporting document and attachment, including whether it should be attached or retained
4. The tax year, return category, province or territory, and residency facts
5. The complete mailing destination and the current official source used to select it
6. Every signature and date field
7. Every special-return label, election, deadline, and payment deadline

The acknowledgement is an export control, not evidence that the return is correct or accepted. A saved acknowledgement must be invalidated when any reviewed value, form revision, attachment, destination, signature state, tax year, or official routing source changes.

## Authoritative 2025 Ontario form set

The CRA says to use the tax package for the province or territory where the person lived on December 31, 2025. Special rules apply to newcomers, emigrants, factual residents, non-residents, deemed residents, deceased persons, and people with income allocated to more than one jurisdiction. The application must not infer those classifications.

| Form | Purpose and transfer | Standard PDF | Fillable/saveable PDF | Revision and pages |
| --- | --- | --- | --- | --- |
| 5006-R, T1 Income Tax and Benefit Return for Ontario | Main 2025 return. Ontario tax from ON428 is entered on line 42800; applicable Ontario credits from ON479 are entered on line 47900. Line 48400 is refund; line 48500 is balance owing. | [5006-r-25e.pdf](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-r/5006-r-25e.pdf) | [5006-r-fill-25e.pdf](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-r/5006-r-fill-25e.pdf) | `5006-R E (25)`, 8 pages |
| 5006-C, ON428 Ontario Tax | Calculates Ontario tax. Its final line 90 transfers to T1 line 42800. The T1 directs the filer to complete and attach Form 428 even when the result is zero. | [5006-c-25e.pdf](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-c/5006-c-25e.pdf) | [5006-c-fill-25e.pdf](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-c/5006-c-fill-25e.pdf) | `5006-C E (25)`, 4 pages |
| 5006-TC, ON479 Ontario Credits | Calculates applicable refundable Ontario credits. Its final line 21 transfers to T1 line 47900. Attach a copy to a paper return when completed. | [5006-tc-25e.pdf](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-tc/5006-tc-25e.pdf) | [5006-tc-fill-25e.pdf](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-tc/5006-tc-fill-25e.pdf) | `5006-TC E (25)`, 2 pages |
| 5006-TG, ON-BEN | Application attached to the 2025 return for applicable 2026 Ontario Trillium Benefit and Ontario Senior Homeowners' Property Tax Grant amounts. | [5006-tg-25e.pdf](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-tg/5006-tg-25e.pdf) | [5006-tg-fill-25e.pdf](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-tg/5006-tg-fill-25e.pdf) | `5006-TG E (25)`, 2 pages |
| T1-ADJ | Separate request to change an assessed T1 return. It is not attached to a current-year return. | [t1-adj-23e.pdf](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/t1-adj/t1-adj-23e.pdf) | [t1-adj-fill-23e.pdf](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/t1-adj/t1-adj-fill-23e.pdf) | 2023 revision family; current landing page last updated 2023-10-24 |
| T7DR | Amount Owing Remittance Voucher. The current downloadable variant is an accessible fillable PDF. | Not offered on the current landing page | [t7dr-fill-19e.pdf](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/t7dr/t7dr-fill-19e.pdf) | 2019 revision family; 1 page |

Each form's CRA landing page identifies whether the file is a standard PDF, a fillable/saveable PDF, e-text, or large print. The current Ontario package pages were last updated 2026-01-20. Filenames and footer identifiers must be treated as revision data, not as permanent URLs for future tax years.

The Ontario package also lists schedules and forms that apply only to particular facts, including ON428-A, ON479-A, ON(S2), and ON(S11). A generated package must include only forms that the current official instructions and the user's reviewed facts require. It must not silently omit a form merely because the form was removed from the mailed package; starting with the 2025 tax year, several federal and provincial schedules are no longer included in mailed packages and may need to be downloaded separately.

## PDF use, page size, and print quality

CRA guidance distinguishes standard print PDFs from fillable/saveable PDFs. Fillable PDFs should be downloaded and opened in Adobe Reader 10 or later; the CRA warns that they may not function optimally in other PDF viewers and does not recommend mobile devices for its PDF forms.

Before printing, the CRA says to select the paper source by PDF page size and specify the correct scaling. Information Circular IC97-2 adds these requirements for acceptable downloaded or customized paper forms:

- Most documents are 21.5 cm by 28 cm (8.5 in. by 11 in.) after stubs are removed.
- Paper is white and unlined.
- Continuous-feed pages must be detached and the stubs removed; only the first copy of NCR paper is accepted.
- Font quality, density, and clarity should resemble the CRA form.
- Page and line layout, identification information, descriptions, field numbers, and reserved areas must remain in the same order and configuration as the CRA form.
- Titles and keying field numbers are bold; identification entries and keying-field amounts are bold.
- Do not add zeros to keying fields unless the form requests them.
- Print no more than one document page on one side of a sheet.

The application should preserve the official PDF page geometry and should not impose booklet, multiple-pages-per-sheet, fit-to-A4, duplex, raster compression, or other transformations that may violate those requirements. The print review must expose page size, scaling, page count, form revision, and whether every page is legible and complete.

## Generated-return and certification boundary

IC97-2 says all software developers, tax professionals, and individuals creating a program to print forms must obtain CRA approval to generate forms. It also says the CRA does not accept customized, preprinted T1 returns. For computer-generated T1 returns, software that was previously certified for EFILE or NETFILE must have a 2D barcode in the current version; software never certified must first obtain certification before seeking 2D-barcode certification. The circular contains a limited exception for software provided free to all users regardless of income.

These rules do not authorize this product to create a redesigned T1, a condensed return, a custom facsimile, or a 2D-barcode return. Until the product has separate, current, documented CRA authorization for the exact output, the supported approach is to populate the CRA's official fillable PDF without changing its structure. The product must not:

- describe itself as CRA-approved or CRA-certified;
- add, remove, suppress, or fabricate a 2D barcode;
- turn the presence of a barcode into a claim of submission or acceptance;
- generate a custom T1 layout or reflow official pages;
- expose electronic filing or transmission controls.

The CRA's certified-software page notes that paper-only software review is limited to printed forms, not the software or its tax calculations. Even an official form or reviewed print format does not prove the calculation is correct.

## Signatures

The 2025 Ontario T1 certification states that the return and attached documents are correct, complete, and fully disclose income, and it has a `Sign here` field and date field. CRA PDF guidance says that when a form requires a signature, the completed form must be printed and signed by hand.

The CRA's current electronic-signatures page lists specific forms for which an electronic signature is accepted; T1 is not in that list. The mail package must therefore leave the T1 signature/date fields for manual completion and must block final readiness until the user confirms that every required signature field was found. It must not apply a stored, typed, drawn, or cryptographic signature to a mailed T1. IC97-2 separately states that the CRA accepts photocopies of forms, including photocopied signatures, but that is not permission for the application to create a signature.

## Assembly and supporting documents

The CRA says to complete the federal return, provincial or territorial Form 428, and applicable schedules. For a paper return, attach copies of information slips, completed schedules and forms when instructed, and supporting documents requested by the return. For rental income, attach Form T776 or an equivalent statement. When a required slip is missing, the federal guide describes a final pay stub or statement plus an explanatory note as a possible paper-return path; that path requires manual review.

IC97-2 instructs paper filers using customized forms to place relevant completed forms, schedules, and related documents in the correct order and staple them in the top-left corner so all information remains visible. Blank forms should not be included because they may delay processing. The application must produce a reviewable assembly manifest and must not decide that an attachment is unnecessary without an explicit current-form rule.

Use a separate envelope for each person. Current-year and late returns for the same person may be placed in one envelope. The application should default to one return package per person and require explicit review before combining years.

## Standard T1 mailing routes

The current CRA address page is dated 2025-09-26. These addresses are for income tax and benefit returns only. A destination must be revalidated against that page before export because addresses and routing groups can change.

| Return classification and reviewed location | Mailing destination |
| --- | --- |
| Resident: Alberta, British Columbia, Manitoba, Saskatchewan, Northwest Territories, or Yukon; or Ontario city of Hamilton, Kitchener, Waterloo, London, Thunder Bay, or Windsor | Winnipeg Tax Centre, PO Box 14001, Station Main, Winnipeg MB R3C 3M3 |
| Resident: New Brunswick, Newfoundland and Labrador, Nova Scotia, Nunavut, or Prince Edward Island; Ontario city of Barrie, Belleville, Kingston, Ottawa, Peterborough, St. Catharines, Sudbury, or Toronto; Quebec area of Montréal, Outaouais, or Sherbrooke | Sudbury Tax Centre, 1050 Notre Dame Avenue, Sudbury ON P3A 5C2 |
| Resident: Quebec other than Montréal, Outaouais, or Sherbrooke | Jonquière Tax Centre, 2251 René-Lévesque Boulevard, Jonquière QC G7S 5J2 |
| Non-resident: current country is Denmark, France, Netherlands, United Kingdom, or United States; or the CRA page's separately listed Canadian-location group | Winnipeg Tax Centre, PO Box 14001, Station Main, Winnipeg MB R3C 3M3, Canada |
| Non-resident: any other country; or the CRA page's separately listed Canadian-location group | Sudbury Tax Centre, 1050 Notre Dame Avenue, Sudbury ON P3A 5C2, Canada |

The CRA table names specific Ontario cities and Quebec areas. Do not approximate by postal code, nearest city, tax-centre proximity, or province alone. An unlisted or ambiguous place requires a current manual lookup.

The address page temporarily mentions fax acceptance for some non-resident returns because of international mail delays. Fax is excluded from this mail-only product and must never become an export or transmission option.

## Special returns that must not use automatic routing

- **Residency ambiguity:** factual resident, non-resident, deemed resident, and deemed non-resident classifications depend on facts such as residential ties and treaties. The specialized 2025 non-resident/deemed-resident package and Form T1248 may apply.
- **Section 216, Form T1159:** a separate rental/timber election return with its own attachments, country routing, and deadlines. For 2025, the CRA pages identify April 30, 2026 for certain recapture cases, June 30, 2026 when an approved NR6 applies, and December 31, 2027 as the general two-year deadline.
- **Section 217:** page 1 must be labelled `SECTION 217`; general election deadline is June 30, 2026 and the balance is due April 30, 2026, but other Canadian income can change the filing deadline and routing.
- **Section 216.1 actor election:** page 1 needs the specified actor-election label and the return goes to the Film Services Unit serving the province or territory where services were provided. A generic tax-centre address is not sufficient.
- **Deceased and optional returns:** package, labels, signing authority, and deadlines depend on the date of death and return type. The legal representative signs and states their title. Each optional return is separate.
- **Bankruptcy:** pre-bankruptcy, in-bankruptcy, and post-bankruptcy returns have different responsibilities and page-one identification. No complete current special mailing matrix was found in the reviewed sources.
- **Multiple jurisdictions or business allocation:** the Ontario package says Form T2203 replaces ON428 when an Ontario resident has business income allocated outside Ontario.

For these categories, the application may provide a checklist and official links, but it must not select a final form set, deadline, label, or destination without manual official-source review.

## Filing and payment deadlines for the 2025 tax year

- Most 2025 returns and balances: April 30, 2026.
- A self-employed person, or the spouse or common-law partner of one: return generally due June 15, 2026, while the balance remains due April 30, 2026.
- The June filing deadline does not apply when business expenditures relate mainly to a tax-shelter investment.
- If a deadline falls on a Saturday, Sunday, or CRA-recognized public holiday, the return is timely when received or postmarked by the next business day; a payment is timely when received by the first business day after the due date.
- Deceased persons, sections 216/217/216.1, optional returns, and other special categories use separate rules.

The CRA says paper returns are usually processed within 12 weeks. That is processing guidance, not an extension. The 2026-27 service standard excludes categories including deceased, bankruptcy, international/non-resident, emigrant, multiple-year, and contact-required returns from its ordinary paper-return target.

## Payments and remittance vouchers

Payment is separate from filing. For mail payment, the CRA accepts a cheque or postdated cheques in Canadian funds drawn on a Canadian bank or credit union. Make the cheque payable to `Receiver General for Canada`. Include the relevant tax identifier and application details in the memo field, and include a remittance voucher when available. The current separate payment address is:

> Canada Revenue Agency  
> PO Box 3800 STN A  
> Sudbury ON P3A 0C3

The CRA does not accept cash by mail, foreign funds, traveller's cheques, gift cards, or cryptocurrency. A mailed payment is considered paid when delivered to the CRA, not when posted.

Most remittance vouchers cannot be printed at home because they use magnetic ink and financial institutions do not accept photocopies. The CRA identifies T7DR and INNS3 as downloadable individual exceptions. The application may include the official T7DR PDF when relevant, but it must not generate a custom voucher, imply magnetic-ink compatibility, combine the payment address with a return address, or claim a payment was received.

## Changes after assessment

Do not file another T1 to change an assessed return. Wait for the notice of assessment, then mail T1-ADJ separately with the required supporting documents. The CRA asks for support for the entire affected amount, including an originally claimed portion whose documents were not previously sent. The current page states a 10-week mail processing target and generally limits refunds from adjustments to the previous 10 calendar years.

T1-ADJ is not the route for every change. The CRA excludes benefit/credit applications, new or revised elections, refund allocation to other CRA accounts, and personal-information updates. Bankruptcy, deceased, wrong-province, non-resident/international, and multi-jurisdiction cases need case-specific review.

## Records and alternate formats

Keep tax records and supporting documents for at least six years, even when they were not attached. Keep the return and notices of assessment or reassessment. Late-filed returns, property records, audits, CRA directions, and other rules can require longer retention; the application must not automatically delete records on a calculated date.

The CRA offers digital audio, e-text, braille, and large-print formats, including downloadable e-text and large-print files for many forms. The general alternate-format route can provide other versions. An alternate-format publication is not automatically a complete filing artifact, so package treatment must be reviewed. CRA accessibility contacts include individual enquiries at 1-800-959-8281 and TTY at 1-800-665-0354.

## Official sources

- [Filing a paper tax return](https://www.canada.ca/en/services/taxes/income-tax/personal-income-tax/how-file/paper.html)
- [Get a T1 income tax package](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package.html)
- [2025 Ontario tax package](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario.html)
- [Federal Income Tax and Benefit Information for 2025](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-g.html)
- [Using PDF forms](https://www.canada.ca/en/revenue-agency/services/forms-publications/about-forms-publications.html)
- [IC97-2 Customized Forms](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/ic97-2/customized-forms.html)
- [Certified software for EFILE](https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-individuals/efile-electronic-filers/efile-certified-software-efile-program.html)
- [Electronic signatures](https://www.canada.ca/en/revenue-agency/services/forms-publications/electronic-signatures.html)
- [Where to mail a paper T1 return](https://www.canada.ca/en/revenue-agency/corporate/contact-information/where-mail-your-paper-t1-return.html)
- [Filing due dates for the 2025 tax return](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/important-dates-individuals/filing-dates-tax-return.html)
- [Pay through the mail](https://www.canada.ca/en/revenue-agency/services/about-canada-revenue-agency-cra/pay-cheque.html)
- [Remittance vouchers and payment forms](https://www.canada.ca/en/revenue-agency/services/forms-publications/request-payment-forms-remittance-vouchers.html)
- [Changing a tax return](https://www.canada.ca/en/services/taxes/income-tax/personal-income-tax/after-you-file/change-return.html)
- [T1-ADJ](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t1-adj.html)
- [How long to keep income tax records](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/long-should-you-keep-your-income-tax-records.html)
- [Order alternate formats](https://www.canada.ca/en/revenue-agency/services/forms-publications/help-forms-publications/about-multiple-formats.html)
- [2025 non-resident and deemed-resident package](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/non-residents.html)
- [Section 216 filing deadline](https://www.canada.ca/en/revenue-agency/services/tax/international-non-residents/individuals-leaving-entering-canada-non-residents/electing-under-section-216/when-file.html)
- [Section 216 completion and mailing](https://www.canada.ca/en/revenue-agency/services/tax/international-non-residents/individuals-leaving-entering-canada-non-residents/electing-under-section-216/how-complete-return.html)
- [Section 217 completion and mailing](https://www.canada.ca/en/revenue-agency/services/tax/international-non-residents/individuals-leaving-entering-canada-non-residents/electing-under-section-217/how-complete-section-217-return.html)
- [Doing taxes when filing for bankruptcy](https://www.canada.ca/en/revenue-agency/services/tax/individuals/information-on-bankruptcy.html)
- [Filing deadlines for someone who died](https://www.canada.ca/en/revenue-agency/services/tax/individuals/life-events/doing-taxes-someone-died/prepare-returns/filing-deadlines.html)

## Unresolved and time-sensitive boundaries

- CRA form revisions, addresses, deadline pages, and temporary mail disruptions can change. Metadata must expire or require revalidation; it must not silently remain authoritative for another year.
- The reviewed sources do not provide a complete automatic postal-code-to-tax-centre mapping.
- No complete current special mailing rule was found for bankruptcy returns.
- Film Services Unit routing requires a current official lookup based on where services were performed.
- Residency and treaty status cannot be determined safely from a short questionnaire.
- Alternate formats may not preserve the same fillable fields or filing treatment as the standard PDF.
- The research does not establish CRA approval or certification for this product, its calculations, or its generated package.
