# Ontario 2025 rates and calculation research

Access date: 2026-08-14

Scope: official Canada Revenue Agency, Government of Canada, and Ontario government sources for Ontario personal income tax calculations for the 2025 tax year. This is research for a future paper-only CRA mail-in PDF package generator. It is not tax, accounting, or legal advice, and it is not a CRA certification, approval, or filing-service analysis.

## Product boundary

The future product must stop at a paper PDF package that the user reviews, prints, signs where required, and mails themselves. It must not offer, advertise, simulate, or imply electronic filing, direct CRA transmission, automatic filing, or CRA acceptance. Every populated calculation, form, attachment, mailing destination, signature field, and date field must be reviewed by the user before export or print.

Mailing-office selection must remain a dynamic official-source lookup. Ontario mailing destinations depend on resident or non-resident status and the relevant Ontario area. The application must not hardcode a default Ontario mailing address.

## Official package and status

The Canada Revenue Agency page "Ontario - 2025 Income tax package" is the official package index for Ontario 2025 returns. It lists the Ontario return package, provincial Form ON428, Worksheet ON428, Ontario information guide, Form ON479, Worksheet ON479, Form ON-BEN, Schedule ON428-A, Schedule ON479-A, Schedule ON(S2), and Schedule ON(S11), among other federal schedules. The package and most component pages observed for 2025 carry page date or last update 2026-01-20.

The latest supported tax year for this research is 2025. The official 2025 Ontario package was final and published before the 2026 filing season; later-year values must not be backfilled into 2025 parameters.

## Residence and business-allocation boundaries

Use the Ontario package only when the official package-selection rules point to Ontario. The Ontario information guide states that ON428 applies when the taxpayer was a resident of Ontario on December 31, 2025. It also refers emigrants to the province or territory of residence on the date they left Canada.

Important boundary: the Ontario guide says that if the person resided in Ontario on December 31, 2025, or on the date they left Canada if they emigrated in 2025, and all or part of their 2025 business income was earned and can be allocated to a permanent establishment outside Ontario, Form T2203 is used instead of Form ON428. The future product must treat that as a hard eligibility/routing branch and must not apply the simple ON428-only flow in those cases.

## Ontario tax brackets and rates

Form ON428, Part A, calculates Ontario tax on taxable income from line 26000 of the return. The official 2025 brackets are:

| Taxable income band | Rate | Base tax carried into band |
| --- | ---: | ---: |
| $0 to $52,886 | 5.05% | $0 |
| Over $52,886 to $105,775 | 9.15% | $2,671 |
| Over $105,775 to $150,000 | 11.16% | $7,510 |
| Over $150,000 to $220,000 | 12.16% | $12,446 |
| Over $220,000 | 13.16% | $20,958 |

Line mapping from ON428:

- Line 1: taxable income from line 26000 of the return.
- Lines 2 to 30: bracket-specific calculations.
- Line 31: Ontario tax on taxable income.

The line amounts above are form constants for 2025 and should be stored as official form constants, not recomputed from rounded intermediate values unless a future implementation explicitly matches the official form's rounding sequence.

## Ontario non-refundable tax credits

Form ON428 applies the 5.05% Ontario credit rate to the total Ontario non-refundable tax credits. Core line mappings and constants observed on ON428 and Worksheet ON428 include:

| ON428 line | Item | 2025 amount/rule captured |
| ---: | --- | --- |
| 58040 | Basic personal amount | $12,747 |
| 58080 | Age amount | Up to $6,223, reduced by the Worksheet ON428 age-amount calculation |
| 58120 | Spouse or common-law partner amount | Maximum $10,823, reduced by the spouse or common-law partner net income rule on the form/worksheet |
| 58160 | Amount for an eligible dependant | Maximum $10,823, reduced by dependant net income rule on the form/worksheet |
| 58200 | Amount for infirm dependants age 18 or older | Worksheet/form-driven |
| 58240 | CPP or QPP contributions through employment | From the return/schedules as instructed |
| 58280 | CPP or QPP contributions on self-employment and other earnings | From federal Schedule 8 / RC381 flow as instructed |
| 58300 | Employment insurance premiums through employment | From the return/schedules as instructed |
| 58305 | Provincial parental insurance plan premiums paid | From the return/schedules as instructed |
| 58310 | PPIP premiums payable on employment income | From the return/schedules as instructed |
| 58315 | PPIP premiums payable on self-employment income | From the return/schedules as instructed |
| 58330 | Adoption expenses | Maximum $14,951 |
| 58360 | Pension income amount | Form/worksheet-driven |
| 58440 | Disability amount for self | Form/worksheet-driven |
| 58480 | Disability amount transferred from a dependant | Form/worksheet-driven |
| 58560 | Unused tuition and education amounts | From Schedule ON(S11) |
| 58640 | Amounts transferred from spouse or common-law partner | From Schedule ON(S2) |
| 58689 | Medical expenses for self, spouse/common-law partner, and dependent children | Eligible medical expenses minus the lesser of 3% of net income or $2,834 |
| 58729 | Allowable medical expenses for other dependants | Maximum $15,046 per eligible dependant calculation |
| 58969 | Donations and gifts | Worksheet/form-driven |

