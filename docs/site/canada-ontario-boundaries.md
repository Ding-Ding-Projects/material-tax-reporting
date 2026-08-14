# Canada and Ontario boundary

## Status

**Jurisdiction boundary documented; detailed coverage not yet verified in a release.**

## Behavior

Material Tax Reporting is scoped to Canadian federal and Ontario tax-report preparation. The product must identify whether a field, rule, report, or reference belongs to the federal or Ontario portion of that scope.

The scope does not automatically include every federal or Ontario tax form. A feature is supported only when a published release names it explicitly and provides corresponding verification evidence.

The workflow is paper-only. It ends with a CRA mail-in PDF package after mandatory manual review. NETFILE, EFILE, electronic submission, direct CRA transmission, and automatic filing are not supported and must never be presented as future or unavailable application features.

## Included boundary

The intended jurisdiction boundary covers:

- Canada-level tax-report preparation where explicitly implemented;
- Ontario-level tax-report preparation where explicitly implemented; and
- clear presentation of which jurisdiction applies to an implemented item.

## Outside the product boundary

The following must not be implied by the general Canada and Ontario description:

- tax requirements specific to another province or territory;
- Quebec tax administration;
- municipal tax reporting;
- NETFILE, EFILE, electronic submission, direct CRA transmission, automatic filing, or simulated submission;
- professional tax, legal, accounting, or financial advice;
- automatic support for every tax year, form, schedule, credit, deduction, benefit, or business type.

An unsupported jurisdiction should produce an explicit boundary message. The application must not silently apply an Ontario rule to another jurisdiction or use a federal rule as a substitute for a provincial one.

## Configuration

No jurisdiction or tax-year selector is documented as shipped yet. When these controls are released, they must show the supported values, identify unavailable values, preserve the user's selection locally, and avoid presenting an unsupported selection as valid.

The mailing destination must be reviewed against the CRA's current [paper-return mailing guidance](https://www.canada.ca/en/revenue-agency/corporate/contact-information/where-mail-your-paper-t1-return.html). Documentation and application code must not hard-code a mailing address or assume that a prior year's destination remains current. Current Ontario package information should be taken from the CRA's [Ontario tax package guidance](https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-pc.html).

## Failure modes

- A user needs a province, territory, or filing route outside the documented boundary.
- A tax year or form is absent from the published support list.
- A rule changes after the application release.
- A report combines federal and Ontario information without identifying the source jurisdiction.
- An unavailable value is inferred from a nearby supported value.
- The mailing destination has not been checked against current official CRA guidance.
- The manual review is incomplete or has been invalidated by a changed value.

In each case, the safe outcome is an explicit limitation and a recommendation to consult current official guidance. Guessing or silently substituting a rule is not acceptable.

## Security and privacy

Jurisdiction selection and report content may reveal sensitive personal or financial information. The website must not collect that information, and the desktop product must not transmit it to the CRA or a filing service. The intended local-first boundary is documented in [Local-first privacy](local-first-privacy.md).

## Verification status

No supported-form matrix, tax-year matrix, calculation suite, manual-review workflow, or mail-in PDF package was verified as part of this documentation change. Electronic filing remains prohibited regardless of verification status.

## Related articles

- [Canadian tax-report preparation](canadian-tax-report-preparation.md)
- [Mail-in PDF and manual review](mail-in-pdf-and-manual-review.md)
- [Local-first privacy](local-first-privacy.md)
- [Verification status](verification-status.md)
