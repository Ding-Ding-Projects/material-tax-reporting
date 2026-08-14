# Complex income and special-situation requirements for a 2025 Ontario T1 paper package

Status: implementation research, not tax or legal advice  
Official-source access date: 2026-08-14  
Primary tax year: 2025, with filing and payment dates falling in 2026  
Jurisdiction: individuals using the Ontario T1 Income Tax and Benefit Return unless a special-status rule requires another package  

## Product boundary

This product must stop at generation of a CRA mail-in PDF package. It must not implement, offer, advertise, simulate, or imply NETFILE, EFILE, electronic submission, direct CRA transmission, automatic filing, CRA certification, or confirmation that a return has been filed or accepted.

Before export or printing, the product must require a manual review in which the user inspects and explicitly acknowledges:

1. every populated return, schedule, form, worksheet, and continuation page;
2. every calculation, source amount, classification, carryforward, election, and transfer to another line;
3. every required information slip, receipt, statement, election, designation, explanatory note, and other attachment;
4. the mailing destination selected from current CRA instructions;
5. every signature, date, telephone, legal-representative, and certification field; and
6. any payment instruction, which is separate from the return-mailing destination.

The application may identify facts that require another form or specialist review. It must not decide fact-sensitive legal classifications when CRA describes the result as depending on the facts.

## Version and source policy

- Use the 2025 Ontario package for a person who was resident in Ontario on December 31, 2025, unless a special rule applies.
- Identify every form by form number, tax year or revision, and exact source URL.
- Treat annual form line numbers, inclusion rates, due dates, addresses, thresholds, and package contents as versioned data.
- Refresh mailing addresses from CRA at package-generation time. Do not encode a single Ontario address.
- A prior-year return must use that prior year's forms and rules. The 2025 mappings below must not be applied silently to another year.
- Where CRA's current form conflicts with a CRA web instruction, block automatic completion of the disputed transfer and present the conflict for manual review. The known 2025 T2209 conflict is recorded below.

## Paper-package assembly and review

### Core package

For an ordinary 2025 Ontario resident return, the package starts with `5006-R`, the Ontario version of the 2025 T1 Income Tax and Benefit Return. Add `ON428`, the federal and Ontario worksheets when their instructions require them, and every applicable federal or Ontario schedule or form. Ontario-specific forms can include `ON479`, `ON-BEN`, `ON428-A`, `ON479-A`, `ON(S2)`, and `ON(S11)`.

An Ontario resident or emigrant with business income allocated to a permanent establishment outside Ontario uses `T2203` instead of the ordinary `ON428` calculation. This is a multi-jurisdiction escalation boundary.

Starting with the 2025 tax year, CRA removed several schedules, including Schedule 3, from mailed packages. The application must assemble every applicable schedule and must not assume that a paper package obtained from CRA is complete.

### Attachments

For a paper T1, CRA instructs the filer to attach copies of information slips, completed forms and schedules when required, and `T776` or a rental income and expense statement for rental income. The main return also instructs the filer to attach only supporting documents requested for a deduction, claim, or expense and to retain other records in case CRA asks for them.

If an information slip is missing, CRA permits available evidence such as the final pay stub or statement and asks for a note naming the payer, the income type, and the efforts made to obtain the slip. The product must not invent the missing slip values.

The attachment checklist must be generated from the actual forms and claims in the package. A generic checklist is not sufficient.

### Signature and certification

The 2025 `5006-R` certification states that the return and attached documents are correct, complete, and fully disclose all income. The paper return has signature, telephone, and date fields. The package may highlight those fields but must leave the legal act of signing to the filer or authorized legal representative.

### Mailing and envelopes

CRA says paper T1 returns are mailed to the applicable tax centre. For Ontario, CRA currently routes some cities to Winnipeg and others to Sudbury. Non-resident routing is different. Address selection must therefore use current official rules, collect the location facts CRA requests, display the exact address, and require explicit confirmation.

Use a separate envelope for each person. Current-year and late returns for the same person may be placed in one envelope. Optional deceased returns remain separately identified returns even when mailed together as CRA directs.

The T1 mailing addresses are for returns, not general correspondence or cheque payments. If a user chooses payment by mail, show CRA's separate remittance-voucher and cheque instructions and its current payment address. Never place the payment address on the return envelope by default.

### 2025 deadlines

