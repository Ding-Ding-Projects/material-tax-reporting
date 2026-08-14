# Ontario 2025 personal-income inputs and credits: official-source implementation inventory

Accessed: **2026-08-14**  
Primary tax year: **2025**  
Jurisdiction: **Canada — Ontario resident on 2025-12-31**

This document is factual implementation research for preparing a 2025 Ontario T1 Individual Income Tax and Benefit Return from official Government of Canada and Government of Ontario sources. It is not tax or legal advice, it is not a substitute for the current forms and guides, and it does not represent Canada Revenue Agency certification or approval.

The companion structured record is [`ontario-2025-income-credits.v1.json`](./ontario-2025-income-credits.v1.json).

## Product boundary: paper package only

The application must not implement, offer, advertise, simulate, or imply NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing. Its terminal output is a **CRA mail-in PDF package**.

Export and print must remain locked until the user manually inspects and explicitly acknowledges all of the following:

1. every populated form and schedule;
2. every calculation and transferred amount;
3. every required attachment and every item that must instead be retained;
4. the current mailing destination selected for the taxpayer's location; and
5. every signature and date field.

That acknowledgement workflow is a product requirement, not a claim that CRA prescribes this exact software interaction. CRA's separate official facts are that a paper return is sent by mail, that the applicable provincial package is based on province or territory of residence on December 31, and that the return must include the supporting documents, forms, and schedules requested by the current guide. Mailing destinations are mutable and location-dependent; the application must present the current official address source during review and require the user to verify it instead of silently relying on a stored universal address.

## Evidence conventions

- A mapping below appears only when an official source states the box, line, schedule, or calculation.
- `Conditional` means the official source directs the user to different destinations based on facts not established by the slip alone.
- A form filename ending in `-25e` or a page labelled 2025 is recorded as the 2025 edition. No revision is inferred where the official page did not expose one.
- Unless a specific rule says otherwise, the 2025 federal guide says to keep the return, notices of assessment or reassessment, and supporting documents for six years. Attachment rules remain form-specific.
- Current forms, thresholds, addresses, deadlines, and eligibility must be re-confirmed when a different tax year is selected.

## 2025 return package and paper assembly

| Item | Official fact for implementation | Paper-package handling |
|---|---|---|
| T1 package | Use the package for the province or territory where the individual resided on 2025-12-31. Ontario tax is calculated on Form ON428 after the federal return steps identified in the Ontario guide. | Include the completed T1 and every applicable completed form or schedule requested by the guide. |
| Information slips | The federal guide names slips such as T4, T4A, and T5 as supporting documents for a paper return. | Attach the required copies. Keep originals and retained documents for the applicable retention period. |
| Missing slip | The guide permits an estimate from a final pay stub or statement after reasonable attempts to obtain the slip. | Attach the pay stub or statement and a note identifying the payer, address, income type, and efforts made to obtain the slip. Keep originals. |
| Forms not in some mailed packages | CRA says mailed packages omit Schedules 2, 3, 5, 6, 7, 9, 11, 12, 13, and 15. | Download or order every applicable omitted schedule before the package is finalized. |
| Mailing | CRA's paper-filing page says mail is the only way to send a paper return. As observed on 2026-08-14, CRA routed Hamilton, Kitchener, Waterloo, London, Thunder Bay, and Windsor to Winnipeg, and Barrie, Belleville, Kingston, Ottawa, Peterborough, St. Catharines, Sudbury, and Toronto to Sudbury. | Treat that city list as source-dated routing, not a permanent address table. During mandatory review, open the current official address page, show the selected city/address pair, and require acknowledgement. An unmatched Ontario location remains unresolved. |
| Separate taxpayers | CRA says to use a separate envelope for each person; current and late returns for one person may be mailed together. | The package builder must not combine different taxpayers in one mailing envelope. |
| Signatures | The current T1 package determines which signature and date fields apply. | Surface every signature/date field in manual review and block export/print until acknowledged; never auto-sign. |

## Income slips and receipts

### Core slips

