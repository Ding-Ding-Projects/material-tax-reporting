# Ontario individual tax and benefit reporting research

Accessed: **2026-08-14**  
Implementation baseline: **2025 tax year**  
Jurisdiction: **Ontario, Canada**

This report records implementation facts from official Canada Revenue Agency (CRA), Government of Canada, and Government of Ontario sources. It is not tax or legal advice. Amounts, thresholds, eligibility rules, field identifiers, form revisions, and mailing instructions are tax-year specific and must be revalidated for every supported year.

## Non-negotiable product boundary

The application may prepare a **CRA mail-in PDF package only**.

- It must not implement, offer, advertise, simulate, or imply NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.
- It must not claim that the application, its calculations, or its generated forms are certified or approved by the CRA.
- Before export or print, the user must manually inspect every populated form, calculation, required attachment, retained-document instruction, mailing destination, identity field, marital-status field, dependant field, declaration, date, and signature field.
- The package must remain blocked until the user explicitly acknowledges that review.
- A generated amount is a preparation aid, not a CRA assessment and not professional tax advice.

The CRA's [Ontario 2025 income tax package](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario.html) says the package is for filing a paper return or obtaining forms and schedules.

## Source and version rules

1. Bind each calculation and template to an explicit tax year and exact official form revision. The 2025 English artifacts use `-25e` filenames and were last updated on 2026-01-20.
2. Use the year-stamped CRA package, form PDF, and year-stamped CRA Ontario guide as the primary authority for 2025 return fields and calculations.
3. Use Ontario government pages for program purpose, legislation, effective dates, and supplementary eligibility details. Many Ontario pages are live and may show a later year's amounts; they must not silently replace a year-stamped CRA form.
4. Never combine thresholds, formulas, field identifiers, or instructions from different tax years.
5. Fail closed when the selected form year, calculation year, source revision, or populated PDF template year does not match.
6. Recheck the live CRA paper-return mailing page immediately before export or print. Mailing destinations are mutable and vary by taxpayer location.

## 2025 Ontario form inventory

| Artifact | Purpose and principal flow | Paper handling |
|---|---|---|
| [5006-R, Income Tax and Benefit Return for Ontario](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-r.html) | Main T1 return. Ontario tax enters line 42800; Ontario refundable credits enter line 47900; an Ontario Opportunities Fund donation uses line 46500. | Include and obtain the taxpayer's manual review of the declaration, date, and signature. Attach only documents the CRA requests. |
| [ON428, Ontario Tax](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-c.html) | Calculates Ontario tax, non-refundable credits, surtax, minimum-tax adjustment, tax reduction, LIFT credit, farmers' donation credit, and health premium. Line 90 goes to T1 line 42800. | Attach even when the result is zero. |
| [Worksheet ON428](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-d.html) | Calculates the age amount, caregiver amount, under-18 disability supplement, transferred disability amount, dependant medical expenses, dividend tax credit, and Ontario additional tax for minimum-tax purposes. | Keep for records; do not attach. |
| [ON479, Ontario Credits](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-tc.html) | Calculates seven refundable Ontario credits. Line 21 goes to T1 line 47900. | Attach when a refundable Ontario credit is claimed. |
| [Worksheet ON479](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-d1.html) | Calculates the Ontario political contribution credit and interpolated co-operative education credit. | Keep for records; do not attach. |
| [ON-BEN](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-tg.html) | Applies for 2026 Ontario Energy and Property Tax Credit, Northern Ontario Energy Credit, and Ontario Senior Homeowners' Property Tax Grant using 2025 facts. Benefits are paid separately from the tax refund. | Attach when applying for any applicable ON-BEN benefit. Use a separate residence-detail sheet when Part B lacks space. |
| [Schedule ON428-A](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-a.html) | Calculates the Low-income Individuals and Families Tax Credit. Field 62140 goes to ON428 line 85. | Attach when claimed. |
| [Schedule ON479-A](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-tca.html) | Calculates the Ontario Childcare Access and Relief from Expenses credit. Field 63050 goes to ON479 line 2. | Attach when claimed. |
| [Schedule ON(S2)](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-s2.html) | Calculates unused Ontario age, pension, and disability amounts transferred from a spouse or common-law partner. Output goes to ON428 field 58640. | Attach. If the spouse or partner does not file a return, attach their information slips. |
| [Schedule ON(S11)](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-s11.html) | Claims and carries forward historic Ontario tuition and education amounts. Output goes to ON428 field 58560. | Attach; keep supporting documents. |
| [T2203](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t2203.html) | Replaces ON428 when an Ontario resident has business income allocable to a permanent establishment outside Ontario, or in the other multi-jurisdiction situations stated by CRA. | Attach the completed applicable parts instead of ON428. |