- Most 2025 individual returns: April 30, 2026.
- A self-employed individual, or an individual whose spouse or common-law partner carried on a business in 2025: June 15, 2026, subject to CRA's exceptions.
- Any 2025 balance owing remains due April 30, 2026.
- The self-employed filing extension does not apply where the expenditures of the business are primarily connected with a tax shelter.

The product should show the filing and payment dates separately and must not calculate relief, interest, penalties, or eligibility from stale dates.

## Self-employment and professional income

### Form selection

| Activity | 2025 statement | T1 gross line | T1 net line | Core boundary |
|---|---:|---:|---:|---|
| Business | `T2125` | `13499` | `13500` | Separate form for each distinct business. |
| Professional | `T2125` | `13699` | `13700` | Separate business and professional activities; professional work-in-progress rules can apply. |
| Commission | `T2125` | `13899` | `13900` | Employee commission income is not automatically self-employment. |
| Farming | `T2042` or an applicable AgriStability/AgriInvest statement | `14099` | `14100` | Separate form for each operation; optional inventory and restricted-farm-loss rules require review. |
| Fishing | `T2121` | `14299` | `14300` | Separate form for each operation; fishing-partnership rules require review. |

`T2125`, `T2042`, and `T2121` are 2025 forms. Guide `T4002(E) Rev. 25` covers the 2025 business, professional, commission, farming, and fishing rules. A trust does not use this individual/partner workflow; CRA directs trusts to the T3 guide.

### T2125 calculation path

The product must preserve the form's sequence rather than treating net self-employment income as one input:

1. identify the business, industry code, fiscal period, tax-shelter status, business number, and internet-business facts;
2. identify whether the activity is business or professional and prepare a separate `T2125` for each distinct activity;
3. report gross sales, commissions, or fees, including GST/HST collected or collectible where the form instructs;
4. subtract GST/HST, provincial sales tax, returns, allowances, discounts, and adjustments as directed to derive adjusted gross revenue;
5. calculate cost of goods sold and gross profit where applicable;
6. calculate deductible expenses, distinguishing current expenses from capital property and personal portions;
7. apply motor-vehicle, meals, workspace-in-home, capital cost allowance, and other limitation worksheets only when their facts are complete;
8. account for reserves, mandatory inventory adjustments, GST/HST rebates, and partnership adjustments; and
9. transfer the resulting gross and net amounts to the applicable T1 lines above.

The current `T2125` Part 5 includes line `9369` for net income before adjustments, line `9974` for a GST/HST rebate for partners, line `9943` for other partner amounts, line `9945` for business-use-of-home expenses, and line `9946` for net income. These lines are not interchangeable with the T1 self-employment lines.

### Farming and fishing

Self-employed farmers and fishers, including partners, must provide a separate statement for each operation. The standard forms are `T2042` and `T2121`. CRA also lists `T1163`, `T1164`, `T1273`, and `T1274` for applicable AgriStability and AgriInvest program participants. The application must ask about program participation before selecting the farming form.

Escalate or require specialist confirmation for:

- cash versus accrual reporting and a change of method;
- optional or mandatory inventory adjustments;
- restricted farm losses and chief-source-of-income facts;
- livestock, crop, insurance, subsidy, patronage, quota, and stabilization-program amounts;
- drought, flood, forced-destruction, and replacement-property measures;
- capital gains on qualified farm or fishing property and intergenerational transfers;
- multiple operations, partnerships, tax shelters, and non-calendar fiscal periods.

### GST/HST interaction

Income-tax reporting and GST/HST reporting are separate obligations. The T1 package builder may identify and reconcile facts, but it must not file a GST/HST return.

For most businesses, CRA's small-supplier test uses worldwide taxable supplies, including zero-rated supplies, of the person and associates. Registration is generally required when the total exceeds $30,000 in a single calendar quarter or over four consecutive calendar quarters. The effective registration date and the first supply on which tax must be charged differ between those two threshold cases. Voluntary registration may be possible below the threshold. A taxi business or commercial ride-sharing service must register even if it is a small supplier. Exempt supplies and special digital-economy/non-resident rules require separate analysis.

The ordinary HST rate for a supply made in Ontario is currently 13%, but place-of-supply and special-rate rules still determine the rate. Guide `RC4058(E) Rev. 25` describes the Quick Method as a separate election with eligibility, effective-date, remittance-rate, and input-tax-credit restrictions. A T1 calculation must not infer a Quick Method election from revenue or from the amount remitted.

The application must collect at least:

- registration status and effective date;
- reporting method and whether amounts are recorded GST/HST-inclusive or exclusive;
- taxable, zero-rated, exempt, and out-of-scope supplies;
- collected/collectible GST/HST included in gross receipts;
- input tax credits and rebates that reduce expenses or capital cost;
- any GST/HST rebate included in self-employment or partnership income; and
- whether threshold, taxi/ride-sharing, associate, digital-economy, or non-resident rules require escalation.

It must not assume that $30,000 is an annual net-income threshold or that every self-employed person charges HST.

## Partnerships

A partnership is not reduced to the sole-proprietor flow. Ask whether the person is an active, limited, or non-active partner; whether a `T5013` slip was issued; whether the partnership was required to file an information return; whether there are tax-shelter, at-risk, limited-partnership, foreign, rental, farming, fishing, or multi-jurisdiction amounts; and whether the fiscal period differs from the calendar year.

Important 2025 mappings and attachments include:

- active-partner business, professional, commission, farming, or fishing amounts flow through the corresponding activity statement and T1 gross/net lines;
- `T5013` box `104` for a limited or non-active partner can map to T1 line `12200` rather than the active self-employment lines;
- rental, farming, and fishing partnership amounts can map to T1 lines `12600`, `14100`, and `14300` respectively, subject to the slip instructions and activity statement;
- a paper filer attaches a copy of the `T5013` slip; and
- where no slip was received, CRA may require the partnership financial statement and the applicable activity form.

Escalate partnership loss restrictions, negative adjusted cost base, at-risk amounts, tax shelters (`T5004`), foreign reporting, a permanent establishment outside Ontario (`T2203`), changes in partners, dissolution, and any conflict between slip boxes and underlying statements.

## Rental income

### Classification and forms

Use 2025 `T776`, Statement of Real Estate Rentals, and Guide `T4036(E) Rev. 25`. Complete a separate property schedule as the form requires and preserve co-owner or partner information.

Rental income is generally income from property when the landlord provides only basic services such as heat, light, parking, and laundry facilities. More extensive services can make the activity a business. This is a fact-sensitive classification and must be escalated rather than decided from a single checkbox.

### Core mappings

| T776 amount | Meaning | T1 transfer |
|---:|---|---:|
| `8141` | Gross rents | contributes to gross rental income |
| `8230` | Other rental income | contributes to total gross rental income |
| `8299` | Total gross rental income | `12599` |
| `9946` | Net rental income or loss | `12600` |

For partnership rental income, use the `T5013` instructions and `T776` partner calculations. Do not copy a slip amount into `T776` without identifying whether it is gross, net, limited-partnership, rebate, or partner-expense information.

### Calculation and review boundaries

- Rental reporting is generally on the accrual method; CRA permits cash reporting only in the limited circumstance described in `T4036` where it produces almost the same result.
- Allocate expenses between personal and rental use and between co-owners using the legal ownership facts.
- Distinguish repairs and maintenance from capital improvements.
- Separate land from depreciable buildings and additions.
- Capital cost allowance is optional within the form's maximum, cannot create or increase a rental loss, and can create recapture or a terminal loss on disposition.
- A principal residence, change in use, below-market rent to relatives, vacant land, condominium, short-term rental, co-ownership, partnership, or disposition of depreciable property requires additional questions and often specialist review.
- For tax years after 2023, CRA denies the non-compliant amount of deductions relating to a non-compliant short-term rental. The 2025 T776 instructions use line `9365` for the short-term-rental portion of total expenses, line `9366` for the non-compliant amount of expenses, and line `9367` for the non-compliant amount of CCA. The product must collect province/municipality licensing and compliance facts, short-term-rental days, non-compliant days, and allocation inputs; it must not infer compliance.

Attach `T776` or the rental statement to a paper T1. Keep ordinary supporting records unless the return or CRA instructions specifically request them.

## Capital gains, losses, securities, and crypto-assets

### 2025 Schedule 3 calculation

The core calculation for each capital disposition is:

`capital gain or loss = proceeds of disposition - adjusted cost base - outlays and expenses`

All amounts are reported in Canadian dollars. For 2025, `5000-S3 E (25)` applies a 50% inclusion rate to its resulting net capital gain. The rate is versioned and must not be carried into another year without that year's official form.

Key 2025 Schedule 3 mappings:

| Property/category | Proceeds line | Gain/loss line |
|---|---:|---:|
| Qualified small business corporation shares | `10699` | `10700` |
| Qualified farm or fishing property | `10999` | `11000` |
| Qualified farm/fishing foreclosure or repossession | `12399` | `12400` |
| Public shares, mutual funds, and other shares | `13199` | `13200` |
| Real estate, depreciable property, and other property | `13599` | `13800` |
| Bonds, debentures, notes, similar property, and foreign-currency capital dispositions | `15199` | `15300` |
| Crypto-assets | `15200` | `15301` |
| Other mortgage foreclosures or repossessions | `15499` | `15500` |

Other important Schedule 3 lines include principal-residence designation `17900`, flipped-property amounts `17905` and `17906`, personal-use-property gain `15800`, listed-personal-property net gain `15900`, capital-gain deferral `16100`, slip-reported gains `17400` and `17600`, business-investment-loss reduction `17800`, reserves `19200`, total gain/loss `19700`, partnership-interest amount subject to 100% inclusion `19890`, and result `19900`. A positive `19900` transfers to T1 line `12700`; a negative result is not entered on line `12700` and may engage `T1A` carryback rules.

### Securities and T5008

`T5008` box `21` is proceeds or settlement amount. Selling expenses are not deducted from box 21; they are entered separately in the Schedule 3 calculation. Box `20` is cost or book value and CRA warns that it may not equal the investor's adjusted cost base. The application must maintain or request independent ACB evidence rather than treating box 20 as authoritative.

Identical-property averaging, stock splits and consolidations, reinvested distributions, return of capital, employee options, foreign currency, and superficial losses require transaction history beyond a single slip. A superficial loss can involve an acquisition by the taxpayer or an affiliated person in the period from 30 days before through 30 days after the sale plus ownership or a right to acquire 30 days after the sale. Do not claim the loss until the affiliation, timing, and ownership tests are reviewed.

Escalate principal residences (`T2091(IND)` or `T1255`), changes in use, flipped property, depreciable property/CCA recapture, reserves (`T2017`), capital-gains deduction (`T657`), donated securities (`T1170` and Schedule 9), ABIL, options/derivatives, foreclosures, tax shelters, QSBCS, QFFP, and listed personal property.

### Crypto-assets

CRA treats a crypto-asset transaction as a possible business-income transaction or capital transaction based on the facts. Dispositions include exchange for fiat currency, exchange for another crypto-asset, use to buy goods or services, and gifts or donations. A transfer between wallets owned by the same person is an example CRA lists as not being a disposition.

For a business activity, report the full business profit or loss through `T2125` and `T4002`. For a capital transaction, use Schedule 3 lines `15200` and `15301`. Crypto capital losses do not offset employment or business income.

Collect the complete transaction and valuation record: date/time, asset and quantity, Canadian-dollar value, transaction purpose, wallet/exchange/counterparty, fees, acquisition history, transfers between owned wallets, and the source of each exchange rate. Mining, staking, rewards, lending, liquidity provision, airdrops, forks, gifts, donations, derivatives, inventory valuation, barter transactions, and GST/HST on commercial activity require separate classification and specialist review.

## Foreign income, foreign tax credits, and T1135

### Income routing

- Foreign employment income not reported on a T4: T1 line `10400`.
- Foreign interest and dividends: generally T1 line `12100`; foreign dividends do not receive the Canadian dividend tax credit.
- Foreign pension: generally line `11500`, with a possible treaty deduction at line `25600` only when official conditions are met.
- Foreign rental income: `T776`, gross line `12599`, net line `12600`.
- Foreign business income: the applicable self-employment statement and gross/net lines.
- Foreign capital dispositions: Schedule 3 in Canadian dollars.

Use the Bank of Canada rate in effect on the transaction date or another rate CRA accepts for the circumstances. Consistent annual-average use may be acceptable for amounts received evenly throughout a year, but capital transactions generally require transaction-date conversion. Record the rate, date, source, and conversion method; do not fetch or select a rate silently.

### Federal and Ontario foreign tax credits

Use `T2209 E (25)` for the 2025 federal foreign tax credit and `T2036 E (25)` for a provincial or territorial foreign tax credit. The non-business credit is generally limited to the lesser of qualifying foreign tax paid and Canadian tax otherwise payable on the relevant net foreign income, calculated by country under the forms.