ON428 totals the applicable amounts, multiplies the total by 5.05%, and applies the result as Ontario non-refundable tax credits. The implementation must keep line references and source-form ownership because several values are imported from federal schedules or Ontario schedules rather than calculated in ON428 itself.

## Ontario dividend tax credit

Worksheet ON428 provides the official 2025 calculation for the Ontario dividend tax credit:

- Other-than-eligible dividends: 2.9863% of the taxable amount of dividends other than eligible dividends, using the official dividend line imported from the federal return.
- Eligible dividends: 10% of the taxable amount of eligible dividends, using the official dividend line imported from the federal return.

The ON428/Worksheet ON428 relationship should be modelled as a worksheet-derived credit, not as an independent input. The source is Worksheet ON428, 2025, from the CRA Ontario package.

## Ontario additional tax for minimum tax

Worksheet ON428 contains the complete Ontario additional tax for minimum tax purposes calculation for ON428 line 72. Complete this calculation only if the taxpayer entered an amount on line 11 of Part 5 of Form T691.

Line mapping from Worksheet ON428, line 72:

- Line 1: amount from line 11 of Part 5 of Form T691 multiplied by 24.63%; this is the Ontario basic additional tax.
- Line 2: amount from line 65 of Form ON428.
- Line 3: line 1 plus line 2.
- If line 3 is not more than $5,710, enter line 1 on line 72 of Form ON428.
- If line 3 is more than $5,710, complete lines 4 to 9.
- Line 4: line 3 minus $5,710, multiplied by 20%, with a zero floor.
- Line 5: line 3 minus $7,307, multiplied by 36%, with a zero floor.
- Line 6: line 4 plus line 5. These surtax components are additive; the 36% component does not replace the 20% component.
- Line 7: amount from line 68 of Form ON428.
- Line 8: line 6 minus line 7.
- Line 9: line 1 plus line 8. Enter this amount on line 72 of Form ON428.

Eligibility boundary: do not run this ON428 line-72 calculation unless Form T691 Part 5 line 11 supplies an amount. If the taxpayer is routed away from the ordinary ON428 flow, such as because Form T2203 applies for business income allocable to a permanent establishment outside Ontario, the future product must use the applicable official special-form flow instead of applying this ON428-only worksheet calculation.

## Ontario surtax

Form ON428 calculates Ontario surtax after Ontario tax payable before surtax is determined. The final 2025 ON428 e-text/PDF line mapping is:

- Line 65: Ontario tax payable before surtax.
- Line 66: if line 65 is more than $5,710, calculate 20% of the amount over $5,710; otherwise enter $0.
- Line 67: if line 65 is more than $7,307, calculate 36% of the amount over $7,307; otherwise enter $0.
- Line 68: Ontario surtax; line 66 plus line 67.

Implementation note: line 66 and line 67 are additive. A taxpayer above the second threshold has both the 20% surtax component and the 36% surtax component. Do not treat the second threshold as replacing the first.

## Ontario tax reduction

Form ON428 includes the Ontario tax reduction after line 65 is established. The observed 2025 ON428 constants are:

- Basic reduction amount: $294.
- Additional reduction amount: $544 for each eligible dependant claimed through the form's reduction calculation.

The reduction uses the official ON428 line sequence and can reduce eligible Ontario tax in that section to zero but must not be allowed to create a negative tax amount unless the official form line does so. Store line mappings from the form rather than modelling it as a free-standing refundable credit.

## Ontario Health Premium

