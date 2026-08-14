# Local-first privacy

## Status

**Product requirement defined; packaged-runtime verification not yet published.**

## Behavior

Material Tax Reporting is intended to keep tax-report preparation data on the user's computer. The public website is informational and must not request tax records, account credentials, government identifiers, or financial documents. The desktop application must not transmit tax data or a generated package to the CRA or a third-party filing service.

Local-first does not mean that every future feature is automatically offline or risk-free. Any feature that introduces a network request must disclose what is sent, where it is sent, why it is required, and how the user controls it before that feature is described as available. A network request must never be used for NETFILE, EFILE, electronic submission, direct CRA transmission, automatic filing, or a simulated submission.

## Configuration

The website's presentation preferences are intended to remain in browser-local storage. They are separate from desktop tax data and can be reset by clearing the site's stored data. The website must not present these preferences as an account, synchronization service, or secure vault.

No desktop storage location, encryption mechanism, retention policy, backup behavior, or deletion workflow is claimed as verified yet. Those details must be documented from an implemented release rather than invented in advance.

## Failure modes

- Browser storage is unavailable, blocked, full, or cleared, so website preferences return to defaults.
- A private-browsing session discards website preferences when the session ends.
- A future desktop feature requires network access but does not have a complete disclosure.
- An official guidance link includes taxpayer data in its URL or request.
- A control implies that PDF generation or printing transmitted a return.
- A user assumes that local storage is the same as encryption, secure backup, or protection from another person who can access the computer.
- A user assumes that closing the application deletes retained data.

The product must describe the actual storage and network behavior. It must not use the term local-first as a substitute for concrete privacy information.

## Security and privacy

- Do not enter tax records or credentials into the public website.
- A personal vocabulary, display name, or mark is local wording that stays in the visitor's own browser. It is never transmitted, never shared with another visitor, and never applied to the sentences that carry a legal, boundary, or disclosure statement: those spans are protected, so no local wording change can rewrite the paper-only statement, the prohibition on electronic filing, or a warning. See [personal vocabulary](../features/site/personal-vocabulary.md).
- Do not treat browser-local preferences as a secure storage mechanism.
- Do not publish sensitive report content in issue trackers, discussions, or other public support channels.
- Treat the CRA mail-in PDF package as sensitive local data; generating it does not send it anywhere.
- Use official paper-filing and mailing guidance without including taxpayer data in the link.
- Verify desktop backup and deletion behavior against a released version before relying on it.

## Verification status

This documentation change did not inspect network traffic, packaged storage, encryption, PDF generation, printing, deletion, backup, or recovery behavior. The local-first statement and no-electronic-submission boundary are explicit product requirements, not runtime verification.

## Related articles

- [Canadian tax-report preparation](canadian-tax-report-preparation.md)
- [Mail-in PDF and manual review](mail-in-pdf-and-manual-review.md)
- [Website preferences and search](website-preferences-and-search.md)
- [Verification status](verification-status.md)