Known official-source conflict: the current `T2209 E (25)` form transfers its line 13 result to T1 line `40500`, while CRA's line-40500 web page says line 12. The product must prefer the current annual form for the form calculation while prominently flagging the conflict and requiring manual confirmation; it must not silently reconcile the mismatch.

For Ontario, CRA's 2025 instructions place the provincial foreign tax credit on `ON428` line 82 and require `T2036` with a paper return. The federal paper attachment instructions can require `T2209`, official proof of foreign taxes, and a calculation note; U.S. tax claims have additional listed documents.

### T1135

`T1135 E (23)` applies to 2015 and later years. It is required for a resident taxpayer if total cost amount of specified foreign property exceeded CAD $100,000 at any time in the year, even if the property was later sold. Cost amount is not current fair market value.

- Part A may be used when total cost exceeded $100,000 but remained below $250,000 throughout the year.
- Part B is required when total cost was $250,000 or more at any time.
- The due date follows the person's return due date even if a T1 return is otherwise not required.
- An individual generally does not file `T1135` for the first year they become resident in Canada.
- A paper `T1135` may be attached to a paper T1 or mailed separately to CRA's specified foreign-reporting address.

Specified foreign property can include foreign funds, non-resident shares and debt, interests in non-resident trusts or certain partnerships, foreign real property, precious metals or futures outside Canada, and rights or options over such property. Exclusions can include personal-use property, property used exclusively in an active business, foreign affiliates, and property held in listed registered plans or through certain Canadian entities. Every inclusion and exclusion is fact-dependent and must be reviewed.

Canadian registered securities dealer or trust-company aggregate reporting under T1135 Category 7 does not remove the income-reporting obligation. Partnership and trust ownership can move the T1135 filing obligation to another entity or create additional reporting; escalate instead of duplicating a filing automatically.

## Special-status boundaries

### Deceased person and estate

A legal representative files a final T1 for every deceased person. Income after death can require a separate `T3RET` for the estate. Eligible income may be reported on optional T1 returns, but each optional return is a separate return and the income cannot also remain on the final return.

Collect the date of death, province of residence at death, legal representative, estate address, representative capacity, income-period allocation, and optional-return eligibility. The representative must sign in that capacity. Optional returns require the CRA labels described in the deceased-person instructions, including `70(2)`, `150(4)`, or `104(23)(d)` as applicable.

This is a hard escalation: generate only clearly labelled draft paper packages and require legal-representative or specialist review. Do not merge T3 estate income into the T1 flow.

### Bankruptcy

CRA divides the year into pre-bankruptcy, possible in-bankruptcy, and post-bankruptcy returns. The trustee must file an unfiled required prior-year return and the pre-bankruptcy return from January 1 through the day before bankruptcy. The trustee may file an in-bankruptcy return for specified liquidated assets or businesses. The taxpayer is responsible for the post-bankruptcy return from the bankruptcy date through December 31 if the trustee does not file it.

Each year-of-bankruptcy return must be labelled above the Identification section. Responsibility, income periods, credits, losses, and property are not interchangeable. This is a hard escalation to a licensed insolvency trustee or qualified professional; the product must not create one ordinary annual flow.

### Emigrant, non-resident, and deemed resident

Residency is a fact-sensitive determination involving residential ties and the circumstances of entering, leaving, and stays. The application must not issue a definitive residency determination. It may direct the user to CRA's `NR73` or `NR74` opinion process and require confirmation of the package selected.

- An emigrant generally uses the package for the province or territory of residence on the date of departure.
- A non-resident or deemed resident uses the 2025 non-resident/deemed-resident package, including `5013-R` and applicable Schedules A, B, and C.
- Section 216 rental and section 217 pension/benefit elections use separate guides and return logic (`T4144` and `T4145`).
- A business with a permanent establishment in another jurisdiction can require `T2203`.
- Emigrant deemed dispositions can require `T1243`; property listing can require `T1161` when the official $25,000 fair-market-value threshold and conditions are met; a deferral election can require `T1244`.

Tax-treaty residence, deemed acquisition/disposition, security for departure tax, Canadian-source withholding, taxable Canadian property, section 116, section 216, section 217, and world-income schedules are hard-escalation topics.

### Trusts

Trust and estate income tax returns use the T3 regime, including `T3RET` and Guide `T4013`, not the ordinary T1 self-employment flow. A T3 slip received by an individual can feed the individual's T1, Schedule 3, foreign-income, or foreign-tax calculations, but the trust's own return remains separate. Non-resident or deemed-resident trusts and beneficial-ownership reporting require specialist review.