| Slip or receipt | Official 2025 box-to-return mapping | Eligibility, calculation, and documentation boundaries |
|---|---|---|
| **T4 — Statement of Remuneration Paid**, T4(25) | 14→10100; 16/17→Schedule 8 or RC381, then 30800 and 22215; 16A/17A→Schedule 8 or RC381 for 22215; 18→31200; 20→20700; 22→43700; 39/41/91/92→24900; 42→10120 but is included in 14; 43→24400 but is included in 14; 44→21200; 46→Schedule 9; 52→20600; Ontario box 55→31200; 66/67→13000; 74/75→20700; 77→22900. | Several other boxes require a dedicated schedule or factual classification. Do not generically map them from the box number. Attach the slip copy to a paper return under the general guide. |
| **T4A — Statement of Pension, Retirement, Annuity, and Other Income**, T4A(25) | 016→11500; 020→13899/13900; 022→43700; 032→20700; 034→20600; 040/042→13000; 046→Schedule 9; 048→the applicable self-employment gross/net lines 13499–14300; 105→13010; 131→12500; 196→25600. | Conditional: 018, 024, 028, 104, 106, 107, 109, 117–119, 123, 125, 127, 129, 130, 132, 133, 136, 150, 152, 154, 156, and 194 depend on income type, age, beneficiary status, or business classification. Preserve the official conditional routing rather than selecting one default line. |
| **T4A(P) — Statement of Canada Pension Plan Benefits** | 20→11400 and already includes boxes 14–19; 16→11410 and must not be added again to 20; 22→43700. | Box 18 can be estate-beneficiary income reported at 13000. For a qualifying retroactive lump sum, report the full amount at 11400; if the required prior-year breakdown is not printed on the slip, attach the Service Canada breakdown. Blank-form revision was not verified. |
| **T4A(OAS) — Statement of Old Age Security** | 18→11300; 20→23200; 21→14600, with a possible deduction at 25000; 22/23→43700 for an Ontario return. | Box 21 treatment depends on the benefit type and the current line-25000 rules. Blank-form revision was not verified. |
| **T4E — Statement of Employment Insurance and Other Benefits** | 11900 = box 14 minus tax-exempt box 18; 36/37→11905 and are already included in 14; 21→25600; 22→43700; box 30 refers to 23200. | Box 7 controls the benefit-repayment calculation. Do not treat box 30 as ordinary EI income. Blank-form revision was not verified. |
| **T5 — Statement of Investment Income**, 2025 edition | 11→12000 and 12010; 12→40425; 13/14/15→12100; 16→foreign-tax-credit calculation; 18→Schedule 3 line 17400; 25→12000; 26→40425; 30→12100. | Box 17 routes to 10400, 13500, or 12100 according to the royalty facts. Box 19 routes to 11500 only under the official age/death-of-spouse conditions; otherwise 12100. |
| **T3 — Statement of Trust Income Allocations and Designations**, 2025 edition | 32+50→12000; 32→12010; 39+51→40425; 21−30→Schedule 3 line 17600; 31→11500; 34→T2209 line 43100; 37→Schedule 3 line 17600; 38→45600; 25→12100 and T2209 line 43300; 26−31→13000. | Box 42 is a cost-base adjustment, not ordinary income. The subtraction mappings must remain calculations and must not be replaced by copying one box. |
| **T5008 — Statement of Securities Transactions** | Capital-account transactions→Schedule 3; income-account transactions→self-employment line 13500; bearer-debt interest→12100. Box 20 supplies a reported cost or book value and box 21 supplies proceeds. | CRA warns that box 20 may not equal adjusted cost base. The application must not compute a gain automatically from boxes 20 and 21 without the user's reviewed ACB and classification. |
| **T2202 — Tuition and Enrolment Certificate** | 21/22 are part-time/full-time months; 23 is session tuition; 24/25 are totals; 26 is total eligible tuition. Schedule 11 carries the calculation to 32300. | Attach Schedule 11, not T2202, to the paper return. Retain T2202. Current-year transfer and carry-forward rules are described under Tuition below. Blank-form revision was not verified. |
| **RRSP contribution receipt** | Total contributions→Schedule 7 line 24500; claimed deduction→20800. | The contributor, not necessarily the annuitant, reports the receipt. For 2025, attach receipts covering 2025-03-04 through 2026-03-02, including amounts not deducted and amounts designated as HBP/LLP repayments, and attach Schedule 7 when required. |