Form ON428 calculates the Ontario Health Premium on line 89 using taxable income. The official 2025 piecewise chart is:

| Taxable income | Ontario Health Premium |
| --- | ---: |
| $20,000 or less | $0 |
| Over $20,000 to $25,000 | 6% of taxable income over $20,000 |
| Over $25,000 to $36,000 | $300 |
| Over $36,000 to $38,500 | $300 plus 6% of taxable income over $36,000 |
| Over $38,500 to $48,000 | $450 |
| Over $48,000 to $48,600 | $450 plus 25% of taxable income over $48,000 |
| Over $48,600 to $72,000 | $600 |
| Over $72,000 to $72,600 | $600 plus 25% of taxable income over $72,000 |
| Over $72,600 to $200,000 | $750 |
| Over $200,000 to $200,600 | $750 plus 25% of taxable income over $200,000 |
| Over $200,600 | $900 |

Line mapping from ON428:

- Line 89: Ontario Health Premium from the chart.
- Line 90: Ontario tax payable; this incorporates Ontario tax plus surtax and the Ontario Health Premium according to the form's line sequence.

Implementation note: the Health Premium chart has flat plateaus and short phase-in bands. Do not simplify it as a single percentage or as a conventional marginal tax bracket table.

## Low-income Individuals and Families Tax (LIFT) Credit

Schedule ON428-A is the official 2025 LIFT schedule. It must be completed and attached to a paper return when applicable. Captured official mechanics:

- Employment income inputs: line 10100 and line 10400 of the return.
- Applicable rate: 5.05%.
- Maximum allowable credit: $875.
- Individual income threshold: $32,500.
- Family income threshold when there is a spouse or common-law partner: $65,000.
- Reduction rate: 5%.
- Result line: enter the calculated amount on line 62140 of Form ON428.

The schedule defines adjusted net income using line 23600 plus or minus specified RDSP, social benefit, and repayment lines. The implementation must follow Schedule ON428-A exactly and must not substitute ordinary net income where the schedule asks for adjusted net income.

## Ontario refundable credits and benefits

Form ON479 is the official 2025 Ontario Credits form. It calculates or collects Ontario refundable credits and maps them to the T1 provincial refundable-credit line flow.

Observed official ON479 line mappings include:

| ON479 line | Item |
| ---: | --- |
| 63050 | Ontario Childcare Access and Relief from Expenses (CARE) tax credit, from Schedule ON479-A |
| 63095 | Ontario seniors care at home tax credit |
| 63100 | Ontario seniors' public transit tax credit eligible transit amount |
| 63110 | Ontario political contributions made in 2025 |
| ON479 line 16 | Ontario political contribution tax credit, calculated using Worksheet ON479 unless contributions are $3,793 or more |
| 63220 / ON479 line 17 | Ontario focused flow-through share tax credit |
| 63300 / ON479 line 20 | Ontario co-operative education tax credit |
| 47900 | Ontario refundable credits total / amount carried to the return flow |

The official ON479 form states that these refundable credits can be claimed even if no tax is payable, and that Form ON479 must be attached to a paper return when these calculations apply.

### Ontario seniors care at home tax credit

The 2025 ON479 form contains a deterministic Ontario seniors care at home tax credit calculation:

- Line 3: medical expenses from line 58769 of Form ON428.
- Line 4: allowable percentage, 25%.
- Line 5: line 3 multiplied by 25%, maximum $1,500.
- Line 6: taxpayer net income from line 23600 of the return.
- Line 7: spouse or common-law partner net income from line 23600 of their return, if applicable.
- Line 8: family net income, line 6 plus line 7.
- If line 8 is $35,000 or less, enter the line 5 amount on line 13.
- If line 8 is more than $65,000, enter $0 on line 13.
- Otherwise, line 9 is $35,000, line 10 is line 8 minus line 9 with a zero floor, line 11 is 5%, line 12 is line 10 multiplied by 5%, and line 13 / line 63095 is line 5 minus line 12 with a zero floor.

### Ontario seniors' public transit tax credit

The 2025 ON479 form calculates the Ontario seniors' public transit tax credit on line 14. The form uses the amount paid in the year for eligible seniors' use of Ontario public transit services, capped at $3,000, entered at line 63100, multiplied by 15%.

### Ontario political contribution tax credit

