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
- Federal worksheet: [Form 5000-D1, Federal Worksheet (for all except non-residents)](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-d1.html), including final direct endpoints [`5000-d1-25e.pdf`](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5000-d1/5000-d1-25e.pdf) and [`5000-d1-25e.txt`](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5000-d1/5000-d1-25e.txt), revision `5000-D1 E (25)`; updated 2026-01-20.
- Final capital-gains authority: [Schedule 3, Capital Gains or Losses (5000-S3)](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-s3.html), updated 2026-01-20.
- AMT authority: [Form T691](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t691.html), with final direct endpoints [`t691-25e.pdf`](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/t691/t691-25e.pdf) and [`t691-fill-25e.pdf`](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/t691/t691-fill-25e.pdf), revision `T691 E (25)`.

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

## Basic personal amount and listed constants

The basic personal amount is line **30000**, based on net income line **23600**:

- `$16,129` when line 23600 is at or below `$177,882`;
- `$14,538` when line 23600 is at or above `$253,414`;
- between those thresholds, complete the final 5000-D1 calculation:
  1. base amount `$14,538`;
  2. supplement amount `$1,591`;
  3. excess income = line 23600 minus `$177,882`;
  4. phase-out fraction = excess income divided by `$75,532`;
  5. phase-out amount = phase-out fraction multiplied by `$1,591`;
  6. remaining supplement = `$1,591` minus the phase-out amount, but not below `0`;
  7. line 30000 = `$14,538` plus the remaining supplement, maximum `$16,129`.

The final worksheet does not state a separate universal rounding rule for this calculation. Preserve the line-level arithmetic and maximum exactly as transcribed.

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

## Dividends from taxable Canadian corporations

Taxable dividend amounts are reported on lines **12000** (eligible) and **12010** (other-than-eligible). The CRA line-12000 guidance is [here](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/personal-income/line-12000-taxable-amount-dividends-eligible-other-than-eligible-taxable-canadian-corporations.html). Without a slip, use the supplied gross-up factors:

- eligible: actual cash dividend × **138%**;
- other-than-eligible: actual cash dividend × **115%**.

The federal dividend tax credit is line **40425**, using the CRA [line-40425 guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-40425-federal-dividend-tax-credit.html) and final 5000-D1:

- When information slips show the credit, add T3 boxes **39** and **51**, T4PS boxes **26** and **32**, T5 boxes **12** and **26**, and T5013 boxes **131** and **134**. Enter that total on line 40425 if all dividends were slip-reported.
- If some dividends were not shown on slips, calculate an extra worksheet credit only for those unreported dividends:
  - amount A = the portion of line 12000 for dividends not shown on an information slip;
  - amount B = the portion of line 12010 for dividends not shown on an information slip;
  - other-than-eligible credit = amount B × **9.0301%**;
  - eligible credit base = amount A − amount B;
  - eligible credit = eligible credit base × **15.0198%**;
  - extra credit = other-than-eligible credit plus eligible credit;
  - line 40425 = slip-reported credit total plus the extra credit.

Foreign dividends do not qualify for this credit.

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

The [T691 page](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t691.html) and final `t691-25e.pdf` / `t691-fill-25e.pdf` files are the AMT authority. The CRA [line-41700 guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/deductions-credits-expenses/line-41700-minimum-tax.html/1000) gives a screening total: above **$177,882** may require T691; at or below it, AMT probably does not apply. This screening text is not a substitute for T691 where the form applies.

Key final T691 constants and mappings transcribed from `T691 E (25)`:

- AMT does not apply to a person who died in 2025 or to returns filed under subsections 70(2) or 150(4), or under paragraphs 104(23)(d) or 128(2)(e) of the Income Tax Act.
- Basic exemption: line **94** is **$177,882**. The final T691 form exposes a fixed line-94 exemption and no separate universal AMT exemption phase-out formula.
- Federal AMT rate: line **96** is **20.5%**.
- Part 1 line **93** is adjusted taxable income; line **95** is line 93 minus the line-94 basic exemption, not below zero. If line 95 is `0`, the taxpayer is not subject to AMT.
- Part 1 line **97** is the gross minimum amount: line 95 × 20.5%.
- Allowable credits against the gross minimum amount are limited on Part 1 as follows:
  - line **98**: net non-refundable tax credits from return line **33800** × **50%**;
  - line **99**: donations and gifts from return line **34900** × **80%**;
  - line **100**: federal logging tax credit, return line **133** for residents outside Quebec or line **137** for Quebec residents;
  - line **101**: section 119 former resident credit;
  - line **102**: sum of lines 98 to 101;
  - line **103**: minimum amount = line 97 minus line 102, not below zero. If line 103 is `0`, the taxpayer is not subject to AMT.

Adjusted taxable income line mappings transcribed directly from Part 1 include:

- line **1**: taxable income from return line **26000**, or the amount that would have been entered if lines 23600 and 26000 could show negatives in brackets;
- lines **4**, **7**, and **11**: net AMT addbacks for certified film property, rental/leasing property, and tax shelters/limited partnerships/non-active partners;
- line **14**: resource property and flow-through shares from Part 9 line 6;
- lines **15** to **23**: non-taxable part of capital gains reported in the year, beginning with Schedule 3 line **19700**, less listed exclusions and return line **12700** as directed;
- line **26**: listed Form T1170 capital-gains gift amount less line 68231, multiplied by **30%**;
- lines **28** to **32**: security-options deduction under paragraph 110(1)(d), including T4 boxes **39** and **91**, Form T1212 line 2 where applicable, and the 40% adjustment for gifts of publicly listed securities acquired under a security option plan;
- lines **35** to **38**: security-options deduction under paragraph 110(1)(d.1), prospector/grubstaker securities, and deferred-profit-sharing-plan securities;
- lines **39** to **43**: limited-partnership, non-capital/restricted/farm, and net-capital loss adjustments;
- lines **47**, **50**, **51**, and **52**: allowed portions of other-year losses, union/professional dues, and child-care expenses;
- lines **55** to **62**: disability supports, moving expenses, CPP/QPP deductions, PPIP premiums for Quebec only, clergy residence, Canadian Armed Forces/police, and northern residents deductions;
- lines **64** to **68**: non-deductible property expenses included on line 22100, excluding amounts already used in the specified AMT property lines;
- lines **69** to **77**: non-deductible office and employment expense adjustment;
- line **80**: line 78 multiplied by the line-79 applicable rate, shown on the final form as **50%**;
- lines **84** to **86**: AMT dividend adjustment using line **12010** × **13.0435%** and `(line 12000 − line 12010)` × **27.5362%**;
- line **87**: lifetime capital gains exemption from return line **25400** × **40%**;
- lines **89** to **91**: qualifying business transfer or qualifying cooperative conversion capital-gains deduction from return line **25395**;
- line **92**: sum of lines 86, 87, and 91;
- line **93**: adjusted taxable income = line 83 minus line 92, not below zero.

T691 then compares AMT with regular federal tax:

- Part 2 calculates basic federal tax from return line **40400**, total non-refundable credits line **35000**, dividend tax credit line **40425**, and any minimum tax carryover applied in 2025 from Part 8.
- Part 3 calculates regular net federal tax payable, including Form T2203 surtax where applicable, T2038(IND) recapture, Form T2209 federal foreign tax credit, federal logging tax credit, political contribution credit line **41000**, investment tax credit, and labour-sponsored funds tax credit line **41400**.
- Part 4 calculates the special foreign tax credit; its applicable rate is **20.5%**.
- Part 5 line **11** determines whether AMT remains payable after regular net federal tax and specified credits; if positive, complete Parts 6 and 7.
- Part 6 line **14** maps the final federal tax payable under AMT to return line **41700**.
- Part 8 line **12** maps minimum tax carryover applied in 2025 to return line **40427**.

Special foreign-income, resource-property, flow-through-share, T2203 multi-jurisdiction, T1206 tax-on-split-income, T2038(IND), T2209, T1170, T1212, and statutory ITA calculations remain form-driven. Do not infer values beyond the final T691 line instructions.

