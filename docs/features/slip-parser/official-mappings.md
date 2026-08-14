# Official CRA slip mappings

This registry documents only relationships stated by the Canada Revenue Agency (CRA). It is not a complete tax engine. Every extracted value remains provisional and requires side-by-side confirmation against the source document.

The tables use these statuses:

- **Direct candidate**: the cited CRA page names a destination. The value may be proposed for manual confirmation, subject to exact-tax-year support and return-engine validation.
- **Calculation required**: the CRA instruction requires arithmetic, another schedule, or another box. The parser may extract inputs but must not populate the result.
- **Context required**: treatment depends on facts the slip does not establish. The parser must not choose.
- **Reference only**: extract for review but do not send to the return.

## T4 — Statement of Remuneration Paid

Official source: [T4 slip: Statement of Remuneration Paid](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t4-slips/t4-statement-remuneration-paid.html) (page updated 2026-02-02; current page shows the 2025 slip).

| Box | CRA destination | Status and boundary |
| --- | --- | --- |
| 14 | T1 line 10100 | Direct candidate. Special cases described by CRA, including emergency-services, wage-loss, and clergy amounts, require contextual review. |
| 16 / 17 | Schedule 8 or Form RC381, then lines 30800 and 22215 | Calculation required. Do not copy either box directly to a final line. |
| 16A / 17A | Schedule 8 or Form RC381, then line 22215 | Calculation required. |
| 18 | T1 line 31200 | Direct candidate, subject to the return’s overpayment rules. |
| 20 | T1 line 20700 | Direct candidate. |
| 22 | T1 line 43700 | Direct candidate. |
| 44 | T1 line 21200 | Direct candidate. |
| 46 | Schedule 9 line 1; resulting claim relates to T1 line 34900 | Calculation required. |
| 52 | T1 line 20600 | Direct informational entry; CRA states it is neither income nor a deduction. |
| 55 | T1 line 31205 for a Quebec resident; otherwise see line 31200 | Context required because residence controls the destination. |
| 39 / 41 | T1 line 24900 | Direct candidate. |
| 42 | T1 line 10120 | Direct candidate, but already included in box 14 and must not be added twice. |
| 43 | T1 line 24400 | Direct candidate, but already included in box 14. |

Other-information boxes that CRA says are already included in box 14 are reference-only unless the cited page explicitly names a separate line.

## T4A — Statement of Pension, Retirement, Annuity, and Other Income

Official source: [T4A slip](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t4-slips/t4a-slip.html) (page updated 2026-01-30).

| Box | CRA destination | Status and boundary |
| --- | --- | --- |
| 016 | T1 line 11500 | Direct candidate for pension or superannuation; any pension-income-amount treatment is a separate calculation. |
| 018 | T1 line 13000 | Direct candidate for the aggregate lump-sum amount. Component boxes already included in 018 must not be added again. |
| 020 | Gross commissions at line 13899 and net commissions at line 13900 | Context and calculation required; the slip does not establish net income. |
| 022 | T1 line 43700 | Direct candidate. |
| 024 | Line 11500 or another treatment described by CRA | Context required, including age and survivor circumstances. |
| 028 | Line 13000, line 10400, or lines 13499–14300 depending on the payment | Context required. |
| 032 | T1 line 20700 | Direct candidate. |
| 034 | T1 line 20600 | Direct informational entry; neither income nor a deduction. |
| 042 | T1 line 13000 | Direct candidate. |
| 046 | Schedule 9 line 1; resulting claim relates to line 34900 | Calculation required. |
| 048 | Applicable self-employment lines 13499–14300 | Context and calculation required. |
| 105 | T1 line 13010 | Direct candidate, with the scholarship exemption determined separately. |
| 194 | Line 11500 or line 13000 | Context required. |

Any component box that the CRA page says is included in another T4A box is reference-only to prevent double counting.

## T4E — Statement of Employment Insurance and Other Benefits

Official source: [T4E slip](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t4-slips/t4e-statement-employment-insurance-other-benefits.html) (page updated 2021-02-22 and still linked from the CRA tax-slip index).

| Box | CRA destination | Status and boundary |
| --- | --- | --- |
| 14 and 18 | T1 line 11900 receives box 14 minus box 18 | Calculation required. Boxes 15, 17, 18, 33, 36, and 37 are already included in box 14. |
| 21 | T1 line 25600 | Direct candidate. |
| 22 | T1 line 43700 | Direct candidate. |
| 23 | Quebec provincial return for a Quebec resident; otherwise federal line 43700 | Context required because residence controls the destination. |
| 24 | T1 line 43700 | Direct candidate. |
| 30 | T1 line 23200 | Direct candidate. Boxes 26 and 27 are already included in box 30. |
| 7 | Repayment chart, with possible effects at lines 23500 and 42200 | Calculation required. |

## T5 — Statement of Investment Income

Official source: [T5 slip information for individuals](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t5-slips/t5-statement-investment-income-slip-information-individuals.html) (page updated 2025-12-11).