## ON428 calculation map for 2025

### Part A — Ontario tax on taxable income

Input is T1 line 26000. The form's five brackets are:

| Taxable income | Rate | Base tax at bracket start |
|---:|---:|---:|
| $52,886 or less | 5.05% | $0.00 |
| More than $52,886 to $105,775 | 9.15% | $2,670.74 |
| More than $105,775 to $150,000 | 11.16% | $7,510.09 |
| More than $150,000 to $220,000 | 12.16% | $12,445.60 |
| More than $220,000 | 13.16% | $20,957.60 |

### Part B — Ontario non-refundable tax credits

The eligibility rules for most Ontario non-refundable credits follow the corresponding federal credits, but Ontario amounts and calculations differ. Newcomers and emigrants must reduce corresponding provincial claims when federal claims are prorated.

| Federal input or concept | ON428 field / amount for 2025 |
|---|---|
| T1 line 30000 | 58040 basic personal amount: $12,747 |
| T1 line 30100 | 58080 age amount: maximum $6,223; phases out at 15% over $46,330 and is zero at $87,817 or more |
| T1 line 30300 | 58120 spouse or partner amount: $11,905 minus spouse net income, maximum $10,823 |
| T1 line 30400 | 58160 eligible dependant amount: $11,905 minus dependant net income, maximum $10,823 |
| T1 line 30450 | 58185 Ontario caregiver amount: base $26,562 minus dependant net income, maximum $6,008 per dependant, reduced by an eligible-dependant claim for the same person |
| T1 lines 30800 / 31000 | 58240 / 58280 CPP or QPP contributions |
| T1 lines 31200 / 31217 | 58300 / 58305 employment insurance premiums |
| Adoption expenses | 58330 |
| T1 line 31400 | 58360 pension income amount: maximum $1,762 |
| T1 line 31600 | 58440 disability amount: $10,298 for age 18 or older; under-18 worksheet maximum $16,305 |
| T1 line 31800 | 58480 disability amount transferred from a dependant |
| T1 line 31900 | 58520 interest paid on student loans |
| Schedule ON(S11) | 58560 historic Ontario tuition and education carryforward claimed |
| Schedule ON(S2) | 58640 amounts transferred from spouse or partner |
| Medical expenses | 58689 for self/spouse/dependent children; 58729 for other dependants; combined at 58769 |
| Schedule 9 lines 13 / 14 | Donations at 5.05% / 11.16%; combined at 58969 |

The total eligible base is multiplied by 5.05% before donations and gifts are added. The Ontario guide contains higher Ontario-specific caps for certain attendant care, adapted-van, moving, and dependant-medical expenses; those values are year-specific inputs, not reusable constants.

### Part C — Ontario tax, surtax, reductions, and health premium

- ON428 line 54 imports Ontario tax on split income from T1206.
- Ontario dividend credit field 61520 uses 2.9863% of the non-eligible dividend base and 10% of the eligible dividend base.
- Minimum tax carryover is limited to the lesser of the post-dividend-credit Ontario tax and 24.63% of T1 line 40427.
- Surtax is 20% of Ontario tax above $5,710 plus 36% above $7,307, excluding the split-income amount from the surtax base.
- Ontario additional tax for minimum-tax purposes uses 24.63% of T691 Part 5 line 11 plus the incremental surtax calculated by Worksheet ON428.
- Ontario tax reduction starts with $294, adds $544 for each qualifying dependent child and $544 for each qualifying dependant with an impairment, doubles the sum, and reduces Ontario tax otherwise payable. It is unavailable in the excluded residency, minimum-tax, bankruptcy, trustee-filed, or opt-out cases printed on ON428.
- T2036 supplies the provincial foreign tax credit at ON428 line 82 and must be attached to a paper return.
- Schedule ON428-A supplies the LIFT credit at field 62140 / line 85.
- Qualifying Ontario food-program donations already claimed on federal Schedule 9 and ON428 field 58969 generate an additional 25% credit at field 62150 / line 87.
- ON428 line 90 goes to T1 line 42800.

#### LIFT credit