## Refundable credits

### Refundable medical expense supplement — line 45200

The CRA [line-45200 guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-45200-refundable-medical-expense-supplement.html) and final 5000-D1 supply these 2025 requirements and formula:

- The taxpayer entered an amount on line **21500** or **33200**.
- The taxpayer was resident in Canada throughout 2025.
- The taxpayer was age **18 or older** at the end of 2025.
- Adjusted family net income is less than **$63,374**.
- Qualifying earnings must total at least **$4,390**. Qualifying earnings are employment income from lines **10100** and **10400** other than wage-loss replacement plan amounts, minus lines **20700**, **21200**, **22900**, and **23100** with a zero floor, plus net self-employment income from lines **13500**, **13700**, **13900**, **14100**, and **14300** excluding losses.
- Adjusted family net income uses line **23600** or the amount that would have been entered if line 23600 could show negatives in brackets, plus UCCB repayment line **21300** and RDSP income repayment included on line **23200**, less UCCB income line **11700** and RDSP income line **12500**, with the worksheet's spouse/common-law partner exclusions for separation of 90 days or more including December 31, 2025, or spouse/common-law partner death on or before December 31, 2025.
- Reduction threshold: **$33,294**.
- Formula: qualifying medical expense amount = line **21500** + line **33200**; preliminary supplement = lesser of `(qualifying medical expense amount × 25%)` and `$1,504`; income reduction = `(adjusted family net income − $33,294, not below 0) × 5%`; line **45200** = preliminary supplement minus income reduction, not below `0`.

### Canada workers benefit — line 45300

The final [Schedule 6 (5000-S6)](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-s6.html/1000?wbdisable=true), including direct endpoint [`5000-s6-25e.txt`](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/5000-s6/5000-s6-25e.txt), revision `5000-S6 E (25)`, updated 2026-01-20, is the authority for line **45300** in this Ontario-resident research context.

Eligibility and income base:

- Complete Schedule 6 when the taxpayer was resident in Canada throughout 2025, earned working income, and was at least 19 at year-end or resided with a spouse/common-law partner or child.
- The taxpayer cannot claim CWB if they were a full-time student at a designated educational institution for more than 13 weeks in the year unless they had an eligible dependant at year-end; were confined to prison or a similar institution for at least 90 days; or were exempt from Canadian income tax for a period in the listed diplomatic/official circumstances.
- Family working income is Schedule 6 line **6**, based on employment income lines **10100** and **10400**, taxable scholarships etc. line **13010**, self-employment income lines **13500**, **13700**, **13900**, **14100**, and **14300** excluding losses, plus optional tax-exempt working income where elected.
- Adjusted family net income is line **15**: line **13** minus the secondary earner exemption on line **14**. The secondary earner exemption is capped at **$16,386** and is the lesser of working income or adjusted net income for the lower-working-income spouse column, as directed.

Basic CWB:

- Basic CWB requires family working income over **$3,000**.
- Phase-in base amount: **$3,000**.
- Phase-in rate: **27%**.
- Maximum benefit: **$1,633** without an eligible spouse or eligible dependant; **$2,813** with an eligible spouse or eligible dependant.
- Reduction threshold: **$26,855** without an eligible spouse or eligible dependant; **$30,639** with an eligible spouse or eligible dependant.
- Reduction rate: **15%**.
- Basic CWB formula: `min((familyWorkingIncome − 3000, not below 0) × 27%, maximumBenefit) − ((adjustedFamilyNetIncome − reductionThreshold, not below 0) × 15%)`, not below `0`.
- Adjusted family net income limits shown by the final schedule for basic CWB are **$37,742** without an eligible spouse or eligible dependant, and **$49,393** with an eligible spouse or eligible dependant.

CWB disability supplement:

- The taxpayer's own working income on Schedule 6 line **5** column 1 must be more than **$1,150**.
- Disability supplement phase-in base amount: **$1,150**.
- Phase-in rate: **27%**.
- Maximum supplement: **$843**.
- Reduction threshold: **$37,740** without an eligible spouse or eligible dependant; **$49,389** with an eligible spouse or eligible dependant.
- Reduction rate: **15%**, except **7.5%** if the taxpayer had an eligible spouse who is also eligible for the disability tax credit.
- Disability supplement formula: `min((taxpayerWorkingIncome − 1150, not below 0) × 27%, 843) − ((adjustedFamilyNetIncome − disabilityReductionThreshold, not below 0) × applicableDisabilityReductionRate)`, not below `0`.
- If Step 2 was completed, line **42** adds the basic CWB amount from line **28** to the disability supplement amount from line **40** and enters the total on return line **45300**.
- Adjusted family net income limits shown by the final schedule for the disability supplement are **$43,360** without an eligible spouse or eligible dependant when the taxpayer is DTC-eligible, **$55,009** with an eligible spouse or eligible dependant when the taxpayer is DTC-eligible, and **$60,629** when both the taxpayer and eligible spouse are DTC-eligible.

Advanced Canada workers benefit (ACWB):

- Step 4 is completed when the taxpayer or spouse/common-law partner received an RC210 slip; otherwise line **49** is `0`.
- Line **43** is the greater of line **28** and line **42**, or `0` when neither basic CWB nor disability supplement is claimed.
- Lines **44** and **45** report box **10** basic ACWB paid to the taxpayer and spouse/common-law partner; line **46** adds them.
- Line **47** reports box **11** ACWB disability supplement paid to the taxpayer; line **48** adds line 46 and line 47.
- Line **49** is the lesser of line **43** and line **48** and maps to return line **41500**.

## Instalments and line 47600

The CRA [income-tax-instalments guidance](https://www.canada.ca/en/revenue-agency/services/payments/payments-cra/individual-payments/income-tax-instalments.html) indicates instalments for 2026 when net tax owing for 2026 is more than **$3,000** and net tax owing for either 2025 or 2024 is also more than **$3,000**. Ordinary due dates are **March 15, June 15, September 15, and December 15**, with separate farmer/fisher treatment. Instalments paid are reported on line **47600**; see the [line-47600 guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-47600-tax-paid-instalments.html). The detailed alternative-method arithmetic is unavailable unless transcribed from the official instalment notice.

## Late tax, arrears interest, and instalment penalties

The CRA [late-filing penalty guidance](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/interest-penalties/late-filing-penalty.html) states that compound daily arrears interest starts the day after the balance-due date. Prescribed interest rates vary quarterly and are therefore **unavailable** as a fixed 2025 constant. The ordinary late-filing penalty is **5%** of the unpaid balance plus **1% for each full month late**, to a maximum of **12 months**. A repeat late-filing case uses **10%** plus **2% per full month**, for up to **20 full months**, only when the official repeat conditions are met.

The CRA [instalment interest and penalty guidance](https://www.canada.ca/en/revenue-agency/services/payments/payments-cra/individual-payments/income-tax-instalments/interest-penalty-charges.html) says an instalment penalty applies only when calculated interest exceeds **$1,000**. The formula is documented there, but its quarterly prescribed-rate inputs are unavailable as fixed parameters.

## Rounding and fail-closed gaps

Preserve exact form constants, clamps, and line-level rounding. No universal CRA rounding rule was exposed in the final 5006-R e-text, final 5000-D1 e-text, final 5000-S6 e-text, final T691 PDF, or 2025 federal guide page reviewed for this pass. Do not invent a global rounding rule. Apply only the instruction attached to each line in 5006-R, 5000-D1, T691, Schedule 3, Schedule 6, Schedule 8, Schedule 13, or RC381. Any area not transcribed above is unavailable, including complete Schedule 8/RC381 and Schedule 13 calculations, special T691 linked-form calculations, quarterly interest rates, and special bankruptcy, non-residence, immigration, emigration, deceased-return, or multi-jurisdiction rules.

## Official sources

The machine-readable companion `federal-2025.parameters.json` records each source URL, revision/update date supplied in this research, and the parameter or gap that source supports. No source outside the official URLs supplied for this task is used as a calculation authority.