### Other common or conditional records

| Record | Official mapping or use | Boundary |
|---|---|---|
| T4RSP | Boxes 16, 18, 28, and 34→12900; boxes 20, 22, and 26 also enter 12900 unless spousal-attribution rules apply. Withholding in box 30→43700. | A negative box 28 amount may be a deduction at 23200. Attribution and death-related rules require current Guide T4040 facts. |
| T4RIF | Amounts can route to 11500, 13000, or a deduction at 23200. | Age, spouse/common-law partner death, beneficiary status, and negative amounts control the destination; no universal box-to-line shortcut is safe. |
| T5007 | Box 10→14400 and deduction 25000; box 11→14500 and deduction 25000. | For workers' compensation, the spouse/common-law partner reporting rule depends on cohabitation and net income; ties use the person named on the slip. |
| T5013 | Box 209→45600; box 236→47555. | The remaining boxes are conditional partnership allocations and require T5013-INST and the applicable business, investment, capital-gain, or credit schedule. |
| PRPP receipt | Current and first-60-day periods feed Schedule 7 lines 2 and 3; employer contributions can feed 20810. | Confirm whether the amount is an individual, employer, or designated repayment amount. |
| RC62 | Universal child care benefit income→11700; repayment→21300. | Relevant only where a taxpayer received or repaid this legacy benefit. |
| T4PS | Boxes 25+31→12000; box 25→12010; box 35→10400. | Other boxes and employee-profit-sharing-plan facts remain conditional. |
| T4FHSA, T4FHSA(25) | 18→Schedule 15 line 68935; 20→68960; 22→12905; 24→12906; 26→12905 or 12906 conditionally; 28→12906 and may later support 23200; 30→43700; 32+34→68950; 36→68955; 38→68945. | Qualifying withdrawals are excluded from taxable withdrawal income. Schedule 15 is required for the official listed FHSA activity triggers. Preserve the conditional treatment of boxes 26 and 28. |
| T4A-RCA | Boxes 14/16/18/20 can route to 13000 under the current retirement-income table. | RCA distributions and withholding require the official slip instructions; no broader mapping is asserted here. |
| T5018, T1204, NR4 | Potentially relevant to construction payments, government service contracts, or non-resident income. | Dedicated official mappings were not completed in this inventory. Do not infer a T1 line from the amount alone. |

## Deductions and credits

