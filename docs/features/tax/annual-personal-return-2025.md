# 2025 Ontario annual personal return

## Purpose

The tax-domain package models a broadly useful ordinary 2025 personal income tax return for an Ontario resident. It collects common slips, deductions, credits, and carry-forward balances, validates them against an explicit schema, calculates federal and Ontario amounts, and exposes line-oriented output for the CRA mail-in PDF preparation package.

This feature is not CRA-certified and does not establish eligibility. It is not tax, legal, accounting, or financial advice.

## Tax-year selection

Tax rules are selected by the literal tax year. The only implemented ruleset is `2025`; another year fails closed instead of reusing stale thresholds.

The 2025 federal brackets are 14.5%, 20.5%, 26%, 29%, and 33% at the thresholds published by the CRA. The 2025 Ontario brackets are 5.05%, 9.15%, 11.16%, 12.16%, and 13.16%. The ruleset also includes the federal basic personal amount phase-out, Canada employment amount, Ontario basic personal amount, Ontario surtax, Ontario tax reduction, and Ontario health premium.

Authoritative references:

- [CRA: 2025 tax rates and income brackets](https://www.canada.ca/en/revenue-agency/services/tax/individuals/tax-rates-brackets/last-year.html)
- [CRA: Ontario 2025 income tax package](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario.html)
- [CRA: Ontario tax information for 2025](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-pc.html)
- [CRA: 2025 payroll deduction formulas](https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/payroll-deductions-t4127-payroll-deductions-formulas/t4127-jan-120th-edition-effective-january-1-2025/t4127-jan-payroll-deductions-formulas-computer-programs.html)
- [CRA: Canada employment amount for 2025](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-31260-canada-employment-amount.html)

## Guided intake

The versioned input schema accepts:

- identity and Ontario year-end residency facts;
- T4 employment income, CPP allocation, EI premiums, tax withheld, and union dues;
- T4A income allocated to supported T1 lines;
- T5 interest, taxable dividend, and dividend-credit amounts;
- additional supported T1 income lines;
- deductions with their T1 line and an acknowledgement that the official worksheet was checked;
- federal and Ontario credit amounts with the same explicit review acknowledgement;
- guided medical expenses, donations, carry-forward balances, and Ontario tax-reduction dependant counts.

Money is stored as non-negative integer Canadian cents. Slip, income, deduction, and credit record identifiers must be unique. Duplicate pathways such as T4 union dues plus a separate line 21200 amount are reported for review.

## Calculations

The package calculates and records:

1. common income lines and total income;
2. net-income deductions and line 23600;
3. taxable-income deductions and line 26000;
4. progressive federal and Ontario tax;
5. federal and Ontario non-refundable credit bases for supported inputs;
6. federal and Ontario donation credits, subject to the ordinary 75% net-income limit;
7. Ontario surtax, tax reduction, and health premium;
8. federal tax, Ontario tax, total payable, withholding, balance owing, or refund estimate;
9. remaining donation carry-forward plus imported carry-forward balances.

Amounts that require schedules or facts outside the package are accepted only as line-specific, manually checked inputs. This prevents the package from inventing eligibility facts.

## Unsupported situations

The ordinary ruleset fails closed when any of these are declared:

- bankruptcy or a deceased-person return;
- non-residence, immigration/emigration adjustments, or multiple tax jurisdictions;
- self-employment, rental, farming, fishing, trust, or estate income;
- foreign income or reporting, including a possible T1135 obligation;
- tax on split income or alternative minimum tax;
- tax shelters, complex capital gains, Indigenous tax exemptions, or special elections.

Use the applicable official form or qualified assistance for those situations. The package must never silently calculate an ordinary resident return around them.

## Paper-only completion workflow

The product ends with preparation of a CRA mail-in PDF package. It must not implement, offer, advertise, simulate, or imply NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.

Before export or print, the user must manually inspect every populated form, calculation, attachment, mailing destination, and signature field, then explicitly acknowledge the completed review. A calculation result by itself cannot satisfy that requirement.

The CRA says a paper return must include the federal return, provincial Form 428, and applicable schedules, must be reviewed for truth, accuracy, and completeness, and can be sent only by mail. See [Filing a paper tax return](https://www.canada.ca/en/services/taxes/income-tax/personal-income-tax/how-file/paper.html).

## Failure modes

- An unsupported year, province, schema, amount, identifier, residency state, or tax situation blocks calculation.
- Unchecked deduction or credit worksheets produce mandatory review items.
- Conflicting guided and direct medical inputs block calculation.
- A calculation can remain arithmetically available while review warnings are present, but PDF export and print remain blocked until the separate manual-review workflow is complete.

## Verification status

No tests, lint, type checks, accessibility checks, runtime review, or captures were run for this implementation. The rules and outputs are not verified release evidence.