Schedule ON428-A calculates 5.05% of T1 lines 10100 and 10400, capped at $875. Adjusted net income starts from line 23600, adds line 21300 and qualifying RDSP repayments from line 23200, then subtracts line 11700 and qualifying RDSP income from line 12500. The credit is reduced by 5%:

- for a single individual, of adjusted net income over $32,500;
- for a person with a spouse or partner, of the greater of individual adjusted net income over $32,500 and adjusted family net income over $65,000.

The CRA guide also excludes individuals subject to Ontario additional tax for minimum-tax purposes, specified long-term prisoners, and anyone bankrupt during 2025. Residency at the beginning of the year in Canada and on 2025-12-31 in Ontario is required.

#### Ontario health premium

The premium is part of Ontario income tax and is not an OHIP eligibility charge. ON428 uses the following schedule:

| Taxable income | Premium calculation |
|---:|---|
| $20,000 or less | $0 |
| More than $20,000 to $25,000 | 6% of excess over $20,000 |
| More than $25,000 to $36,000 | $300 |
| More than $36,000 to $38,500 | $300 + 6% of excess over $36,000 |
| More than $38,500 to $48,000 | $450 |
| More than $48,000 to $48,600 | $450 + 25% of excess over $48,000 |
| More than $48,600 to $72,000 | $600 |
| More than $72,000 to $72,600 | $600 + 25% of excess over $72,000 |
| More than $72,600 to $200,000 | $750 |
| More than $200,000 to $200,600 | $750 + 25% of excess over $200,000 |
| More than $200,600 | $900 |

For bankruptcy, the guide bases the premium on total taxable income across the relevant 2025 returns. For a deceased Ontario resident, the final-return rule uses taxable income on the final return.

## ON479 refundable credits for 2025

ON479 line 21 goes to T1 line 47900. The completed ON479 is attached to a paper return.

| Credit | Core rule and form flow | Supporting documents |
|---|---|---|
| Ontario Fertility Treatment Tax Credit | Effective for eligible expenses paid on or after 2025-01-01. Credit is 25% of eligible expenses at field 61268, maximum $5,000. The expenses must also be included in ON428 field 58689 for the same return year, relate to eligible fertility treatment, preservation, or surrogacy, and concern goods and services provided entirely in Canada. Only one spouse or partner claims. | Attach ON479; retain receipts. |
| CARE credit | Complete T778 and T1 line 21400 first. ON479-A adds each applicable person's line 23600, line 21400, and line 23500 to determine family adjusted income. The rate is 75% at $0–$20,000, descends through the year-stamped table, and is 0% above $150,000. Field 63050 goes to ON479 line 2. | Attach ON479-A and ON479. |
| Seniors Care at Home Tax Credit | Claimant or spouse/partner is 70 or older on 2025-12-31; Ontario resident at year end; ON428 line 58769 is positive; family net income is below $65,000. Credit is 25% of ON428 line 58769, capped at $1,500, then reduced by 5% of family net income over $35,000. Field 63095 is ON479 line 13. | Attach ON479; retain medical evidence. |
| Seniors' Public Transit Tax Credit | Age 65 or older on 2024-12-31, Ontario resident at 2025 year end, and personally paid eligible Ontario or municipal transit costs used in 2025. Field 63100 is capped at $3,000; line 14 is 15%, so the maximum is $450. | Attach ON479; retain receipts and payment/usage evidence. |
| Ontario Political Contribution Tax Credit | Ontario resident at year end and eligible 2025 provincial contribution. Field 63110 feeds Worksheet ON479. Rates are 75% through $500.05; $375.03 plus 50% of excess to $1,666.82; $958.41 plus 33.33% of excess thereafter; maximum $1,666.82 once contributions reach $3,793. | Attach ON479 and all official receipts. Keep the worksheet. |
| Ontario Focused Flow-Through Share Tax Credit | T1221 expenses enter field 63220 and are multiplied by 5% at line 17. | Attach ON479, T1221, and copies of applicable T101 or T5013 slips. |
| Ontario Co-operative Education Tax Credit | For a qualifying unincorporated business or qualifying non-limited partner. Uses fields 63260, 63265, 63270, and 63300. Rate is 30% if prior-year salaries/wages are at most $400,000, 25% at least $600,000, and interpolated by Worksheet ON479 between those values. Maximum $3,000 per student per qualifying placement. The 2025 credit becomes self-employment income on the 2026 return. | Attach ON479; retain placement certificates and evidence. |

