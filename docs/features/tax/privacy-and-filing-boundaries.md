# Privacy, eligibility, and filing boundaries

## Local preparation only

Taxpayer identity, slips, calculations, supporting-document references, and exports are private local data. The tax-domain package has no network client and no transmission API. Applications consuming it must keep tax data local by default and document any storage location or user-directed export separately.

Never place real taxpayer data, government identifiers, completed returns, receipts, or local storage paths in source control, logs, telemetry, analytics, issue reports, captures, or release records.

## Filing boundary

The application must not implement, offer, advertise, simulate, or imply:

- NETFILE;
- EFILE;
- electronic submission;
- direct CRA transmission;
- automatic filing;
- a button or status that suggests a return was filed.

The final application capability is generation of a CRA mail-in PDF package. The only submission route it may describe as its own workflow is printing and mailing that reviewed package.

## Mandatory manual review

Export and print must fail closed until the user has inspected:

1. every populated form and schedule;
2. every calculation and carried amount;
3. every included or retained attachment;
4. the current mailing destination selected from official CRA guidance;
5. every signature field;
6. the package-wide final acknowledgement.

Completing one item must not complete another. Changing a calculation, form, attachment, address, or signature state invalidates the affected review and the final acknowledgement.

The CRA instructs paper filers to review their return for truth, accuracy, and completeness and states that a paper return can be sent only by mail. Mailing destinations depend on the filer’s location and may change, so an address must be confirmed from the current [CRA mailing-address page](https://www.canada.ca/en/revenue-agency/corporate/contact-information/where-mail-your-paper-t1-return.html) at preparation time.

## Eligibility boundary

The package supports an ordinary subset of 2025 Ontario personal returns. It does not claim universal eligibility or replace the official guides, forms, CRA guidance, or a qualified professional. Unsupported complex situations are explicit blocking conditions rather than guessed calculations.

## Record retention

The CRA says tax documents and records generally should be kept for at least six years and that a copy of the return and notices of assessment or reassessment should be retained. See [How long should you keep your income tax records?](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/long-should-you-keep-your-income-tax-records.html).

## Verification status

No tests, lint, type checks, privacy review, runtime review, or captures were run for this implementation.