| Topic | Official 2025 route | Eligibility and paper-document boundary |
|---|---|---|
| **Employment expenses** | Form T777 calculation→22900; Guide T4044 covers salaried/commission employees, tradespersons, forestry workers, employed artists and musicians, and transport employees. TL2 applies to qualifying transport employees; GST370 may apply to employee GST/HST rebates. | Employer certification on T2200/T2200S is retained, not attached; T777 is attached to a paper return. Keep receipts and logs. A T2200 certification does not itself establish deductibility. |
| **Pension income splitting** | Form T1032 E(25) starts with eligible pension income from the line-31400 worksheet. Form line 22 is deducted by the transferor at 21000 and reported by the recipient at 11600; the form also adjusts tax withheld at 43700. | Both spouses/common-law partners must meet the relationship, residence, and separation rules and complete and sign the annual joint election. Attach a signed copy to each paper return. The elected amount is capped by the official form calculation. |
| **Medical expenses** | 33099 covers the taxpayer, spouse/common-law partner, and children under 18; 33199 covers other dependants. The 2025 federal threshold uses the lesser of 3% of line 23600 or $2,834. Ontario counterparts are ON428 lines 58689 and 58729. | Use an eligible 12-month period ending in 2025 and do not claim the same expense twice. Keep prescriptions, receipts, certificates, and travel support; supply them only when the current paper instructions require or CRA requests them. Eligibility is item-, patient-, payment-, and date-specific. |
| **Donations and gifts** | Schedule 9→34900; Ontario Form ON428 line 58969. | Official receipts are required. Most unclaimed amounts can carry forward five years; ecological gifts have the longer official carry-forward period. Claim limits and special categories remain Schedule 9 calculations. |
| **Disability tax credit** | Federal: 31600 for self; 31800 for an eligible dependant transfer; 32600 for an eligible spouse/common-law partner transfer. Ontario ON428 E(25): 58440 for self (the form uses $10,298 or its worksheet when under 18) and 58480 for a transfer. | CRA approval of Form T2201 is required. When the transfer instructions require a note instead of attaching T2201, include the dependant's name, SIN, relationship, and other requested facts. Do not infer approval from diagnosis or expenses. The exact 2025 T2201 blank-form revision was not verified. |
| **Canada caregiver amount** | Schedule 5 E(25) calculates lines 30300, 30400, 30425, 30450, and 30500 as applicable. Ontario routes include ON428 line 58185 and, where applicable, transfer line 58480. | Dependency, infirmity, residence, support, shared-custody, duplicate-claim, household, family-status, and net-income rules apply. Temporary illness is not automatically an infirmity. For 30425 in 2025, the official page describes the net-income calculation range $8,624–$28,798. A medical-practitioner statement may be required; an approved T2201 may satisfy the impairment evidence rule. Attach Schedule 5. One claimant cannot split the same 30425 amount with another person. |
| **Amount for an eligible dependant** | Schedule 5→30400. | The taxpayer generally must be unmarried/not living with a spouse or common-law partner, maintain a home, and support a related dependant living there, subject to the detailed exceptions and exclusions. Do not treat every dependant as eligible. |
| **Moving expenses** | Separate Form T1-M for each move; line 29 of T1-M→21900. Unused eligible amounts can carry forward where T1-M line 27 exceeds line 28. | Generally requires an eligible student or a move to work/carry on business that makes the new home at least 40 km closer by the official shortest-normal-route test. Do not send receipts with the return; keep them. |
| **Child care expenses** | T778 E(25) line 14, or Part D line 25 where applicable,→21400. | The lower-net-income spouse/common-law partner generally claims, subject to the form's exceptions. Eligible child/provider/expense rules and earned-income limits apply. Attach T778 to a paper return; do not attach receipts or other supporting documents, but retain them and retain the provider's SIN when the provider is an individual. No 2025 amount carries forward. |
| **Tuition** | Federal Schedule 11 E(25): 32000 Canadian tuition, 32001 foreign tuition, 32300 amount claimed, 32700 transfer, 45350 Canada training credit, and line 25 unused carryforward. Ontario Schedule 11 E(25): line 5→ON428 line 58560 and line 8 records unused Ontario carryforward. A child/grandchild recipient reports a designated federal transfer at 32400. | Current-year transfer is limited to the official maximum less the amount the student must use. Prior-year carryforwards cannot be transferred. Attach the applicable schedules and retain T2202, TL11A/TL11C, and receipts. File Schedule 11 even where no tax is payable if an amount is to be carried forward; the student signs the designation and the recipient does not attach the student's Schedule 11. |

## Registered plans: RRSP, FHSA, HBP, and LLP

| Plan/activity | Official route | Boundary and documentation |
|---|---|---|
| RRSP deduction | Schedule 7 E(25): total contributions→24500; HBP repayment→24600; LLP repayment→24620; eligible transfer→24640; deduction→20800; T4RSP HBP withdrawal box 27→24700; LLP withdrawal box 25→26300; spouse/student LLP amount→26400. The 2025 contribution deadline is 2026-03-02. | Deduction room, unused contributions, transfers, spousal plans, excess amounts, and designated repayments must remain separate. Attach Schedule 7 and required receipts covering 2025-03-04 through 2026-03-02. |
| FHSA deduction | Schedule 15 E(25) determines the deductible amount at 20805. The official 2025 sources state first-year participation room of $8,000 and a $40,000 lifetime deduction limit. | Opening, contributing, transferring, withdrawing, or a cessation event can trigger Schedule 15. RRSP-to-FHSA transfers are not deductible and reduce lifetime capacity. Attach Schedule 15 when applicable. A qualifying withdrawal is not established by the slip alone. |
| Home Buyers' Plan | The official HBP withdrawal limit is $60,000. Schedule 7 line 24600 records a designated repayment; a required shortfall is included at 12900, not deducted at 20800. Repayment is generally over 15 years. | First withdrawals made from 2022-01-01 through 2025-12-31 receive the official additional three-year repayment deferral. Eligibility for withdrawal and repayment are separate. Use current CRA repayment information and the user's reviewed designation; do not infer a required amount from an RRSP receipt. |
| Lifelong Learning Plan | The official limits are $10,000 annually and $20,000 total. Schedule 7 line 24620 records a designated repayment; a required shortfall is included at 12900. Repayment is generally over 10 years. T4RSP box 25 and Schedule 7 line 26400 identify the withdrawal and spouse/student facts. | Student/enrolment eligibility, repayment start, and annual required amount remain conditional. File Schedule 7 from the first withdrawal until the plan is resolved as directed by the official rules. Use current CRA repayment information and retain designation evidence. |