The 2025 Ontario tax information page and Worksheet ON479 record total Ontario political contributions made in 2025 on Form ON479 line 63110. ON479 line 16 instructs the taxpayer to enter $1,666.82 when total contributions are $3,793 or more. If total contributions are less than $3,793, Worksheet ON479 supplies the calculation. The official Worksheet ON479 page is form 5006-D1, last update observed 2026-01-20, with direct PDF and e-text endpoints at:

- https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-d1/5006-d1-25e.pdf
- https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-d1/5006-d1-25e.txt

Worksheet ON479, line 16, uses line 63110 of Form ON479 as the contribution input and has three official 2025 columns:

| Contribution amount from ON479 line 63110 | Subtract | Rate | Add | Result |
| --- | ---: | ---: | ---: | --- |
| $500.05 or less | $0.00 | 75% | $0.00 | Enter line 7 on ON479 line 16 |
| More than $500.05 and not more than $1,666.82 | $500.05 | 50% | $375.03 | Enter line 7 on ON479 line 16 |
| More than $1,666.82 | $1,666.82 | 33.33% | $958.41 | Enter line 7 on ON479 line 16 |

The ON479 form itself caps line 16 at $1,666.82. The implementation should therefore store both the ON479 direct cap rule for contributions of $3,793 or more and the Worksheet ON479 tier calculation for lower contributions.

### Ontario focused flow-through share tax credit

The 2025 ON479 form calculates the Ontario focused flow-through share tax credit on line 17 / line 63220 as total expenses from Form T1221 multiplied by 5%.

### Ontario co-operative education tax credit

The 2025 ON479 form collects the number of eligible work placements on line 63260, whether the claim is as a partnership member on line 63265, and the nine-digit business number on line 63270 when applicable. The credit amount is entered on line 20 / line 63300, with a maximum of $3,000 per student.

The form gives these salary-and-wage rules for the 2024 taxation year:

- $600,000 or more: enter 25% of total eligible expenditures for all students on line 20.
- $400,000 or less: enter 30% of total eligible expenditures for all students on line 20.
- More than $400,000 but less than $600,000: use Worksheet ON479.

Worksheet ON479, line 20, supplies the phase-down calculation for each qualifying work placement that ended in 2025 when 2024 salaries and wages were between $400,000 and $600,000:

- Line 1: amount of eligible expenditures incurred in 2025 multiplied by 25%.
- Line 2: 5%.
- Line 3: amount A multiplied by 5%.
- Line 4: total salaries and wages paid in the 2024 taxation year.
- Line 5: $400,000.
- Line 6: line 4 minus line 5, zero floor.
- Line 7: $200,000.
- Line 8: line 6 divided by line 7.
- Line 9: 1.00.
- Line 10: amount from line 8.
- Line 11: line 9 minus line 10, zero floor.
- Line 12: line 3 multiplied by line 11.
- Line 13: line 1 plus line 12, maximum $3,000 per student.

### CARE tax credit

Schedule ON479-A is the official 2025 CARE schedule. It requires completion of Form T778 and uses the amount claimed on line 21400 before calculating CARE. The schedule:

- Defines eligible children and supporting persons.
- Calculates family adjusted income.
- Applies a credit rate table from 75% down to 0%.
- Enters the result on line 63050 of Form ON479.

Schedule ON479-A line mapping:

- Lines 1 to 4 calculate adjusted income for the taxpayer and, where applicable, supporting person(s): line 1 is net income from line 23600, line 2 is the child care expenses deduction from line 21400, line 3 is social benefits repayment from line 23500, and line 4 is lines 1 to 3 with a zero floor.
- Line 5 is family adjusted income, the sum of line 4 for the taxpayer and supporting person column(s).
- Line 6 is the child care expenses deduction from line 21400.
- Line 7 is 75% when family adjusted income on line 5 is zero; otherwise it is the applicable rate from the schedule table.
- Line 8 is line 6 multiplied by line 7 and is entered on ON479 line 63050.

Captured rate table boundaries from Schedule ON479-A:

- $0 to $20,000: 75%.
- Over $20,000 to $22,500: 73%.
- The rate decreases by two percentage points through the listed income bands.
- Over $146,400 to $150,000: 1%.
- Over $150,000: 0%.

The implementation must store the full table in machine parameters, not interpolate between endpoints.

### ON-BEN and Ontario Trillium Benefit