The year-stamped ON479 PDF confirms that political contributions use field **63110**. The 2025 e-text version labels that field as 63100, which conflicts with the PDF, CRA guide, and Worksheet ON479. Implementations must use the PDF-confirmed 63110 mapping and retain this discrepancy as a source-quality note.

## ON-BEN and return-driven benefits

ON-BEN is an application/data form. It is not the CRA's benefit-assessment calculation and it does not flow into the T1 refund calculation. CRA issues these payments separately.

### ON-BEN fields

- `61020`: apply for Ontario Energy and Property Tax Credit (OEPTC)
- `61040`: apply for Northern Ontario Energy Credit (NOEC)
- `61060`: choose delayed single 2026 Ontario Trillium Benefit payment in June 2027
- `61070`: apply for 2026 Ontario Senior Homeowners' Property Tax Grant (OSHPTG)
- `61080`: spouses or partners occupied separate Ontario principal residences for medical reasons and elect individual applications
- `61100`: eligible principal-residence rent
- `61120`: eligible principal-residence property tax actually paid
- `61140`: designated Ontario student residence
- `61210`: principal-residence home-energy costs on a reserve
- `61230`: accommodation costs in a public or non-profit long-term-care home

Part B requires residence address, postal code, months occupied, amount paid, long-term-care indicator, and the payee or supplier. Part C records the other spouse's address for involuntary separation.

### Benefit relationships

- Ontario Trillium Benefit combines the Ontario Sales Tax Credit, OEPTC, and NOEC for the July 2026–June 2027 benefit year.
- Ontario Sales Tax Credit does not require an ON-BEN application; CRA uses the filed return.
- OEPTC requires ON-BEN field 61020 plus Parts A and B. Eligible facts include qualifying rent/property tax, designated student residence, public long-term-care accommodation, or reserve home-energy costs.
- NOEC requires field 61040 plus Parts A and B and residence in the specified Northern Ontario districts.
- OSHPTG requires field 61070, field 61120, Parts A and B, age 64 or older on 2025-12-31, and ownership/occupation of the principal residence with 2025 property tax paid.
- Generally only one spouse or partner applies for OEPTC, NOEC, and OSHPTG for the household. If only one spouse or partner was at least 64 on 2025-12-31, that person applies.
- The Ontario Child Benefit is determined through the Canada Child Benefit relationship and filed-return information; it is not an annual ON-BEN election.
- Ontario Guaranteed Annual Income System payments are also informed by filed-return and federal pension information, but no Ontario annual return schedule separately calculates the benefit.

The generator may display sourced estimates only when their year and source are explicit. It must never describe an estimate as a CRA assessment or entitlement decision.

### 2026 benefit calculation references tied to the 2025 return

CRA calculates OEPTC and NOEC monthly for July 2026 through June 2027. Marital status is fixed to 2025-12-31 for all months, while child-related family situation can change the calculation sheet used for a month.

- **OEPTC occupancy cost:** 20% of 2025 Ontario rent, plus 2025 Ontario property tax, plus $25 for a designated student residence.
- **OEPTC energy component:** 20% of qualifying public/non-profit long-term-care accommodation, plus qualifying reserve energy costs, plus occupancy cost, less the designated-residence $25; maximum $290.
- **OEPTC non-senior property component:** 10% of occupancy cost capped at $944, plus $73, limited to occupancy cost. Income reduction is 2% over $29,047 for a single non-senior with no child and over $36,309 for married/common-law non-seniors or a sole-care parent.
- **OEPTC senior property component:** 10% of occupancy cost capped at $581, plus $617, limited to occupancy cost. Income reduction is 2% over $36,309 for a single senior with no child and over $43,571 for a senior couple or sole-care senior. OSHPTG can reduce the property component so combined relief does not exceed qualifying property/occupancy cost.
- **NOEC:** maximum $189 for a single person without children, reduced by 1% of adjusted net income over $50,833; maximum $290 for couples and single parents, reduced by 1% of adjusted family net income over $65,356. Shared-care calculations combine half of the applicable single amount and half of the applicable family amount.
- **OSHPTG:** maximum is the lesser of $500 and eligible 2025 property tax. For a single, separated, divorced, or widowed applicant, reduce by 3.33% of adjusted net income over $35,000; nil at $50,000 or more. For a married/common-law applicant, reduce by 3.33% of adjusted family net income over $45,000; nil at $60,000 or more.
- **Ontario Sales Tax Credit:** CRA determines it from the return without an ON-BEN election. Current 2026 CRA material states a maximum $378 for each adult and child, with income testing based on family circumstances.

