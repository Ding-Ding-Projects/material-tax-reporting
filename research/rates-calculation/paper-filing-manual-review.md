# Paper filing and manual review research for 2025 T1 returns

Access date: 2026-08-14

Scope: official Canada Revenue Agency and Government of Canada sources for a 2025 T1 Income Tax and Benefit Return, with Ontario-specific package notes where the CRA package page makes Ontario directly relevant. This note is research for a future paper-only PDF package generator. It is not tax, accounting, or legal advice.

## Hard product boundary

The future application must be paper-only. It must not implement, offer, advertise, simulate, or imply NETFILE, EFILE, ReFILE, SimpleFile, Auto-fill my return, electronic submission, direct CRA transmission, or automatic filing. The application may end only with generation of a CRA mail-in PDF package for the user to print, sign where required, and mail themselves.

Before export or print, the application must require the user to inspect every populated form, calculation, attachment, mailing destination, and signature field and then explicitly acknowledge that review. This workflow is deliberately stronger than the CRA's own source wording. CRA sources require correct, complete information, requested supporting documents for paper filing, signatures where forms require them, and later response to CRA review requests; the product must add its own full-package pre-print review acknowledgement because it must not imply filing, certification, or automatic correctness.

The application must not infer a mailing address. It must perform a fresh lookup of the official CRA mailing-destination source, ask the user to select or confirm the relevant province, territory, Ontario area, Quebec area, residency status, and any other official routing factor, then display the exact current official result for user review.

The application must not claim CRA certification, approval, filing acceptance, assessment, legal compliance, or tax advice. It must state that CRA processing, review, assessment, penalties, and interest are CRA matters after the user mails the return.

## Package and forms

### Which tax package applies

The CRA's 2025 federal guide says to use the income tax package for the province or territory where the individual resided on December 31, 2025, unless a listed special situation applies. Listed examples include Quebec residents, deceased persons, newcomers, emigrants, people with residential ties in more than one province or territory, factual residents outside Canada, deemed residents, non-residents, and certain business-income situations.

For Ontario, the CRA page is titled "Ontario - 2025 Income tax package" and states that the package is for paper filing or when tax forms or schedules are needed. It states that the package includes both the federal tax return and the provincial form, plus other forms and schedules that may apply.

The Ontario package page identifies these core items:

| Item | Official title / role | Official source detail |
| --- | --- | --- |
| 5006-R | Income Tax and Benefit Return (for ON only) | Main form to complete taxes; page title "5006-R Income Tax and Benefit Return (for ON only)"; PDF filenames include `5006-r-25e.pdf` and `5006-r-fill-25e.pdf`; last update 2026-01-20. |
| 5006-C / ON428 | ON428 - Ontario Tax | Calculates Ontario tax and credits to report on the return; PDF filenames include `5006-c-25e.pdf` and `5006-c-fill-25e.pdf`; last update 2026-01-20. |
| Federal Income Tax and Benefit Information for 2025 | Federal guide | Helps complete the federal return; page detail 2026-01-20. |
| Federal Worksheet | Federal worksheet | Used to calculate some amounts to report on the return. |
| Ontario tax information for 2025 | Ontario guide | Helps residents of Ontario complete Ontario tax and credits. |
| Worksheet ON428 | Ontario worksheet | Calculates some amounts to report on the Ontario tax and credits form. |

The Ontario package page also lists additional forms and schedules that may apply, depending on the person's tax situation. Federal examples listed there include Schedule 2, Schedule 3, Schedule 5, Schedule 6, Schedule 7, Schedule 8, Schedule 9, Schedule 11, Schedule 12, Schedule 13, and Schedule 15. Ontario examples listed there include Form ON479, Worksheet ON479, Form ON-BEN, Schedule ON428-A, Schedule ON479-A, Schedule ON(S2), and Schedule ON(S11).

Important Ontario-specific routing note: the CRA Ontario package says that if the taxpayer resided in Ontario on December 31, 2025, or on the date they left Canada if they emigrated in 2025, and all or part of their 2025 business income was earned and can be allocated to a permanent establishment outside Ontario, Form T2203 is used instead of Form ON428.

### Official line/form mappings captured from the sources

Only mappings directly stated in official sources are recorded here:

- 5006-R page 8 says line 147 / line 42800 is "Provincial or territorial tax" and instructs the filer to complete and attach the provincial or territorial Form 428, even if the result is zero.
- 5006-R page 8 says line 48500 is "Balance owing" and that the balance owing is due no later than April 30, 2026.
- 5006-R page 4 says line 20800 RRSP deduction requires Schedule 7 and receipts; line 20805 FHSA deduction requires Schedule 15 and receipts.
- The CRA's line 32600 page says the amount from line 13 of Schedule 2 is entered on line 32600 of the federal tax return, and the provincial or territorial Schedule 2 amount is entered on line 58640 of the provincial or territorial Form 428 for provinces and territories other than Quebec.
- The CRA's retirement income summary table in the federal 2025 guide maps many slip boxes to return lines, such as T4A(OAS) box 18 to line 11300, T4A(P) box 20 to line 11400, and T5 box 19 to line 11500 or line 12100 depending on stated conditions.

## Signing and dating

The 5006-R T1 return page 8 contains the certification immediately before the signature area: "I certify that the information given on this return and in any attached document is correct, complete and fully discloses all of my income." It then requires "Sign here," warns that making a false return is a serious offence, and includes telephone number and date fields. The date format shown is Year/Month/Day.

The CRA PDF instructions state that if a form requires a signature, the completed form must be printed and signed by hand. Therefore the application must not treat a generated or filled PDF as a signed return. It must expose signature fields in the pre-print checklist and require the user to acknowledge that signatures and dates must be completed by hand after printing where the official form requires them.

The 5006-R tax professional area also asks whether a fee was charged on line 49000, asks for an EFILE number if applicable on line 48900, and asks for the tax professional's name and telephone number. Because this product must not offer EFILE or electronic filing, any professional-preparer fields should be preserved only as official form fields and must not be used to imply EFILE capability.

## Attachments, documents, and retention

The federal 2025 guide distinguishes paper attachments from record retention:

- For paper returns, supporting documents must be attached to the return. The guide says that if a claim is made without providing documents, CRA may disallow the claimed credit or deduction and this could delay processing.
- Whether filing by paper or electronically, the filer must keep supporting documents for six years in case CRA asks to see them later. The filer should also keep a copy of the return and the notice of assessment or reassessment.
- The guide's paper attachment list includes a copy of information slips such as T4, T4A, and T5 slips, provincial slips if applicable, completed forms and schedules when instructed, and Form T776 or a statement showing rental income and expenses for line 12600.
- If an information slip is missing, the guide says to attach a copy of the final pay stub or statement instead, keep original documents, and attach a note stating the payer's name and address, type of income, and what is being done to get the slip.

The 5006-R return itself states on page 1 to attach only documents requested to support a deduction, claim, or expense and to keep all other supporting documents in case CRA asks to see them later. The future application should therefore maintain an attachment checklist that is driven by official form and guide instructions, distinguishes "attach to the paper package" from "retain for records," and avoids collecting or generating attachments unless an official source supports the requirement.

Examples of source-specific attachment instructions:

- CRA line 31900 says paper filers attach supporting documents for amounts claimed for student loan interest.
- CRA line 32600 says paper filers attach completed Schedule 2, and if the spouse or common-law partner is not filing a return, attach information slips showing their income; other documents are retained unless CRA asks later.
- CRA line 40500 says paper filers claiming the federal foreign tax credit attach Form T2209, official receipts showing foreign taxes paid, and a note explaining calculations; if taxes were paid to the United States, additional listed U.S. documents are attached.
- CRA line 25500 says paper filers attach completed Form T2222 for northern residents deductions, but do not send other documents unless asked later.

## Mailing destination

The official CRA page "Where to mail your paper T1 return" says its addresses should be used only for income tax and benefit returns. It separates resident and non-resident individuals and routes by province, territory, country group, and specified Ontario or Quebec areas.

For resident individuals, the page routes:

- Winnipeg Tax Centre for Alberta, British Columbia, Manitoba, Saskatchewan, Northwest Territories, Yukon, and Ontario areas Hamilton, Kitchener, Waterloo, London, Thunder Bay, or Windsor.
- Sudbury Tax Centre for New Brunswick, Newfoundland and Labrador, Nova Scotia, Nunavut, Prince Edward Island, and Ontario areas Barrie, Belleville, Kingston, Ottawa, Peterborough, St. Catharines, Sudbury, or Toronto, plus Quebec areas Montréal, Outaouais, or Sherbrooke.
- Jonquière Tax Centre for Quebec areas other than Montréal, Outaouais, or Sherbrooke.