Form ON-BEN is part of the 2025 Ontario package and is used for the 2026 Ontario Trillium Benefit and Ontario Senior Homeowners' Property Tax Grant application flow. The form page is official and current for the 2025 package.

ON-BEN is an application form, not a deterministic entitlement worksheet. The form states that payments for these benefits are issued separately from the tax refund. It also states that when the taxpayer had a spouse or common-law partner on December 31, 2025, only one spouse or common-law partner can apply for the Ontario energy and property tax credit, the Northern Ontario energy credit, and the Ontario senior homeowners' property tax grant for both of them; if only one spouse or common-law partner was 64 years of age or older on December 31, 2025, that spouse or common-law partner must apply for those credits and the grant for both of them.

Official ON-BEN 2025 line mapping to capture in a paper package:

- Line 61020: tick to apply for the 2026 Ontario energy and property tax credit when the listed conditions apply, then complete Part A and Part B.
- Line 61040: tick to apply for the 2026 Northern Ontario energy credit when the listed Northern Ontario conditions apply, then complete Part A and Part B.
- Line 61060: choice to wait until June 2027 to receive the 2026 Ontario Trillium Benefit entitlement as one payment at the end of the benefit year instead of monthly payments from July 2026 to June 2027.
- Line 61070: tick to apply for the 2026 Ontario senior homeowners' property tax grant when age and principal-residence ownership/occupancy/property-tax conditions apply; enter property tax on line 61120 and complete Part B.
- Line 61080: tick when the taxpayer and spouse or common-law partner occupied separate principal residences for medical reasons and the taxpayer chooses to apply individually for the OEPTC, NOEC, or OSHPTG; complete Part C.
- Line 61100: total rent paid for the principal residence, including a private long-term care home, subject to the form's property-tax condition.
- Line 61120: total property tax actually paid for the principal residence in Ontario for 2025.
- Line 61140: tick when the taxpayer resided in a designated student residence in Ontario in 2025.
- Line 61210: home energy costs paid for the principal residence on a reserve in Ontario in 2025.
- Line 61230: accommodation paid for a public or non-profit long-term care home in Ontario in 2025.
- Part B residence table: address, postal code, number of months resident in 2025, amount paid for 2025, long-term-care-home checkbox, and landlord/municipality/supplier name.
- Part C: spouse or common-law partner address for involuntary separation where the medical-reasons condition applies.

This research does not calculate OTB or grant entitlement amounts from unofficial sources. CRA-administered benefit amounts can depend on family status, residency, occupancy/rent/property-tax facts, age, care-home or reserve residence facts, and later CRA assessment/benefit administration. A future implementation should capture the official ON-BEN fields and eligibility screens, then treat CRA-calculated benefit results as outside the paper income-tax calculation unless an official 2025 worksheet supplies deterministic line formulas.

## Rounding and form arithmetic

The 2025 T1 package and ON428 are dollar-form calculations. Amounts that flow onto forms should follow the official form and guide rounding instructions for the line being populated. Because official forms often carry rounded whole-dollar constants and line-by-line "if negative, enter 0" instructions, the implementation should:

1. Preserve official constants exactly as printed.
2. Preserve line-level "if negative, enter 0" clamps.
3. Round only at the points required by the official form or guide.
4. Record whether a value is a form entry, intermediate worksheet value, or final carry-forward line.

Open implementation item: this research did not locate a single Ontario-specific global rounding rule beyond the official line-by-line form arithmetic. The calculation engine should keep a source-backed rounding policy per form/line and should not invent a province-wide rounding shortcut.

## Instalments, interest, and penalties

The CRA administers personal income tax instalment, interest, and late-filing penalty rules. No Ontario-only instalment threshold was found for this Ontario 2025 package.

Official CRA facts captured:

- Required individual tax instalments for 2026 can apply when net tax owing is more than $3,000, or $1,800 for Quebec, for 2026 and in either 2025 or 2024.
- The standard instalment due dates are March 15, June 15, September 15, and December 15, except the CRA page identifies a different rule for farmers and fishers.
- CRA charges compound daily interest on unpaid 2025 taxes starting the day after the due date.
- CRA interest rates can change quarterly.
- Standard late-filing penalty for a 2025 return filed late with tax owing is 5% of the 2025 balance owing plus 1% for each full month late, up to 12 months.
- Repeated late-filing penalty can be 10% plus 2% for each full month late, up to 20 months, when the official demand/previous-penalty conditions apply.
- CRA applies an instalment penalty only if instalment interest for 2026 is more than $1,000.

