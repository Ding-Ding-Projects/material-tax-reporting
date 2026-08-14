# Federal 2025 personal income tax calculation research

Status: research proposal, not production tax logic  
Tax year: 2025  
Jurisdiction: Canada federal rules for an Ontario-resident T1 return  
Official-source access date: 2026-08-14

## Scope and product boundary

This record transcribes the supplied official Canada Revenue Agency (CRA) facts for the 2025 federal portion of an Ontario T1 return. It is not tax or legal advice, a completed return, or CRA certification. A value or formula not transcribed from the final source set is **unavailable** and must fail closed; it must not be guessed from another year, a payroll table, an unofficial calculator, or an assumed rate.

The only supported filing output is a CRA mail-in PDF package. Before export or printing, the user must manually review every populated form, calculation, attachment, mailing destination, and signature/date field and explicitly acknowledge that review. The product must not implement, offer, advertise, simulate, or imply NETFILE, EFILE, ReFILE, SimpleFile, Auto-fill my return, electronic submission, direct CRA transmission, automatic filing, tax/legal advice, or CRA certification.

## Final 2025 form authorities

- Ontario T1: [Form 5006-R, Income Tax and Benefit Return (for ON only)](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-r.html), including the final [2025 e-text](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5006-r/5006-r-25e.txt); updated 2026-01-20.
- Federal worksheet: [Form 5000-D1, Federal Worksheet (for all except non-residents)](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-d1.html), including the 2025 `5000-d1-25e.pdf` and `5000-d1-25e.txt`; updated 2026-01-20.
- Final capital-gains authority: [Schedule 3, Capital Gains or Losses (5000-S3)](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-s3.html), updated 2026-01-20.
- AMT authority: [Form T691](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t691.html), with `t691-fill-25e.pdf` and `t691-25e.pdf`.

These forms and schedules are calculation authorities, not merely output templates. Form-line rounding, clamps, eligibility tests, and exceptions remain authoritative at the line where they are stated.

## Federal tax on taxable income

Taxable income is line **26000**. The final 5006-R federal tax brackets are marginal:

| Taxable-income range | Rate | Base tax | Base income |
| --- | ---: | ---: | ---: |
| $0 to $57,375 | 14.5% | $0.00 | $0.00 |
| More than $57,375 to $114,750 | 20.5% | $8,319.38 | $57,375.00 |
| More than $114,750 to $177,882 | 26% | $20,081.25 | $114,750.00 |
| More than $177,882 to $253,414 | 29% | $36,495.57 | $177,882.00 |
| More than $253,414 | 33% | $58,399.85 | $253,414.00 |

The corresponding piecewise expression is `baseTax + (line26000 - baseIncome) × rate` for the selected row, with the first row using `line26000 × 0.145`. Negative taxable income is outside this proposal's calculation input and must be rejected or handled by the final form rules. The federal tax result maps to line **76**, then to line **119** as directed by the final return. Federal non-refundable credits use the federal credit rate **14.5%** where the final worksheet directs that rate; a credit with its own schedule or rate must not be forced through this rate.

The 14.5% rate is the full-year 2025 return rate. CRA's July 2025 payroll formula publication records that the lowest legislated rate changed from 15% to 14% effective 2025-07-01 and that the resulting full-year 2025 rate is 14.5%. The federal 2025 indexing factor is 2.7%. Payroll proration must not be substituted for the final annual return table above.

## Basic personal amount and listed constants

The basic personal amount is line **30000**, based on net income line **23600**:

- `$16,129` when line 23600 is at or below `$177,882`;
- `$14,538` when line 23600 is at or above `$253,414`;
- between those thresholds, the final Federal Worksheet starts with $14,538, subtracts `$1,591 × (line 23600 − $177,882) ÷ $75,532` from the $1,591 supplement without going below zero, adds the remainder to $14,538, and caps the result at $16,129.

Other final constants supplied for this research are:

| Item | 2025 value or boundary | Status |
| --- | ---: | --- |
| Age amount, line 30100 maximum | $9,028 | Amount only; complete eligibility/reduction remains form-driven. |
| Canada caregiver amount for an eligible child, line 30500 | $2,687 per child | Amount only; complete eligibility/reduction remains form-driven. |
| Employment insurance premiums through employment, line 31200 | Maximum $1,077.48 | See EI section for the premium cap and line treatment. |
| Canada employment amount, line 31260 | `min($1,471, employment income)` | Eligibility and line-level treatment remain form-driven. |
| Home buyers' amount | Maximum $10,000 | Complete worksheet eligibility unavailable. |
| Home accessibility expenses amount | Maximum $20,000 | Complete worksheet eligibility unavailable. |
| Pension income amount | Maximum $2,000 | Complete worksheet eligibility unavailable. |
| Disability amount for self, adult | $10,138 | Prior DTC approval and final form eligibility required. |
| Medical-expense threshold | Lesser of $2,834 or 3% of net income | Apply the final worksheet/line instructions. |
| Political contribution credit, line 41000 | Maximum federal political contribution tax credit $650 | Complete credit formula and brackets unavailable. |

This is not a complete federal-credit catalogue. Every unlisted amount, rate, eligibility test, or reduction is unavailable pending complete extraction from the final 5006-R/5000-D1 and applicable schedules.

### 2025 top-up tax credit

The final Federal Worksheet calculates line 34990 by adding line 33800 and Schedule 9 line 22, subtracting $8,319.38 without going below zero, and multiplying the remainder by 3.45%. The top-up is a separate credit in the final return sequence; it must not be folded into the 14.5% non-refundable-credit rate or omitted from a 2025 calculation when the worksheet inputs exceed the threshold.

## Dividends from taxable Canadian corporations

Taxable dividend amounts are reported on lines **12000** (eligible) and **12010** (other-than-eligible). The CRA line-12000 guidance is [here](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/personal-income/line-12000-taxable-amount-dividends-eligible-other-than-eligible-taxable-canadian-corporations.html). Without a slip, use the supplied gross-up factors:

- eligible: actual cash dividend × **138%**;
- other-than-eligible: actual cash dividend × **115%**.

The federal dividend tax credit is line **40425**, using the CRA [line-40425 guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-40425-federal-dividend-tax-credit.html). Use the amount on the applicable slip when present; otherwise use the final Federal Worksheet chart. A credit percentage was not transcribed in this research and is **unavailable**—do not invent one.

## Capital gains

Schedule 3 is the final 2025 authority and sends taxable capital gains to line **12700**. The CRA's [January 31, 2025 update](https://www.canada.ca/en/revenue-agency/news/newsroom/tax-tips/tax-tips-2025/update-cra-administration-proposed-capital-gains-taxation-changes.html) states that gains realized before **2026-01-01** use the enacted **one-half inclusion rate**, unless an applicable exemption or other final-form rule changes the result. Do not apply a proposed post-2025 rate to a 2025 return. The complete Schedule 3 treatment for exemptions, reserves, losses, and special dispositions remains schedule-driven and is unavailable unless transcribed from the final schedule.

## CPP, CPP2, and Ontario/QPP boundary

The CRA's [2025 CPP announcement](https://www.canada.ca/en/revenue-agency/news/newsroom/tax-tips/tax-tips-2024/canada-revenue-agency-announces-maximum-pensionable-earnings-contributions-2025.html) supplies these values:

| Parameter | Employee/employer | Self-employed |
| --- | ---: | ---: |
| Year's basic exemption | $3,500 | $3,500 |
| YMPE | $71,300 | $71,300 |
| Contribution rate through YMPE | 5.95% | 11.90% |
| Maximum contribution through YMPE | $4,034.10 | $8,068.20 |
| YAMPE | $81,200 | $81,200 |
| CPP2 band | YMPE to YAMPE | YMPE to YAMPE |
| CPP2 rate | 4% | 8% |
| CPP2 maximum | $396 | $792 |

Return mappings:

- self-employed contribution deduction: line **22200**, through Schedule 8 or RC381 where officially applicable;
- enhanced employment contribution deduction: line **22215**, maximum **$1,074**;
- base contribution credit: line **30800** for employment and line **31000** for self-employment.

The complete Schedule 8/RC381 mixed-income, prorating, election, age, death, disability, and overpayment mechanics are unavailable. QPP is not an Ontario base parameter: map RC381 only where the final official eligibility rules require it; otherwise QPP is unavailable and must not be used as an Ontario default.

## Employment Insurance