For non-resident individuals, the same page provides a separate routing table with country groupings and areas of Ontario. It also states that, due to international mail delays, CRA is temporarily accepting non-resident income tax returns through fax. This temporary fax note must not be generalized to resident returns and must not be treated as an application filing capability.

The application should store the mailing destination as "fresh official lookup required" plus user-confirmed routing factors, not as a prefilled default. Any printed cover sheet should show the source title, access date, page date when available, user-selected routing factors, and the official destination result for final user verification.

## Payment separation

The 5006-R return states that a balance owing is due no later than April 30, 2026 and refers to CRA payments information. The "Where to mail your paper T1 return" page says its addresses are for income tax and benefit returns only. CRA's "Pay through the mail" page gives a payment-by-cheque process and a separate payment mailing address:

Canada Revenue Agency  
PO Box 3800 STN A  
Sudbury ON P3A 0C3

That page says cheques should be made out to the Receiver General for Canada and should include the relevant tax number and details on where the payment should be applied. It also states processing-time expectations for mailed payments. The future application must not combine payment routing with the T1 mailing-destination lookup unless a current official source expressly instructs that for the specific payment type. The safer product behavior is to generate a separate payment-information reminder, not a payment, and require the user to review the current CRA payment instructions themselves.

## Deadlines, postmark rule, and consequences

The CRA due-date sources state:

- For most people, the 2025 return must be filed on or before April 30, 2026, and payment is due April 30, 2026.
- If the taxpayer or their spouse/common-law partner was self-employed, the filing deadline may be June 15, 2026, but a 2025 balance owing is still due April 30, 2026.
- For deceased persons and their surviving spouse or common-law partner, due dates can differ.
- If a due date falls on a Saturday, Sunday, or CRA-recognized public holiday, the return is considered on time if CRA receives it or it is postmarked on or before the next business day; payment is considered on time if received on the first business day after the due date.

The federal 2025 guide and CRA interest/penalty page state consequences that include:

- CRA may charge penalties when a return is filed late and tax is owed for 2025.
- CRA may charge penalties for failure to report an amount on the 2025 return when an amount was also not reported on a return for 2022, 2023, or 2024.
- CRA may charge penalties for knowingly, or under circumstances amounting to gross negligence, making a false statement or omission on the 2025 return.
- If 2025 taxes are owed, CRA charges compound daily interest starting the day after the due date on unpaid amounts, including reassessed amounts.
- CRA's listed late-filing penalty is 5% of the 2025 balance owing plus 1% of the 2025 balance owing for each full month late, up to 12 months. The repeated late-filing penalty can be higher if CRA's stated prior-year conditions apply.
- Filing late can also delay benefit and credit payments.
- The 5006-R privacy statement says failure to provide personal information may result in paying interest or penalties or other actions.

The application should present these as official CRA consequence summaries with source links, not as personalized penalty calculations or advice.

## CRA review after filing

The 2025 federal guide says CRA usually processes the return and sends a notice of assessment, but conducts a number of reviews each year to promote awareness of and compliance with administered laws. If a return is selected for a more detailed review before or after assessment, CRA may send a letter or call; the guide says a review is not a tax audit in most cases and is usually a routine check to ensure the information on the return is correct.

If CRA asks for documents or receipts, the guide says the filer should reply within the timeframe given, include all requested information, and make sure copies are clear and easy to read. If the filer does not reply, CRA may adjust the return and the claim or deduction may be disallowed.

The product's manual review workflow is not the same thing as CRA's review. The product review happens before export or print and is a user acknowledgement that the package has been inspected. CRA review happens after CRA receives the return and is controlled by CRA.

## Printing and PDF legibility

The CRA form pages for 5006-R and 5006-C say that for best results, forms should be downloaded and opened in Adobe Reader and point to CRA general information. CRA's PDF guidance states:

- Use Adobe Reader to view, print, or download CRA PDF forms and publications.
- Check page size before printing; some files should be printed on legal-size paper.
- From the Adobe Reader print dialog, use "Choose paper source by PDF page size" and specified scaling options for the paper size.
- If a form requires a signature, print the completed form and sign by hand.
- If a PDF does not print correctly, CRA suggests the "Print as image" option.
- The user is responsible for the completeness and accuracy of information submitted on a form and should double-check all data entered.

