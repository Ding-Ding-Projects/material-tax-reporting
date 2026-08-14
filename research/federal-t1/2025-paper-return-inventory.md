# 2025 federal T1 paper-return inventory

Accessed: 2026-08-14  
Tax year: 2025  
Ordinary filing year: 2026  
Scope: Canadian-resident individuals, with Ontario used where a province-specific T1 example is necessary

## Purpose and limits

This is implementation research, not tax or legal advice. It does not assert that any software, calculation, form rendering, or package is approved or certified by the Canada Revenue Agency (CRA).

The application boundary is strict:

- It prepares a CRA paper package for the user to print and mail.
- It does not implement, offer, advertise, simulate, or imply NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.
- Export and print remain blocked until the user manually inspects every populated form, calculation, attachment, mailing destination, and signature field, then explicitly acknowledges that review.
- Export means only `Package prepared for mailing - not filed`.
- A signature is never inferred, generated, or applied automatically.

CRA instructs a paper filer to review the return for truth, accuracy, and completeness and says that a paper return can only be sent by mail. The explicit per-item review and acknowledgement described here are additional product controls; they are not represented as a CRA-prescribed software workflow.

Primary sources: [Filing a paper tax return](https://www.canada.ca/en/services/taxes/income-tax/personal-income-tax/how-file/paper.html), [2025 federal guide](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-g.html), [2025 T1 package hub](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package.html).

## Version and jurisdiction rules

The current package at the access date is the 2025 package. Use the package for the province or territory where the individual lived on December 31, 2025. Special rules apply to Quebec residents, newcomers, emigrants, factual or deemed residents, non-residents, deceased persons, and individuals with business income allocated to another jurisdiction.

For Ontario, the main return is `5006-R`, revision `E (25)`, T1-2025, last updated 2026-01-20. The official files are [regular PDF](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-r/5006-r-25e.pdf), [fillable PDF](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-r/5006-r-fill-25e.pdf), and [e-text](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-r/5006-r-25e.txt). Other provinces and territories use different main-return identifiers. A complete package also needs the correct provincial or territorial Form 428, except for Quebec, plus applicable provincial schedules. Those provincial calculations are dependencies but are outside this federal-only inventory.

Ontario residents with business income allocable to a permanent establishment outside Ontario use Form T2203 instead of Ontario Form ON428. This is a jurisdiction boundary, not a user-interface preference.

Do not reuse a form, rate, threshold, line mapping, mailing address, or attachment rule for another tax year. Refresh all official sources for every supported year and reject a mixed-year package.

Beginning with the 2025 tax year, mailed packages no longer automatically include federal Schedules 2, 3, 5, 6, 7, 9, 11, 12, 13, and 15. The package generator must add every applicable schedule rather than assume it is present. Source: [Important changes to the 2025 income tax package](https://www.canada.ca/en/revenue-agency/news/newsroom/tax-tips/tax-tips-2025/important-changes-2025-income-tax-package.html).

## Main T1 workflow and line groups

The 2025 T1 is an eight-page return organized into these implementation stages:

1. Identification, residence, elections, spouse or common-law partner information, and foreign-property/Indian Act-exempt-income indicators.
2. Total income, ending at line 15000.
3. Net income, ending at line 23600.
4. Taxable income, ending at line 26000.
5. Federal tax and federal non-refundable credits.
6. Refund or balance owing, certification, signature, and preparer information.

Important result lines:

| Line | Meaning | Dependency or handling |
|---|---|---|
| 15000 | Total income | Sum of applicable income lines |
| 23600 | Net income | Used by spouse/dependant, benefit, repayment, and credit calculations |
| 26000 | Taxable income | Input to federal tax calculation |
| 35000 | Total federal non-refundable tax credits | Step 5 calculation |
| 40400 | Federal tax on taxable income | Step 5 rate calculation |
| 41700 | Net federal tax | Includes applicable special taxes and credits |
| 42000 | Net federal tax after abatement | Feeds total payable |
| 43500 | Total payable | Compared with total credits |
| 47600 | Tax paid by instalments | Use 2025 payments, including valid payments missing from reminder records |
| 48200 | Total credits | Compared with line 43500 |
| 48400 | Refund | Absolute value when line 43500 minus line 48200 is negative |
| 48500 | Balance owing | Positive value when line 43500 minus line 48200 is positive |

The official `5000-D1` Federal Worksheet supports calculations that no longer have a separate current Schedule 1 or Schedule 4. No current 2025 Schedule 1, Schedule 4, or Schedule 14 appears in the resident package. They must not be invented from historical versions. Source: [2025 federal worksheet](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-d1.html).

### 2025 federal tax calculation

The official T1 gives these 2025 brackets:

| Taxable income band | Rate | Base tax shown by the T1 |
|---|---:|---:|
| Up to $57,375 | 14.5% | $0 |
| Over $57,375 up to $114,750 | 20.5% | $8,319.38 |
| Over $114,750 up to $177,882 | 26% | $20,081.25 |
| Over $177,882 up to $253,414 | 29% | $36,495.57 |
| Over $253,414 | 33% | $58,399.85 |

The basic personal amount at line 30000 is $16,129 when net income is at or below $177,882 and $14,538 when net income is at or above $253,414; the federal worksheet determines the amount between those limits. The general federal non-refundable credit rate on the T1 is 14.5%. These values are specific to 2025.

## Federal schedule inventory

All generic schedule PDFs below identify the tax year as 2025 and use revision `E (25)`. Jurisdiction-specific variants must be selected where indicated.

| Schedule | Trigger and important eligibility boundary | Transfer to the T1 | Official source |
|---|---|---|---|
| `5000-S2` | Unused spouse/common-law partner amounts. Not available after a qualifying separation of 90 days or more that includes December 31. Generic form excludes Quebec/non-residents. | 32600; inputs include spouse lines 30100, 30500, 31400, 31600 and designated tuition | [Schedule 2](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-s2.html) |
| `5000-S3` | Disposition of capital property, taxable capital gain, capital loss, principal-residence designation, or potentially flipped property held under 365 days. | Positive taxable result to 12700. Net capital loss is not entered at 12700 and may support Form T1A. | [Schedule 3](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-s3.html) |
| `5000-S5` | Spouse/common-law partner, eligible dependant, caregiver, or infirm-child claims. | 30300, 30400, 30425, 30450, 30500 | [Schedule 5](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-s5.html) |
| `5000-S6` | Canada workers benefit. Requires residence, working-income, age/family conditions; exclusions include specified full-time students, imprisonment, and diplomatic status. Generic form excludes Quebec, Alberta, and Nunavut. | CWB to 45300; advanced CWB reconciliation to 41500 | [Schedule 6](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-s6.html) |
| `5000-S7` | RRSP/PRPP/SPP contributions, transfers, carryforward, HBP or LLP withdrawals/repayments, or employer PRPP interaction. | 20800; internal activity lines include 24500, 24600, 24620, 24640, 24700, 26300 | [Schedule 7](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-s7.html) |
| `5000-S8` | CPP contributions and overpayment for a non-Quebec resident with no Quebec earnings. Use RC381 instead where CPP/QPP interaction applies, including a T4 QPP contribution. | 22200, 22215, 30800, 31000, 42100, 44800 | [Schedule 8](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-s8.html) |
| `5000-S9` | Current gifts or unused gifts from the prior five years; ecological gifts may use the prior ten years. | 34900 | [Schedule 9](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-s9.html) |
| `5005-S10` | Quebec and specified non-resident EI/PPIP calculations; not a generic resident schedule for other provinces. | 22300, 31200, 31210, 31215, 45000 | [Schedule 10 PDF](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5005-s10/5005-s10-25e.pdf) |
| `5000-S11` | Tuition, Canada training credit, transfer, or carryforward. Generic form excludes Quebec/non-residents. | 32300, 45350; transfer tracking includes 32700 | [Schedule 11](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-s11.html) |
| `5000-S12` | Eligible multigenerational home renovation creating a qualifying secondary unit; residence and qualifying-individual rules apply. | 45355. For 2025, 14.5% with a maximum credit of $7,250 on $50,000 of qualifying expenditures. | [Schedule 12](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-s12.html) |
| `5000-S13` | Existing agreement with the Canada Employment Insurance Commission for self-employed special benefits. | Same premium to 31217 and 42120 | [Schedule 13](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-s13.html) |
| `5000-S15` | FHSA opening/successor status, contributions, transfers, deduction, qualifying withdrawal, or taxable activity. Opening a first FHSA in 2025 can require the schedule even without transactions. | 20805; qualifying withdrawals tracked at 68960 | [Schedule 15](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-s15.html) |

## Conditional federal forms and dependencies

This table covers forms directly referenced by the 2025 T1, the federal guide, or the CRA's official line-to-form index. It is not a claim that no other situation-specific form can apply.

| Form | When it applies | T1 relationship | Paper boundary | Official source |
|---|---|---|---|---|
| T1032 | Joint election to split eligible pension income | 11600 and 21000; may affect 31400 | Both spouses complete and sign identical forms and attach one to each paper return by the filing deadline | [T1032](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t1032.html) |
| T776 | Rental income and expenses | Gross 12599; net 12600 | Attach T776 or an equivalent rental statement | [T776](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t776.html) |
| T2125 | Business, professional, and self-employed commission activities; a separate form for each activity | 13499/13500, 13699/13700, 13899/13900; certain flipped-property income | Attach applicable self-employment statement or accepted financial statement | [T2125](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t2125.html) |
| T2042 | Farming activities | 14099/14100 | Attach applicable self-employment statement | [T2042](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t2042.html) |
| T2121 | Fishing activities | 14299/14300 | Attach applicable self-employment statement | [T2121](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t2121.html) |
| T778 | Child care expenses | 21400 | Attach completed form; retain receipts and other records | [Line 21400 instructions](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-21400-child-care-expenses/how-claim.html) |
| T929 | Disability supports deduction | 21500 | Current line instructions say retain form and receipts; do not attach | [Line 21500 instructions](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-21500-disability-supports-deduction.html) |
| T1-M | Moving expenses | 21900 | Retain supporting documents; whether the completed form itself must accompany a 2025 paper return remains a manual verification item | [Line 21900 instructions](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-21900-moving-expenses.html) |
| T1158 | Registration of family support payments | 21999/22000 relationship | Registration eligibility and timing are separate from annual attachment rules | [T1158](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t1158.html) |
| T777 | Employment expenses | 22900 | Attach T777; retain T2200 and receipts unless specifically requested | [T777](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t777.html) |
| TL2 | Transport employee meals and lodging | 22900 | Conditional employment-expense form | [TL2](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/tl2.html) |
| T1229 | Resource expenses and depletion allowance | 22400 | Attach when instructed | [T1229](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t1229.html) |
| T1223 | Clergy residence deduction | 23100 | Attach when instructed | [T1223](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t1223.html) |
| T1A | Request to carry a current-year loss back | Arises from eligible business, non-capital, farming/fishing, or net capital loss rules | Separate conditional form; never infer eligibility from a negative line alone | [T1A](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t1a.html) |
| T1212 | Deferred security option benefits | 24900 | Attach when instructed | [T1212](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t1212.html) |
| T2048 | Capital gains deduction for qualifying business transfers | 25395 | Conditional to the specific qualifying-transfer rules | [T2048](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t2048.html) |
| T657 | Capital gains deduction | 25400 | Depends on qualifying property, prior claims, and CNIL calculations | [T657](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t657.html) |
| T936 | Cumulative net investment loss | Supports capital gains deduction | Calculation form, as applicable | [T936](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t936.html) |
| T2017 | Reserves on dispositions of capital property | Supports capital gains deduction/reserve | Calculation form, as applicable | [T2017](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t2017.html) |
| T2222 | Northern residents deductions | 25500 | Attach when instructed | [T2222](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t2222.html) |
| T2201 | Disability tax credit certificate | 31600 and transfers such as 31800 | A new claim may require a certified T2201; existing eligibility must not be assumed from a prior value alone | [T2201](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t2201.html) |
| T1206 | Tax on split income | 40424 | Applies only to the split-income rules and exclusions | [T1206](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t1206.html) |
| T691 | Alternative minimum tax | 40427 and other minimum-tax calculations | Current-year and carryover rules are calculation-sensitive | [T691](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t691.html) |
| T2209 | Federal foreign tax credit | 40500 | Attach form, foreign-tax receipts, calculation note, and any additional records the current instructions require | [Line 40500 instructions](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-40500-federal-foreign-tax-credit.html) |
| T2038(IND) | Investment tax credit and recapture | Recapture, 41200, and 45400 | Attach when instructed | [T2038(IND)](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t2038-ind.html) |
| T1172 | Additional tax on RESP accumulated income payments | 41800 | Conditional to accumulated-income-payment rules | [T1172](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t1172.html) |
| RC359 | Tax on excess EPSP amounts | 22900 or 41800, depending calculation | Conditional form | [RC359](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/rc359.html) |
| RC381 | Inter-provincial CPP/QPP calculation | 22200, 22215, 30800, 31000, 42100, 44800 | Use instead of generic Schedule 8 where CPP/QPP interaction requires it | [RC381](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/rc381.html) |
| T2203 | Provincial/territorial taxes for multiple jurisdictions | Federal surtax and 42800 pathway | Replaces a single-province Form 428 in applicable cases | [T2203](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t2203.html) |
| GST370 | Employee and partner GST/HST rebate | 45700 | Attach application where claim applies | [GST370](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/gst370.html) |
| T2043 | Return of fuel charge proceeds to farmers tax credit | 47556 | Attach when claim applies | [T2043](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t2043.html) |
| T1135 | Canadian resident held specified foreign property costing more than CAN$100,000 at any time in the year | T1 foreign-property indicator at 26600 | Due on the individual's return due date; it remains a separate information return and has its own penalties | [Foreign Income Verification Statement](https://www.canada.ca/en/revenue-agency/services/tax/international-non-residents/information-been-moved/foreign-reporting/foreign-income-verification-statement.html) |
| T90 | Indian Act-exempt income | Triggered by the exempt-income indicator | Complete when the current form instructions require it | [T90](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t90.html) |
| T2091(IND) / T1255 | Principal-residence designation by an individual or deceased person's representative | Schedule 3 disposition pathway | Attach the applicable designation form | [Principal residence reporting](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/personal-income/line-12700-capital-gains/principal-residence-other-real-estate/sale-your-principal-residence.html) |
| CPT30 | Stop or revoke CPP contributions in specified age/employment situations | Affects CPP contribution calculations | Election conditions and effective date must be reviewed; not a general annual attachment | [CPT30](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/cpt30.html) |

Additional situation-specific records that must remain discoverable rather than being collapsed into “other” include:

- [T1139, Reconciliation of 2025 Business Income for Tax Purposes](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t1139.html), for applicable off-calendar fiscal-period situations.
- T1248 Schedule D for factual-resident and other special residence situations identified by the package hub.
- T2036 for a provincial or territorial foreign tax credit where applicable outside Quebec.
- T5003/T5004 tax-shelter slips and statement of tax-shelter loss or deduction.
- T1198, a payer-issued statement for a qualifying retroactive lump-sum payment. Eligibility and the alternative CRA calculation must not be inferred from an amount alone.
- T1-OVP and T1-OVP-S, which are separate excess-contribution returns rather than ordinary T1 schedules. Their filing and payment obligations must not be hidden inside the annual T1 package.

The current [T1135 form page](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t1135.html) identifies a 2023 form revision that remains in use for later filing periods. This is direct evidence that `tax_year` and `form_revision` must be stored separately. Simplified Part A reporting is available only when specified foreign property cost was more than $100,000 but less than $250,000 throughout the year; otherwise Part B applies.

Effective-date metadata also belongs beside calculations. Schedule 15 identifies FHSA annual-limit changes effective April 1, 2023. Schedule 8 identifies the CPP enhancement beginning in January 2019 and second additional CPP contributions beginning in January 2024. These historical effective dates do not authorize reuse of the 2025 calculations in another year.

## Identification, spouse, and dependant information

The T1 requires identity, mailing address, province/territory of residence, marital status, residence status, and applicable elections or indicators. The application must not substitute current mailing location for the December 31 tax-package jurisdiction.

Where applicable, page 1 requires the spouse or common-law partner's:

- first name;
- SIN, TTN, or ITN;
- self-employed indicator;
- net income from line 23600, or the amount they would report even if they are not filing and even if it is zero;
- UCCB amount from line 11700; and
- UCCB repayment from line 21300.

Entering those amounts does not remove the spouse or partner's independent filing obligation. If the individual became separated or widowed during 2025 and claims a related credit, the federal guide requires the former or deceased spouse/partner's first name, tax number, and net income before separation or death, even when zero.

Dependant claims need a person-level record with relationship, birth date where relevant, residence/support facts, net income, infirmity/disability facts, custody facts, and the specific claim lines. Do not infer one claim's eligibility from another. Schedule 5 supports lines 30300, 30400, 30425, 30450, and 30500. Medical lines 33099 and 33199 have different dependant scopes.

For certain supported non-resident dependants, the federal guide requires proof of support payment showing the claimant, amount/date, dependant name/address, and guardian name/address where relevant; gifts are not support. For a line 31800 disability transfer, current instructions can require T2201 or an identifying note if the certificate is not attached.

## Paper attachment and retention model

The general rule is not “attach every receipt.” Each document must carry one of these states:

- `attach`: include in this paper package;
- `retain`: keep for six years but do not mail now;
- `attach_if_instructed`: include only when the current form/line instructions say so;
- `attach_if_requested`: retain unless CRA asks for it;
- `manual_confirmation`: the official instruction is ambiguous or situation-specific.

CRA's 2025 guide requires paper filers to attach applicable information slips, completed forms and schedules when instructed, and Form T776 or an equivalent rental statement. If a slip is missing, attach a copy of the final pay statement plus a note naming the payer, address, income type, and action being taken to obtain the slip; keep originals. Keep supporting documents, a copy of the return, and notices of assessment/reassessment for six years.

| Claim | Attach to the paper return | Retain or verify |
|---|---|---|
| RRSP/PRPP/SPP, 20800 | Schedule 7 when required and applicable contribution receipts | Other supporting records |
| FHSA, 20805 | Schedule 15 when required and applicable FHSA receipts | Other supporting records |
| Child care, 21400 | Completed T778 | Receipts and other documents |
| Disability supports, 21500 | None under the current line instruction | T929 and receipts |
| Moving expenses, 21900 | T1-M attachment status requires form-level confirmation | Supporting records |
| Employment expenses, 22900 | T777 | T2200 and receipts/records unless requested |
| Tuition, 32300 | Schedule 11 and applicable provincial schedule | T2202/TL11 and other documents |
| Spouse transfers, 32600 | Schedule 2; spouse's income slips if spouse is not filing | Other supporting documents |
| Medical expenses, 33099/33199 | None under the current 2025 medical guide | Receipts and records |
| Donations, 34900 | Schedule 9 | Donation receipts unless the particular claim instruction says to attach |
| Federal political contribution, 41000 | Official receipts except amounts already reported on specified slips/statements | Other records |
| Pension split, 11600/21000 | Identical jointly signed T1032 on both paper returns | Pension records |
| Foreign tax credit, 40500 | T2209, foreign-tax receipts, calculation note, and situation-specific records | Verify translation and U.S.-source requirements |
| Multiple other-income types, 13000 | Explanatory note listing each type | Supporting records |
| Refund transfer | Note requesting the full refund be transferred to the 2026 instalment account | Confirm that the request applies only to this taxpayer |

Blank schedules and irrelevant forms must not be added. CRA's customized-forms guidance warns that extraneous or incorrectly ordered material can delay processing. When preserving official PDFs, do not redraw or re-typeset a T1 without separately resolving CRA's customized-form requirements. The safest implementation direction is to populate the exact current official fillable PDFs and preserve their visual structure, but this research does not claim that doing so confers CRA approval. Source: [IC97-2 Customized Forms](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/ic97-2/customized-forms.html).

## Mandatory pre-export review

Export and print remain disabled until every required item below has an inspected state and the final acknowledgement is explicit:

1. Tax year, form revision, province/territory package, and any multiple-jurisdiction routing.
2. Identity, mailing address, tax number, birth/death date, marital status, residence, and email-notification choice.
3. Spouse/common-law partner and dependant information.
4. Every populated T1 line and its source or calculation.
5. Every populated schedule, form, worksheet result, election, and transfer.
6. Every attachment proposed for mailing and every record designated retain-only.
7. Total payable, total credits, instalments, refund/balance, and any refund-transfer note.
8. The current mailing destination and envelope grouping.
9. Certification, every taxpayer/spouse/representative signature requirement, date, and telephone field.
10. Final acknowledgement: the package has been manually reviewed, is not filed, and must still be printed, signed where required, and mailed.

Review state must be tied to the exact content digest/version of each item. Any data or calculation change invalidates the affected item and the final acknowledgement. The application must never show `submitted`, `accepted`, `transmitted`, `filed`, or `CRA certified` as an application state.

The T1 contains native tax-professional fields, including a preparer/EFILE-number field. They remain visible because they are part of the official CRA form, but they must not be presented as an application capability.

## Signature and certification

The 2025 Ontario T1 certification states that the information on the return and attachments is correct, complete, and fully discloses income. It provides a taxpayer signature field, telephone number, date, warning about a false return, and tax-professional fields.

Do not auto-sign, simulate a signature, or infer authority. The general CRA electronic-signature page does not establish that an automatically embedded signature is acceptable on a mailed T1. Treat signature completion as an unresolved human action and require inspection before export. T1032 is a separate joint-signature case.

## Mailing

CRA says each person's return goes in a separate envelope. Current-year and late returns for the same person may share an envelope. A paper return can only be sent by mail.

As of the access date, resident returns route as follows:

| Tax centre | Current resident routing |
|---|---|
| Winnipeg Tax Centre, PO Box 14001, Station Main, Winnipeg MB R3C 3M3 | AB, BC, MB, SK, NT, YT; Ontario areas Hamilton, Kitchener, Waterloo, London, Thunder Bay, Windsor |
| Sudbury Tax Centre, 1050 Notre Dame Avenue, Sudbury ON P3A 5C2 | NB, NL, NS, NU, PE; Ontario areas Barrie, Belleville, Kingston, Ottawa, Peterborough, St. Catharines, Sudbury, Toronto; Quebec areas Montréal, Outaouais, Sherbrooke |
| Jonquière Tax Centre, 2251 René-Lévesque Boulevard, Jonquière QC G7S 5J2 | All other Quebec areas |

Source: [Where to mail your paper T1 return](https://www.canada.ca/en/revenue-agency/corporate/contact-information/where-mail-your-paper-t1-return.html), page dated 2025-09-26.

Mailing destinations can change. Resolve the current official record, show its URL and access date, and require manual confirmation immediately before export. The official page does not define Ontario/Quebec “area” boundaries as a postal-code algorithm; do not invent one.

## Deadlines, instalments, refund, and balance owing

For 2025:

- Most individuals: file and pay by 2026-04-30.
- If the individual or spouse/common-law partner carried on a business in 2025, generally file by 2026-06-15 and pay by 2026-04-30.
- The extended filing date does not apply when the business expenditures relate mainly to a tax-shelter investment.
- Deceased-person deadlines vary.
- If a due date falls on a CRA-recognized weekend or holiday, the return is timely when received or postmarked by the next business day; payment is timely when received by that next business day.

Both ordinary filing dates had passed by the access date. A late package may still be prepared, but the application must state the status and must not calculate penalties or interest unless the exact official rule set is implemented.

Line 47600 records total 2025 instalments paid. CRA identifies INNS1 reminders and INNS2 payment summaries as sources but says valid 2025 instalment payments missing from those records still count. For 2026 instalments, the general threshold outside Quebec is net tax owing over $3,000 for 2026 and either 2025 or 2024; Quebec uses $1,800. Standard due dates are March 15, June 15, September 15, and December 15, with a December 31 exception for qualifying farmers and fishers. Source: [Required tax instalments](https://www.canada.ca/en/revenue-agency/services/payments/payments-cra/individual-payments/income-tax-instalments.html).

If line 43500 minus line 48200 is negative, enter the absolute value at line 48400. CRA generally does not issue a refund of $2 or less. A note attached to the paper return can request transfer of the full refund to the individual's 2026 instalment account. If the result is positive, enter it at line 48500. CRA generally does not charge a difference of $2 or less. The 2025 balance was due 2026-04-30 and outstanding amounts accrue daily compound interest after the due date.

Do not mail cash or include cash with the return. Payment selection and execution are outside the package generator. A mailed payment has separate cheque/remittance instructions and may use a payment address different from the return-processing address. Sources: [Line 48400](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-48400-refund.html), [Line 48500](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-48500-balance-owing.html), [Pay through the mail](https://www.canada.ca/en/revenue-agency/services/about-canada-revenue-agency-cra/pay-cheque.html).

## Notices and post-mail handling

Entering an email address on the 2025 return opts the individual into CRA email notifications and stops eligible paper mail; the manual review must disclose that consequence.

After processing, CRA sends a notice of assessment that explains changes and identifies a refund, zero balance, or balance owing. The current federal guide gives a 12-week target for paper returns received on or before the due date; it is a service target, not a guarantee. Keep a copy of the mailed package and the later notice. If CRA requests records, respond with the requested clear copies within the stated period. If new information appears after mailing, do not send a duplicate return; wait for the notice of assessment and use the applicable adjustment route, including Form T1-ADJ by mail where appropriate.

## Implementation uncertainties and fail-closed cases

- This inventory cannot determine an individual's eligibility. User answers and current form instructions control.
- Province/territory schedules and credits are required by a complete package but are outside this federal slice.
- Non-resident, deemed-resident, emigrant, deceased-person, bankruptcy, and trust/estate returns need separate research and routing.
- Exact revision dates for every conditional non-schedule form were not individually verified. Resolve the official form page and current tax-year PDF; never construct a filename as evidence.
- CRA can revise same-year forms. Check the official page before package generation and surface any revision mismatch.
- T1-M paper attachment status is not explicit enough in the current line instruction; require manual confirmation.
- Donation and foreign-tax-credit attachments vary by transaction and claim type.
- Mailing locality boundaries for Ontario and Quebec are not expressed as a complete postal-code mapping.
- The acceptance of automatically embedded signatures on mailed T1 returns was not established.
- CRA's explicit review language does not prescribe the application's acknowledgement design; describe it as a product safety control.
- IC97-2 raises format/certification boundaries for software-generated or customized returns. Preserve official PDFs and never claim approval or certification.
- Official sources can identify further situation-specific forms. Unknown or unsupported conditions must stop automatic package completion and route the user to manual review of current CRA instructions.

## Official source register

All sources were accessed 2026-08-14.

- [2025 T1 package hub](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package.html)
- [All personal income tax packages](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years.html)
- [2025 federal guide](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-g.html)
- [Other forms and publications linked to T1 lines](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/other-forms-publications.html)
- [Ontario 2025 package](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario.html)
- [Ontario Form 5006-R](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-r.html)
- [Filing a paper tax return](https://www.canada.ca/en/services/taxes/income-tax/personal-income-tax/how-file/paper.html)
- [Where to mail a paper T1 return](https://www.canada.ca/en/revenue-agency/corporate/contact-information/where-mail-your-paper-t1-return.html)
- [2025 filing due dates](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/important-dates-individuals/filing-dates-tax-return.html)
- [Required tax instalments](https://www.canada.ca/en/revenue-agency/services/payments/payments-cra/individual-payments/income-tax-instalments.html)
- [Line 48400 refund](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-48400-refund.html)
- [Line 48500 balance owing](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-48500-balance-owing.html)
- [IC97-2 Customized Forms](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/ic97-2/customized-forms.html)
- [CRA forms listed by number](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms.html)