These formulas are calculation-sheet estimates only. CRA's assessment remains authoritative.

## Paper-package attachment matrix

| Item | Attach when applicable | Retain rather than routinely attach |
|---|---|---|
| T1 5006-R | Always | Other documents not specifically requested |
| ON428 | Always for the ordinary Ontario calculation, even when zero | Worksheet ON428 |
| T2203 | In place of ON428 for applicable multi-jurisdiction cases | Non-applicable T2203 parts |
| ON479 | Any refundable Ontario credit is claimed | Worksheet ON479 |
| ON479-A | CARE credit is claimed | Additional calculations unless requested |
| ON-BEN | Applying for OEPTC, NOEC, or OSHPTG | Rent, property-tax, energy, and ordinary residence-cost receipts |
| ON428-A | LIFT credit is claimed | — |
| ON(S2) | Spouse/partner transfer is claimed | Other supporting documents; attach spouse information slips if they do not file |
| ON(S11) | Ontario tuition/education carryforward is claimed | Tuition supporting documents |
| T2036 | Provincial foreign tax credit is claimed | — |
| T1221 and T101/T5013 copies | Focused flow-through share credit is claimed | — |
| Official Ontario political receipts | Political contribution credit is claimed | — |
| Separate ON-BEN residence sheet | Part B lacks space | — |
| Medical/fertility/transit/co-op evidence | Not routinely attached under the 2025 Ontario guide | Retain in case CRA requests it |