The application must not calculate penalties or interest as advice. If it displays reminders, it should cite the current CRA source and state that CRA-administered charges are determined by CRA.

## Mailing-office selection

The CRA page "Where to mail your paper T1 return" routes paper T1 returns by resident/non-resident status and province, territory, country grouping, and Ontario or Quebec area. For Ontario resident individuals, the page splits Ontario areas between Winnipeg and Sudbury. For non-resident individuals, it provides a separate routing table and temporary fax note for non-resident returns.

The application must not store a permanent default mailing office for Ontario. It should store:

- source title and URL;
- access date;
- taxpayer-confirmed resident or non-resident routing status;
- taxpayer-confirmed Ontario area or other official routing factor;
- official destination shown for final review.

## Official sources

- Canada Revenue Agency, "Ontario - 2025 Income tax package", https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario.html
- Canada Revenue Agency, "5006-C ON428 - Ontario Tax", https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-c.html
- Canada Revenue Agency, "5006-C ON428 - Ontario Tax" PDF/e-text, https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-c/5006-c-25e.pdf and https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-c/5006-c-25e.txt
- Canada Revenue Agency, "5006-D Worksheet ON428", https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-d.html
- Canada Revenue Agency, "5006-D Worksheet ON428" PDF, https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-d/5006-d-25e.pdf
- Canada Revenue Agency, "5006-TC ON479 - Ontario Credits", https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-tc.html
- Canada Revenue Agency, "5006-TC ON479 - Ontario Credits" PDF/e-text, https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-tc/5006-tc-25e.pdf and https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-tc/5006-tc-25e.txt
- Canada Revenue Agency, "5006-D1 Worksheet ON479", https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-d1.html
- Canada Revenue Agency, "5006-D1 Worksheet ON479" PDF/e-text, https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-d1/5006-d1-25e.pdf and https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-d1/5006-d1-25e.txt
- Canada Revenue Agency, "5006-A Schedule ON428-A - Low-income Individuals and Families Tax (LIFT) Credit", https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-a.html
- Canada Revenue Agency, "5006-A Schedule ON428-A - Low-income Individuals and Families Tax (LIFT) Credit" PDF/e-text, https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-a/5006-a-25e.pdf and https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-a/5006-a-25e.txt
- Canada Revenue Agency, "5006-TCA Schedule ON479-A - Ontario Childcare Access and Relief from Expenses (CARE) Tax Credit", https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-tca.html
- Canada Revenue Agency, "5006-TCA Schedule ON479-A - Ontario Childcare Access and Relief from Expenses (CARE) Tax Credit" PDF/e-text, https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-tca/5006-tca-25e.pdf and https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-tca/5006-tca-25e.txt
- Canada Revenue Agency, "5006-TG ON-BEN - Application for the 2026 Ontario Trillium Benefit and Ontario Senior Homeowners' Property Tax Grant", https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-tg.html
- Canada Revenue Agency, "5006-TG ON-BEN - Application for the 2026 Ontario Trillium Benefit and Ontario Senior Homeowners' Property Tax Grant" PDF/e-text, https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-tg/5006-tg-25e.pdf and https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-tg/5006-tg-25e.txt
- Canada Revenue Agency, "Ontario tax information for 2025", https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-pc.html
- Canada Revenue Agency, "Where to mail your paper T1 return", https://www.canada.ca/en/revenue-agency/corporate/contact-information/where-mail-your-paper-t1-return.html
- Canada Revenue Agency, "Required tax instalments for individuals", https://www.canada.ca/en/revenue-agency/services/payments/payments-cra/individual-payments/income-tax-instalments.html
- Canada Revenue Agency, "Who has to pay - Required tax instalments for individuals", https://www.canada.ca/en/revenue-agency/services/payments/payments-cra/individual-payments/income-tax-instalments/who-pays-instalments.html
- Canada Revenue Agency, "Interest and penalties on late taxes - Personal income tax", https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/interest-penalties/late-filing-penalty.html
- Ontario Ministry of Finance, "Ontario Dividend Tax Credit", https://www.ontario.ca/page/ontario-dividend-tax-credit