## Mandatory pre-export review model

The application should generate a review manifest beside the proposed mail-in PDF package. Each row must show the populated form or schedule, source records, transferred lines, calculation result, attachment state, signature/date state, and official source. The user must be able to inspect each rendered page before acknowledging it.

Minimum fail-closed states:

- unresolved conditional mapping;
- unsupported or missing slip box;
- missing required form/schedule or attachment;
- a document marked both “attach” and “retain only”;
- unreviewed adjusted cost base or capital-versus-income classification;
- unreviewed dependant, spouse, age, residence, disability-approval, or practitioner-certification condition;
- missing signature/date acknowledgement;
- mailing destination not freshly verified against the official address page; or
- any attempt to invoke an electronic filing or direct-transmission capability.

## Official source register

All sources were accessed 2026-08-14.

### Return, Ontario, paper, and records

- [2025 Federal Income Tax and Benefit Guide (5000-G)](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-g.html)
- [General income tax and benefit package](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package.html)
- [File income tax by paper](https://www.canada.ca/en/services/taxes/income-tax/personal-income-tax/how-file/paper.html)
- [Where to mail a paper T1 return](https://www.canada.ca/en/revenue-agency/corporate/contact-information/where-mail-your-paper-t1-return.html)
- [Ontario information guide, 2025 (5006-PC)](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-pc.html)
- [Ontario tax and credits forms, 2025 (5006-R; page last updated 2026-01-20)](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-r.html)
- [Ontario 2025 income tax package](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario.html) and [T1 5006-R E(25) plain text](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-r/5006-r-25e.txt)

### Slips and receipts

- [T4 form page](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t4.html) and [T4 slip guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t4-slips/t4-statement-remuneration-paid.html)
- [T4A form page](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t4a.html) and [T4A slip guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t4-slips/t4a-slip.html)
- [T4A(P) slip guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t4-slips/t4a-p-statement-canada-pension-plan-benefits.html) and [line 11400](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/personal-income/line-11400-cpp-qpp-benefits.html)
- [T4A(OAS) slip guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t4-slips/t4a-oas-statement-old-security.html)
- [T4E slip guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t4-slips/t4e-statement-employment-insurance-other-benefits.html)
- [T5 form page](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t5.html) and [T5 slip guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t5-slips/t5-statement-investment-income-slip-information-individuals.html)
- [T3 form page](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t3.html) and [T3 slip guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t3-statement-trust-income-allocations-designations-slip-information-individuals.html)
- [T5008 slip guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t5-slips/t5008-statement-securities-transactions-slip-information-individuals.html/1000?wbdisable=true) and [Guide T4091](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4091/t5008-guide-return-securities-transactions.html)
- [T2202 slip guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t2202-tuition-enrolment-certificate.html)
- [RRSP contribution receipt guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/rrsp-contribution-receipt-slip-information-individuals.html)
- [T4RSP income](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/personal-income/line-129-registered-retirement-savings-plan-rrsp-income.html)
- [T4RIF slip guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t4-slips/t4rif-statement-income-a-registered-retirement-income-fund-slip-information-individuals.html)
- [T5007 benefits](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/statement-benefits-t5007.html)
- [PRPP contribution receipt](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/pooled-registered-pension-plan-prpp-information-individuals/prpp-contribution-receipt-slip.html)
- [T4FHSA form page](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t4fhsa.html) and [report FHSA activities](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/first-home-savings-account/reporting-fhsa-activities-income-benefit-return.html)
- [T4A-RCA form page](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t4a-rca.html)

### Deductions, credits, and plans

- [Guide T4044, Employment Expenses](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4044/employment-expenses.html) and [line 22900](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-22900-other-employment-expenses.html)
- [Form T1032, Joint Election to Split Pension Income](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t1032.html) and [T1032 E(25) plain text](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/t1032/t1032-25e.txt)
- [Medical expenses, lines 33099 and 33199](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/lines-33099-33199-eligible-medical-expenses-you-claim-on-your-tax-return.html)
- [Schedule 9 E(25)](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5000-s9/5000-s9-25e.txt) and [donations and gifts, line 34900](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-34900-donations-gifts.html)
- [Claiming the disability tax credit](https://www.canada.ca/en/revenue-agency/services/tax/individuals/segments/tax-credits-deductions-persons-disabilities/disability-tax-credit/claiming-dtc.html) and [line 31800](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-31800-disability-amount-transferred-a-dependant.html)
- [Schedule 5 E(25)](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5000-s5/5000-s5-25e.txt) and [Canada caregiver amount](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/canada-caregiver-amount.html)
- [Amount for an eligible dependant, line 30400](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-30400-amount-eligible-dependant/you-claim-amount-eligible-dependant-line-30400.html)
- [Moving expenses, line 21900](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-21900-moving-expenses.html)
- [Child care expenses, line 21400](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-21400-child-care-expenses/how-claim.html) and [Form T778](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t778.html)
- [Federal Schedule 11 E(25)](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5000-s11/5000-s11-25e.txt), [Ontario Schedule 11 E(25)](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-s11/5006-s11-25e.txt), [tuition, line 32300](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-32300-your-tuition-education-textbook-amounts.html), and [transfer/carry-forward rules](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-32300-your-tuition-education-textbook-amounts/transferring-carrying-forward-amounts.html)
- [RRSP deduction, line 20800](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-20800-rrsp-deduction.html) and [Guide T4040](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4040/rrsps-other-registered-plans-retirement.html)
- [FHSA deduction, line 20805](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-20805-fhsa-deduction.html)
- [Schedule 7 E(25)](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-s7.html), [Home Buyers' Plan](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/rrsps-related-plans/what-home-buyers-plan.html), [HBP repayments](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/rrsps-related-plans/what-home-buyers-plan/repay-funds-withdrawn-rrsp-s-under-home-buyers-plan.html), and [report HBP repayments](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/rrsps-related-plans/what-home-buyers-plan/report-repayments-on-your-income-tax-benefit-return.html)
- [Lifelong Learning Plan](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/rrsps-related-plans/lifelong-learning-plan.html), [LLP participation](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/rrsps-related-plans/lifelong-learning-plan/participate.html), and [LLP repayments](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/rrsps-related-plans/lifelong-learning-plan/repayments-your-rrsp-under.html)

## Unresolved or intentionally conditional boundaries

1. Blank-form revision identifiers were not verified for T4A(P), T4A(OAS), T4E, T2202, T4RSP, T4RIF, T5007, and some conditional slips. The application must not manufacture them.
2. T4A, T5013, T4RIF, T4PS, T5018, T1204, and NR4 contain fact-dependent routes that cannot be reduced safely to one generic income line.
3. T5008 cannot establish adjusted cost base or capital-versus-income treatment by itself.
4. CRA mailing destinations can change and depend on the taxpayer's city and return type. They must be checked against the live official address page during manual review.
5. Current CRA account values are needed for RRSP deduction room and required HBP/LLP repayments; this inventory does not invent or estimate them.
6. A slip or receipt is evidence, not proof that every statutory eligibility condition for a deduction or credit is met.
7. This inventory is 2025-specific. It must not be silently reused for another tax year without a new official-source pass.