The official [2025 maximum-insurable-earnings notice](https://www.canada.ca/en/employment-social-development/programs/ei/ei-list/ei-employers/premium-reduction-program/2025-maximum-insurable-earnings.html), effective 2025-01-01, gives:

- maximum insurable earnings: **$65,700**;
- employee premium: **$1.64 per $100** (1.64%);
- maximum employee premium: **$1,077.48**.

Self-employed EI is an opt-in program handled through Schedule 13 and line **31217**. No universal self-employed premium is inferred here; the amount is **unavailable** without the taxpayer's official participation status and complete Schedule 13 calculation.

## Alternative minimum tax

The [T691 page](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t691.html) and 2025 files are the AMT authority. The CRA [line-41700 guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/deductions-credits-expenses/line-41700-minimum-tax.html/1000) gives a screening total: above **$177,882** may require T691; at or below it, AMT probably does not apply. This is only a screen, not an exemption or tax formula. Complete T691 when required and map the result to line **41700**. Minimum-tax carryover maps to line **40427**. Full T691 mechanics are not transcribed and are **unavailable**.

## Refundable credits

### Refundable medical expense supplement — line 45200

The CRA [line-45200 guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-45200-refundable-medical-expense-supplement.html) supplies these boundaries for 2025: resident throughout 2025, age **18 or older**, adjusted family net income below **$63,374**, qualifying earnings at least **$4,390**, and maximum supplement **$1,504**. Use the Federal Worksheet; the complete formula is unavailable here.

### Canada workers benefit — line 45300

The final [Schedule 6 (5000-S6)](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-s6.html/1000?wbdisable=true), updated 2026-01-20, is the authority for line **45300**. The full Ontario rate/table was not transcribed and is **unavailable**. Do not use a partial national table as an Ontario calculation.

## Instalments and line 47600

The CRA [income-tax-instalments guidance](https://www.canada.ca/en/revenue-agency/services/payments/payments-cra/individual-payments/income-tax-instalments.html) indicates instalments for 2026 when net tax owing for 2026 is more than **$3,000** and net tax owing for either 2025 or 2024 is also more than **$3,000**. Ordinary due dates are **March 15, June 15, September 15, and December 15**, with separate farmer/fisher treatment. Instalments paid are reported on line **47600**; see the [line-47600 guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-47600-tax-paid-instalments.html). The detailed alternative-method arithmetic is unavailable unless transcribed from the official instalment notice.

## Late tax, arrears interest, and instalment penalties

The CRA [late-filing penalty guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/interest-penalties/late-filing-penalty.html) states that compound daily arrears interest starts the day after the balance-due date. Prescribed interest rates vary quarterly and are therefore **unavailable** as a fixed 2025 constant. The ordinary late-filing penalty is **5%** of the unpaid balance plus **1% for each full month late**, to a maximum of **12 months**. A repeat late-filing case uses **10%** plus **2% per full month**, for up to **20 full months**, only when the official repeat conditions are met.

The CRA [instalment interest and penalty guidance](https://www.canada.ca/en/revenue-agency/services/payments/payments-cra/individual-payments/income-tax-instalments/interest-penalty-charges.html) says an instalment penalty applies only when calculated interest exceeds **$1,000**. The formula is documented there, but its quarterly prescribed-rate inputs are unavailable as fixed parameters.

## Rounding and fail-closed gaps

Preserve exact form constants, clamps, and line-level rounding. There is no invented global rounding rule. Apply the instruction attached to each line in 5006-R, 5000-D1, T691, Schedule 3, Schedule 6, Schedule 8, Schedule 13, or RC381. The deterministic source table uses integer Canadian cents, exact rational rates, and the printed base-tax constants so it does not recompute a band base from previously rounded arithmetic. Fractional-cent ties remain subject to mandatory manual comparison with the official form because no universal T1 tie-breaking rule was established. Any area not transcribed above is unavailable, including the no-slip dividend-credit percentage, full CWB and medical-supplement formulas, full Schedule 8/RC381 and Schedule 13 calculations, T691 mechanics, quarterly interest rates, and special bankruptcy, non-residence, immigration, emigration, deceased-return, or multi-jurisdiction rules.

## Official sources

The machine-readable companion `federal-2025.parameters.json` records each source URL, revision/update date supplied in this research, and the parameter or gap that source supports. No source outside the official URLs supplied for this task is used as a calculation authority.