## Mandatory escalation matrix

| Trigger | Required product response |
|---|---|
| Business-versus-property or business-versus-capital classification is uncertain | Preserve both possible routes, prevent final calculation, request qualified review. |
| Missing slip, incomplete ACB, incomplete crypto history, or unknown foreign exchange rate | Do not invent a value; list missing evidence and block affected calculation. |
| Tax shelter, limited partnership, at-risk amount, partnership loss, or permanent establishment outside Ontario | Add applicable form prompts and require specialist review. |
| Farming/fishing special method or program form | Require the exact method/program selection and annual form. |
| Rental CCA, recapture, terminal loss, change in use, principal residence, or short-term-rental compliance | Require property history and specialist review. |
| Schedule 3 principal residence, flipped property, QSBCS/QFFP, ABIL, reserve, gift, derivative, foreclosure, or superficial loss | Require the relevant official form and calculation review. |
| T1135 threshold/exclusion uncertainty, foreign affiliate, foreign partnership/trust, treaty, or first-year residency | Block automatic T1135 conclusion and escalate. |
| Deceased, estate, bankruptcy, emigrant, non-resident, deemed resident, or trust return | Switch to a distinct draft-paper workflow; never force the ordinary Ontario resident flow. |
| Any annual form/source conflict | Display both official references, prefer the current annual form only as a documented provisional rule, and require acknowledgement. |

## Source register

All sources were accessed on 2026-08-14. URLs are exact official Canada.ca/CRA sources.

