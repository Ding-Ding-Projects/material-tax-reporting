# Tax domain package

`@material-tax-reporting/tax-domain` is a local TypeScript domain package for preparing an ordinary 2025 Ontario personal income tax return. Every amount is represented as integer Canadian cents and every calculation selects an explicit tax-year ruleset.

The package provides:

- guided T4, T4A, T5, other-income, deduction, credit, and carry-forward records;
- federal and Ontario progressive tax calculations for tax year 2025;
- the 2025 federal basic personal amount phase-out, Canada employment amount, Ontario surtax, Ontario tax reduction, and Ontario health premium;
- bounded, versioned JSON import and a redacted portable export;
- source-linked validation and fail-closed handling for unsupported tax situations.

## Hard boundary

This package does not implement or support NETFILE, EFILE, electronic submission, direct CRA transmission, simulated filing, or automatic filing. It produces preparation data only. The application may use that data solely to prepare a CRA mail-in PDF package after the user manually inspects every populated form, calculation, attachment, mailing destination, and signature field and explicitly acknowledges that review.

It is not CRA-certified, does not determine universal eligibility, and is not tax, legal, accounting, or financial advice.

## Supported scope

The initial ruleset supports common 2025 Ontario resident returns. Bankruptcy, deceased returns, non-resident returns, multiple jurisdictions, self-employment, rental income, foreign reporting, trusts, tax on split income, alternative minimum tax, farming or fishing, tax shelters, complex capital gains, Indigenous tax exemptions, and special elections fail closed for separate handling.

## Official sources

- [CRA 2025 tax rates and income brackets](https://www.canada.ca/en/revenue-agency/services/tax/individuals/tax-rates-brackets/last-year.html)
- [CRA Ontario 2025 income tax package](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario.html)
- [CRA Ontario tax information for 2025](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-pc.html)
- [CRA payroll deduction formulas for 2025](https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/payroll-deductions-t4127-payroll-deductions-formulas/t4127-jan-120th-edition-effective-january-1-2025/t4127-jan-payroll-deductions-formulas-computer-programs.html)
- [CRA paper-return process](https://www.canada.ca/en/services/taxes/income-tax/personal-income-tax/how-file/paper.html)

## Verification status

No tests, lint, type checking, accessibility checks, runtime review, or captures were run for this initial ultra-speed implementation.