The final mailing address must come from the live [CRA paper-return mailing page](https://www.canada.ca/en/revenue-agency/corporate/contact-information/where-mail-your-paper-t1-return.html), not a hard-coded research snapshot.

## Special return conditions

- Use Ontario rules based on residence at the end of the year, with the specific emigrant and deceased-person dates defined in the 2025 guide.
- Newcomer and emigrant non-refundable credits can require federal/provincial proration.
- Bankruptcy rules differ by credit. The Ontario guide makes many refundable credits nil for a person bankrupt during 2025, disallows the Ontario tax reduction, and applies a combined-income rule to the health premium. ON-BEN accompanies the post-bankruptcy return.
- The final return for a deceased Ontario resident can claim the listed ON479 credits when the guide permits them, but an estate of a person who died on or before 2025-12-31 cannot receive the later ON-BEN payments.
- T1206 affects Ontario tax on split income; T691 affects Ontario minimum-tax calculations; T2036 affects the provincial foreign tax credit; Schedule 9 affects donations and the farmers' food-program credit.
- An Ontario Opportunities Fund donation is optional, reduces the refund through T1 line 46500, and is not an Ontario credit. The Ontario guide says donations below $2 are not processed.

## Conflicts and unresolved implementation gaps

1. **OTB small-entitlement threshold conflict.** The 2025 Ontario guide says a 2026 OTB entitlement of $360 or less is paid in July and the delayed-payment election does not apply. Newer 2026 CRA benefit calculation material uses $500 or less. Do not silently select one: pin the source and require current-instruction review.
2. **ON479 accessible-text field error.** The 2025 e-text labels political contributions with field 63100. The PDF, guide, and Worksheet ON479 use 63110. The PDF-confirmed field is 63110.
3. **ON428-A accessible-text formatting error.** The 2025 e-text prints the family threshold as `65,0000.00`; the CRA guide and Ontario source state $65,000. Use the PDF/year guide and treat the e-text string as a source defect.
4. **ON479-A accessible-text bracket error.** The e-text contains a mistyped transition around $132,000–$139,200. The official PDF shows $132,000–$135,600 at 9% and $135,600–$139,200 at 7%.
5. **ON-BEN is not an entitlement calculator.** CRA calculates benefits after filing; local results can only be labelled estimates.
6. **Older commencement dates.** The 2025 package confirms current credits but does not restate the original effective date for every continuing credit. Only the fertility credit's 2025-01-01 effective date was required and confirmed here.
7. **Live Ontario pages can move to later years.** For a 2025 return, the 2025 CRA package and PDFs control year-specific amounts.
8. **Mailing addresses change.** Resolve and require manual verification against the live CRA page at export/print time.
9. **No certification evidence.** No reviewed official source states that independently generated forms or calculations are CRA-certified.

## Official sources

All were accessed on 2026-08-14.

- [Ontario — 2025 income tax package](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario.html)
- [Ontario tax information for 2025](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-pc.html)
- [2025 ON428 PDF](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-c/5006-c-25e.pdf)
- [2025 Worksheet ON428 PDF](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-d/5006-d-25e.pdf)
- [2025 ON479 PDF](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-tc/5006-tc-25e.pdf)
- [2025 Worksheet ON479 PDF](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-d1/5006-d1-25e.pdf)
- [2025 ON479-A PDF](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-tca/5006-tca-25e.pdf)
- [2025 ON-BEN PDF](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-tg/5006-tg-25e.pdf)
- [2025 ON428-A PDF](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-a/5006-a-25e.pdf)
- [2025 ON(S2) PDF](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-s2/5006-s2-25e.pdf)
- [2025 ON(S11) PDF](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-s11/5006-s11-25e.pdf)
- [CRA line 42800 — provincial or territorial tax](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-42800-provincial-territorial-tax.html)
- [CRA line 47900 — provincial or territorial credits](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-47900-provincial-territorial-credits.html)
- [CRA provincial and territorial tax and credits for individuals](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/provincial-territorial-tax-credits-individuals.html)
- [CRA T2203](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t2203.html)
- [CRA paper-return mailing destinations](https://www.canada.ca/en/revenue-agency/corporate/contact-information/where-mail-your-paper-t1-return.html)
- [CRA 2026 OEPTC calculation sheets](https://www.canada.ca/en/revenue-agency/services/child-family-benefits/provincial-territorial-programs/ontario-energy-property-tax-credit-oeptc-calculation-sheets/2026-ontario-energy-property-tax-credit-calculation-sheets.html)
- [CRA 2026 OEPTC single non-senior calculation sheet](https://www.canada.ca/content/dam/cra-arc/serv-info/benefits/ptc26_clc_sns-eng.pdf)
- [CRA 2026 OEPTC single senior calculation sheet](https://www.canada.ca/en/revenue-agency/services/child-family-benefits/provincial-territorial-programs/ontario-energy-property-tax-credit-oeptc-calculation-sheets/2026-ontario-energy-property-tax-credit-calculation-sheets/2026-ontario-energy-property-tax-credit-calculation-sheet-single-senior-no-children.html)
- [CRA 2026 NOEC calculation sheets](https://www.canada.ca/en/revenue-agency/services/child-family-benefits/provincial-territorial-programs/2026-northern-ontario-energy-credit-noec-calculation-sheets.html)
- [CRA OSHPTG questions and answers](https://www.canada.ca/en/revenue-agency/services/child-family-benefits/provincial-territorial-programs/ontario-senior-homeowners-property-tax-grant-oshptg-questions-answers.html)
- [CRA Ontario Sales Tax Credit seniors' threshold questions and answers](https://www.canada.ca/en/revenue-agency/services/child-family-benefits/provincial-territorial-programs/province-ontario/ostc-seniors-income-threshold-qa.html)
- [Ontario: filing your personal income tax return](https://www.ontario.ca/document/filing-your-personal-income-tax-return)
- [Ontario health premium](https://www.ontario.ca/page/health-premium)
- [Ontario Fertility Treatment Tax Credit](https://www.ontario.ca/page/ontario-fertility-treatment-tax-credit)
- [Ontario Seniors Care at Home Tax Credit](https://www.ontario.ca/seniorscareathome)
- [Ontario Seniors' Public Transit Tax Credit](https://www.ontario.ca/page/ontario-seniors-public-transit-tax-credit)
- [Ontario political contribution tax credit for individuals](https://www.ontario.ca/page/political-contribution-tax-credit-individuals)
- [Ontario focused flow-through share tax credit](https://www.ontario.ca/page/ontario-focused-flow-through-share-tax-credit)
- [Ontario co-operative education tax credit](https://www.ontario.ca/page/co-operative-education-tax-credit)
- [Community food program donation tax credit for farmers](https://www.ontario.ca/page/community-food-program-donation-tax-credit-farmers)
- [Ontario Trillium Benefit](https://www.ontario.ca/page/ontario-trillium-benefit)
- [Ontario Guaranteed Annual Income System](https://www.ontario.ca/page/guaranteed-annual-income-system-payments-seniors)
- [Ontario Opportunities Fund](https://www.ontario.ca/page/ontario-opportunities-fund)
