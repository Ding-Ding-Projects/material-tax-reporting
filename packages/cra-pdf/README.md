# CRA mail-in PDF preparation

`@material-tax-reporting/cra-pdf` is a local-only TypeScript package for preparing a 2025 Ontario personal income tax return as a reviewable PDF package that the taxpayer can print, sign, and mail.

It is not CRA-certified tax software, tax or legal advice, or a filing service. It has no NETFILE, EFILE, electronic-submission, direct-CRA-transmission, simulated-filing, or automatic-filing capability.

## Package boundary

The package:

- supports only the explicitly versioned 2025 Ontario package;
- maps integer-cent calculation lines to semantic form fields deterministically;
- requires a host-pinned SHA-256 profile before it maps semantic fields to physical fields in an official CRA PDF;
- rejects encrypted PDFs, active content, embedded files, missing fields, changed templates, and changed attachments;
- performs preparation through an adapter that declares disabled network access, local-only storage, and atomic writes;
- assembles the return, applicable schedules, and user-supplied attachments into a local temporary PDF;
- creates a manifest with page counts, SHA-256 digests, source declarations, and the explicitly selected tax-centre address; and
- blocks local export and printing until every manual-review item and the final acknowledgement are complete.

The host application remains responsible for implementing the local PDF adapter and for establishing pinned field profiles from the exact official templates it distributes or accepts. A field profile identifies the official source URL, tax year, template digest, and every semantic-to-physical field mapping. An unpinned or incomplete profile fails closed.

## Calculation line contract

Calculation snapshots use keys in the form `DOCUMENT:LINE`, for example `T1:10100`, `S7:1`, `ON428:58040`, or `ON-BEN:61100`. The document prefix must be one of the forms in the 2025 catalog. Values are signed integer Canadian cents; floating-point dollar values are rejected.

The engine maps each key to the semantic field `DOCUMENT.line.LINE`. Identity fields use stable semantic names such as `T1.identity.givenName`. The field profile maps those semantic names to the exact physical fields in a specific official PDF digest.

## Required workflow

1. Validate the versioned case file and stop on unsupported situations.
2. Select the applicable schedules through explicit inclusion flags.
3. Provide one local official template and one pinned field profile for every selected form.
4. Select the current Ontario tax-centre group from the CRA address page; the package does not infer it from free text.
5. Prepare and inspect each form, inspect every attachment, merge them locally, and compare the final page count and digest with the inputs.
6. Create a review preview and a `ManualReviewState` bound to the final package SHA-256.
7. Confirm every populated form, every calculation line, every attachment, the mailing destination, and every signature field one by one.
8. Supply the exact final acknowledgement exported by the package.
9. Create a `PrintAuthorization`, then perform an atomic local export or local print.
10. Complete required handwritten signatures and mail the package to the reviewed address.

Any form, calculation, attachment, mailing destination, signature-field declaration, or other package content change produces a different digest and invalidates the prior review and authorization.

## Portable carry-forward data

`cra-carry-forward.v1` exports only typed carry-forward amounts and their provenance. It explicitly excludes taxpayer identity, social insurance number, addresses, attachments, signatures, and PDF content. The package does not provide an unredacted portable case-file export.

## Supported and unsupported situations

The standard form catalog includes the T1 return, ON428, commonly required federal Schedules 2, 3, 5, 6, 7, 8, 9, 11, 12, 13, and 15, and Ontario ON479, ON-BEN, ON428-A, ON479-A, ON(S2), and ON(S11). Conditional forms are included only when their corresponding case flag is true.

There is no current 2025 Schedule 1 in the official Ontario package, so the catalog does not invent one.

The eligibility assessment blocks non-resident or deemed-resident returns, part-year immigrant or emigrant returns, deceased returns, bankruptcy returns, multiple-jurisdiction business income, farming or fishing income, trust or estate reporting, alternative minimum tax, tax on split income, foreign tax credits, possible T1135 obligations, and complex capital transactions. Specialized forms such as T2125, T776, T778, T1-M, T777, T2203, T2209, T2036, T691, T1206, and T1135 are outside this bounded package.

## Privacy and security

Taxpayer data and PDFs must remain local. The package exposes no network or transmission method. Adapters must not log field values, identifiers, document bytes, local handles, or paths. Temporary artifacts should use private application storage with restrictive permissions and should be removed through the host application's normal local-data retention controls after the user has preserved the final package.

The package never collects payment or banking credentials. A balance payment or refund is handled separately through official CRA channels.

## Verification status

This initial implementation was written under an expedited no-test boundary. No tests, lint, type checking, build, packaging, runtime PDF interaction, accessibility checks, review, or visual capture were run. The source and documentation must not be treated as verified filing output until those activities are separately authorized and completed.

See [`../../docs/features/pdf/cra-mail-package.md`](../../docs/features/pdf/cra-mail-package.md) for the full feature contract and official sources.