The 2025 guide's review section also supports a legibility expectation for later CRA requests by saying copies sent in response to a CRA request should be clear and easy to read.

Uncertainty: the sources reviewed did not identify a 2025 T1-specific CRA requirement for one-sided versus double-sided printing, ink color, or staple/fastener handling. The application should not invent those requirements. It can state only the official PDF/page-size/sign-by-hand/clear-copy guidance above and present any unresolved print-handling item as "check current CRA instructions."

## Amended returns boundary

The federal 2025 guide says that if a filer has more information that could change the result of a return already sent to CRA, they should not file another return for that year and should wait until they receive a notice of assessment before asking for changes. It also says a change request generally can only be made for a tax year ending in any of the 10 previous calendar years; a request made in 2026 must relate to a tax year after 2015 to be considered.

The guide lists options including online services and mailing Form T1-ADJ, T1 Adjustment Request, with supporting documents if they have not already been sent to support the original claim. The current product boundary must exclude ReFILE and all electronic adjustment routes. If amended-return support is ever considered, it must be a separate paper-adjustment package workflow and must not be presented as filing a second original return.

## Implementation requirements derived from the research

1. The product must generate a paper mail-in PDF package only.
2. The product must not transmit, simulate transmission, or suggest it can file with CRA.
3. The product must require explicit user inspection and acknowledgement before export or print.
4. The product must preserve official forms, titles, revision years, and source URLs in generated package metadata.
5. The product must keep a source-backed attachment checklist that separates attach-now items from retain-for-records items.
6. The product must require a fresh official mailing-destination lookup and user-confirmed routing factors before printing a mailing cover sheet.
7. The product must show balance/payment information separately from return mailing information and must not create or route payments.
8. The product must show signature/date fields as unresolved user actions until the user acknowledges that they must sign and date by hand after printing.
9. The product must show unresolved official uncertainties, including print-handling details not found in the reviewed sources.
10. The product must include source links and access dates so a user can verify current CRA instructions before mailing.

## Official source list

- CRA, "Ontario - 2025 Income tax package", page date 2026-01-20, https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario.html
- CRA, "5006-R Income Tax and Benefit Return (for ON only)", page date 2026-01-20, PDF/text links for 2025 return, https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-r.html
- CRA, "5006-C ON428 - Ontario Tax", page date 2026-01-20, PDF/text links for 2025 Ontario tax, https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-c.html
- CRA, "Federal Income Tax and Benefit Information for 2025", page date 2026-01-20, https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-g.html
- CRA, "Where to mail your paper T1 return", page date 2025-09-26, https://www.canada.ca/en/revenue-agency/corporate/contact-information/where-mail-your-paper-t1-return.html
- CRA, "Tax centres", page date 2025-09-26, https://www.canada.ca/en/revenue-agency/corporate/contact-information/tax-centres.html
- CRA, "Due dates and payment dates", page date shown 2026-01-20 in linked detail pages, https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/important-dates-individuals.html
- CRA, "Filing due dates for the 2025 tax return", page date 2026-01-20, https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/important-dates-individuals/filing-dates-tax-return.html
- CRA, "Interest and penalties on late taxes - Personal income tax", page date 2026-01-20, https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/interest-penalties/late-filing-penalty.html
- CRA, "Pay through the mail - Payments to the CRA", page date 2026-06-01, https://www.canada.ca/en/revenue-agency/services/about-canada-revenue-agency-cra/pay-cheque.html
- CRA, "Using PDF forms", https://www.canada.ca/en/revenue-agency/services/forms-publications/about-forms-publications.html
- CRA, "About PDF", page date 2017-06-22, https://www.canada.ca/en/revenue-agency/services/forms-publications/help-forms-publications/about-1.html
- CRA, "Line 31900 - Interest paid on your student loans", page date 2026-01-20, https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-31900-interest-paid-on-your-student-loans.html
- CRA, "Line 32600 - Amounts transferred from your spouse or common-law partner", page date 2026-06-09, https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-32600-amounts-transferred-your-spouse-common-law-partner.html
- CRA, "Line 40500 - Federal foreign tax credit", page date 2026-07-10, https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-40500-federal-foreign-tax-credit.html
- CRA, "Line 25500 - Northern residents deductions", https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-25500-northern-residents-deductions.html
- CRA, "Changing a tax return - Personal income tax", https://www.canada.ca/en/services/taxes/income-tax/personal-income-tax/after-you-file/change-return.html
