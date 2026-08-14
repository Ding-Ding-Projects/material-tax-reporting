# Canada and Ontario boundary

## Status

**Jurisdiction boundary documented; detailed coverage not yet verified in a release.**

## Behavior

Material Tax Reporting is scoped to Canadian federal and Ontario tax-report preparation. The product must identify whether a field, rule, report, or reference belongs to the federal or Ontario portion of that scope.

The scope does not automatically include every federal or Ontario tax form. A feature is supported only when a published release names it explicitly and provides corresponding verification evidence.

## Included boundary

The intended jurisdiction boundary covers:

- Canada-level tax-report preparation where explicitly implemented;
- Ontario-level tax-report preparation where explicitly implemented; and
- clear presentation of which jurisdiction applies to an implemented item.

## Excluded until explicitly added

The following must not be implied by the general Canada and Ontario description:

- tax requirements specific to another province or territory;
- Quebec tax administration;
- municipal tax reporting;
- direct submission to the Canada Revenue Agency or an Ontario government service;
- professional tax, legal, accounting, or financial advice;
- automatic support for every tax year, form, schedule, credit, deduction, benefit, or business type.

An unsupported jurisdiction should produce an explicit boundary message. The application must not silently apply an Ontario rule to another jurisdiction or use a federal rule as a substitute for a provincial one.

## Configuration

No jurisdiction or tax-year selector is documented as shipped yet. When these controls are released, they must show the supported values, identify unavailable values, preserve the user's selection locally, and avoid presenting an unsupported selection as valid.

## Failure modes

- A user needs a province, territory, or filing route outside the documented boundary.
- A tax year or form is absent from the published support list.
- A rule changes after the application release.
- A report combines federal and Ontario information without identifying the source jurisdiction.
- An unavailable value is inferred from a nearby supported value.

In each case, the safe outcome is an explicit limitation and a recommendation to consult current official guidance. Guessing or silently substituting a rule is not acceptable.

## Security and privacy

Jurisdiction selection and report content may reveal sensitive personal or financial information. The website must not collect that information. The desktop product's intended local-first boundary is documented in [Local-first privacy](local-first-privacy.md).

## Verification status

No supported-form matrix, tax-year matrix, calculation suite, or filing integration was verified as part of this documentation change.

## Related articles

- [Canadian tax-report preparation](canadian-tax-report-preparation.md)
- [Local-first privacy](local-first-privacy.md)
- [Verification status](verification-status.md)