| ID | Tax year/revision | Official source |
|---|---|---|
| SRC-001 | 2025 | [File an income tax and benefit return on paper](https://www.canada.ca/en/services/taxes/income-tax/personal-income-tax/how-file/paper.html) |
| SRC-002 | current routing; verify at generation | [Where to mail your paper T1 return](https://www.canada.ca/en/revenue-agency/corporate/contact-information/where-mail-your-paper-t1-return.html) |
| SRC-003 | 2025 | [Get a T1 income tax package](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package.html) |
| SRC-004 | 2025 Ontario | [Ontario income tax package](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario.html) |
| SRC-005 | `5006-R`, 2025 | [Ontario Income Tax and Benefit Return](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-r.html) |
| SRC-006 | `5000-G`, 2025 | [Federal income tax and benefit information](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-g.html) |
| SRC-007 | 2025 Ontario | [Ontario tax information](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-pc.html) |
| SRC-008 | current payment routing; verify at generation | [Pay through the mail](https://www.canada.ca/en/revenue-agency/services/about-canada-revenue-agency-cra/pay-cheque.html) |
| SRC-009 | `T2125`, 2025 | [Statement of Business or Professional Activities](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t2125.html) |
| SRC-010 | `T4002(E) Rev. 25` | [Self-employed income guide](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4002.html) |
| SRC-011 | `T4002(E) Rev. 25` | [T4002 Chapter 2 — income and form mappings](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4002/t4002-4.html) |
| SRC-012 | 2025 activity forms | [How to account for business income](https://www.canada.ca/en/revenue-agency/services/tax/businesses/small-businesses-self-employed-income/business-income-tax-reporting/business-income/account-your-business-income.html) |
| SRC-013 | `T2042`, 2025 | [Statement of Farming Activities](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t2042.html) |
| SRC-014 | `T2121`, 2025 | [Statement of Fishing Activities](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t2121.html) |
| SRC-015 | current registration rules | [When to register for and start charging GST/HST](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html) |
| SRC-016 | `RC4022`, current | [General information for GST/HST registrants](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4022/general-information-gst-hst-registrants.html) |
| SRC-017 | `T776`, 2025 | [Statement of Real Estate Rentals](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t776.html) |
| SRC-018 | `T4036(E) Rev. 25` | [Rental Income guide](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4036.html) |
| SRC-019 | `T4036(E) Rev. 25` | [Rental income calculations](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4036/rental-income.html) |
| SRC-020 | current | [Capital cost allowance for rental property](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/rental-income/capital-cost-allowance-rental-property.html) |
| SRC-021 | 2024 onward | [Rental expenses you cannot deduct](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/rental-income/rental-expenses-you-cannot-deduct.html) |
| SRC-022 | `5000-S3 E (25)` | [Schedule 3 — Capital Gains or Losses](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/5000-s3.html) |
| SRC-023 | `T4037`, 2025 | [Capital Gains guide](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4037.html) |
| SRC-024 | 2025 | [Completing Schedule 3](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/personal-income/line-12700-capital-gains/completing-schedule-3.html) |
| SRC-025 | current | [Capital gains and losses from information slips](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/personal-income/line-12700-capital-gains/completing-schedule-3/capital-gains-losses-information-slips.html) |
| SRC-026 | `T4091`, current | [T5008 Guide — Return of Securities Transactions](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4091/t5008-guide-return-securities-transactions.html) |
| SRC-027 | current | [Reporting income from crypto-asset transactions](https://www.canada.ca/en/revenue-agency/programs/about-canada-revenue-agency-cra/compliance/cryptocurrency-guide/income-crypto-transactions.html) |
| SRC-028 | current | [Crypto-assets and taxes](https://www.canada.ca/en/revenue-agency/programs/about-canada-revenue-agency-cra/compliance/cryptocurrency-guide/crypto-assets-tax-obligations.html) |
| SRC-029 | `T2209 E (25)` | [Federal Foreign Tax Credits PDF](https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/t2209/t2209-25e.pdf) |
| SRC-030 | 2025 web instruction | [Line 40500 — Federal foreign tax credit](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-40500-federal-foreign-tax-credit.html) |
| SRC-031 | `T2036 E (25)` | [Provincial or Territorial Foreign Tax Credit](https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t2036.html) |
| SRC-032 | `T1135 E (23)`, 2015 and later | [Foreign Income Verification Statement](https://www.canada.ca/en/revenue-agency/services/tax/international-non-residents/information-been-moved/foreign-reporting/foreign-income-verification-statement.html) |
| SRC-033 | `T1135`, current guidance | [Questions and answers about Form T1135](https://www.canada.ca/en/revenue-agency/services/tax/international-non-residents/information-been-moved/foreign-reporting/questions-answers-about-form-t1135.html) |
| SRC-034 | 2025 | [Prepare returns for someone who died](https://www.canada.ca/en/revenue-agency/services/tax/individuals/life-events/doing-taxes-someone-died/prepare-returns.html) |
| SRC-035 | 2025 | [What returns to file for someone who died](https://www.canada.ca/en/revenue-agency/services/tax/individuals/life-events/doing-taxes-someone-died/prepare-returns/what-to-file.html) |
| SRC-036 | 2025 | [T3 Trust Guide](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4013.html) |
| SRC-037 | current | [Doing taxes when filing for bankruptcy](https://www.canada.ca/en/revenue-agency/services/tax/individuals/information-on-bankruptcy.html) |
| SRC-038 | `T4058(E) Rev. 25` | [Non-Residents and Income Tax](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4058.html) |
| SRC-039 | 2025 | [Non-resident and deemed-resident tax package](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/non-residents.html) |
| SRC-040 | current | [Dispositions of property for emigrants](https://www.canada.ca/en/revenue-agency/services/tax/international-non-residents/individuals-leaving-entering-canada-non-residents/dispositions-property.html) |
| SRC-041 | `T5013-INST(E) Rev. 25` | [Statement of Partnership Income — instructions for recipient](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t5013-inst/statement-partnership-income-instructions-recipient.html) |
| SRC-042 | `T4068`, 2025 | [Guide for the Partnership Information Return](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4068.html) |

## Unresolved implementation gaps

1. CRA forms and web pages can be revised after this access date. The application needs a controlled source-refresh and version-approval process before supporting a new tax year.
2. The T2209 line-transfer conflict must remain visible until CRA publishes consistent instructions.
3. Mailing and payment addresses are operational data and require refresh at package generation; a static research snapshot is not sufficient.
4. This inventory does not define a tax engine, PDF field coordinates, validation schema, or legal eligibility rules. Those require separate implementation work against the exact annual PDFs.
5. Elections, designations, carrybacks, reserves, loss limitations, and classification questions cannot be inferred safely from a generic complex-income flow.
6. Trust, estate, bankruptcy, emigrant, non-resident, deemed-resident, tax-shelter, and multi-jurisdiction returns need distinct workflows and qualified review; the ordinary Ontario T1 flow is not a fallback.
7. GST/HST registration and return preparation remain separate from the T1 mail-in package. The application may identify an interaction but must not imply that the T1 package satisfies GST/HST obligations.
8. This source set is English-language research. Production must use the official form language chosen by the filer and must not mix English and French annual form revisions.