| Box | CRA destination | Status and boundary |
| --- | --- | --- |
| 11 | T1 lines 12010 and 12000 | Direct candidate. Box 10 is the actual amount and is not separately added to these lines. |
| 12 | Federal Worksheet line 40425 | Direct candidate to the worksheet, not a direct T1 mutation. |
| 13 | T1 line 12100 | Direct candidate. |
| 14 | T1 line 12100 | Direct candidate. |
| 15 | T1 line 12100 | Direct candidate; currency conversion and foreign reporting remain separate review. |
| 16 | Foreign-tax-credit calculation; CRA refers to line 40500 | Calculation required. |
| 17 | Line 10400, 13500, or 12100 depending on the royalty | Context required. |
| 18 | Schedule 3 line 17400 | Direct candidate to Schedule 3. |
| 19 | Line 11500 or 12100 depending on age or survivor circumstances | Context required. |
| 25 | T1 line 12000 | Direct candidate. Box 24 is the actual amount and is not separately added to line 12000. |
| 26 | Federal Worksheet line 40425 | Direct candidate to the worksheet. |
| 30 | T1 line 12100 | Direct candidate. |

## T3 — Statement of Trust Income Allocations and Designations

Official source: [T3 slip information for individuals](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t3-statement-trust-income-allocations-designations-slip-information-individuals.html) (page updated 2021-01-18 and still linked from the CRA tax-slip index).

| Box | CRA destination | Status and boundary |
| --- | --- | --- |
| 32 and 50 | Total at T1 line 12000; box 32 also at line 12010 | Calculation required to aggregate multiple dividend boxes without duplication. |
| 39 and 51 | Total at T1 line 40425 | Calculation required to aggregate credits. |
| 21 and 30 | Box 21 minus box 30 at Schedule 3 line 17600 | Calculation required; foreign footnotes may also require Form T2209. |
| 26 and 31 | Box 26 minus box 31 at T1 line 13000 | Calculation required. Box 31 is also reported as described below. |
| 22 | T1 line 13000 | Direct candidate; transfer treatment remains separate review. |
| 24 | T1 line 13500 and Form T2209 | Calculation required. |
| 25 | T1 line 12100 and Form T2209 line 43300 | Calculation required because both destinations must be handled. |
| 31 | T1 line 11500 and the line 31400 calculation | Direct candidate to line 11500; pension credit is calculation required. |
| 33 / 34 | Form T2209 lines 4 / 1 | Direct candidates to Form T2209, subject to the foreign-tax-credit calculation. |
| 37 | Schedule 3 line 17600 | Direct candidate for the stated loss. |
| 38 | T1 line 45600 | Direct candidate. |
| 42 | Adjust the property’s cost base | Reference only. Never treat the amount as current-year income or a deduction. |
| 48 | Schedule 9 line 33700, 33900, 34000, or 34200 depending on donation type | Context required. |

## T5008 — Statement of Securities Transactions

Official sources:

- [T5008 slip information for individuals](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t5-slips/t5008-statement-securities-transactions-slip-information-individuals.html) (page updated 2025-12-11)

All T5008 return mappings are **context required**. The CRA states that transactions may be on income or capital account. Capital transactions go through Schedule 3; income transactions may be business income at line 13500 or, for bearer debt obligations, investment income at line 12100. The parser must not classify the transaction.

Box 21 may supply proceeds for a Schedule 3 calculation. Box 20 may or may not be the adjusted cost base; the user must reconcile acquisition records, commissions, fees, currency, corporate actions, and other adjustments. Extract boxes 20 and 21 with geometry and warnings, but do not calculate or populate a gain, loss, adjusted cost base, business income, or investment income.

## T2202 — Tuition and Enrolment Certificate

Official sources:

- [T2202 Tuition and Enrolment Certificate](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t2202-tuition-enrolment-certificate.html) (page updated 2026-05-15)
- [Line 32300 — Your federal tuition amount](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-32300-your-tuition-education-textbook-amounts.html) (page updated 2025-11-26)

Extract session rows, boxes 24 and 25 (total part-time and full-time months), and box 26 (total eligible tuition fees). Return integration is **calculation required**: box 26 supplies the current-year tuition input at Schedule 11 line 32000; the completed Schedule 11 calculation determines the federal tuition amount that reaches T1 line 32300. Transfer or carry-forward choices depend on the taxpayer’s circumstances, and provincial or territorial treatment may differ. The parser must not infer eligibility, the claim amount, a transfer, or a carry-forward from box 26 alone.

## RRSP contribution receipts

Official source: [RRSP contribution receipt information for individuals](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/rrsp-contribution-receipt-slip-information-individuals.html) (current CRA page checked 2026-08-14).

Extract the tax year, contribution period, contribution amount, contributor, and annuitant as review candidates. The CRA directs totals for both contribution periods to Schedule 7 line 24500 when applicable and the deduction chosen by the taxpayer to T1 line 20800. This is **calculation and context required** because contribution limits, unused amounts, transfers, spousal plans, Home Buyers’ Plan and Lifelong Learning Plan repayments, and the taxpayer’s chosen deduction are not established by a receipt alone. Never copy the receipt amount directly to line 20800.

## Unsupported documents and years

No other slip type has a return mapping in this registry. A document may be identified for the purpose of explaining that it is unsupported, but its values must not be normalized into return instructions.

Mappings apply only when the application carries a versioned artifact for the exact detected tax year. If a CRA page, form, line, schedule, box definition, or calculation changes, the old artifact remains bound to its original year and the new year remains unsupported until separately sourced. Missing or conflicting year evidence blocks integration rather than falling back to the latest mapping.

## Mandatory final review

Even a direct candidate cannot bypass manual review. The user must confirm each value against the rendered source, and the return engine must validate the complete calculation. Before producing the only permitted filing output—a CRA mail-in PDF package—the user must review every form, calculation, attachment, mailing address, and signature field.

The product provides no NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing capability.
