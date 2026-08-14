# Local-first privacy

## Status

**Product requirement defined; packaged-runtime verification not yet published.**

## Behavior

Material Tax Reporting is intended to keep tax-report preparation data on the user's computer. The public website is informational and must not request tax records, account credentials, government identifiers, or financial documents.

Local-first does not mean that every future feature is automatically offline or risk-free. Any feature that introduces a network request must disclose what is sent, where it is sent, why it is required, and how the user controls it before that feature is described as available.

## Configuration

The website's presentation preferences are intended to remain in browser-local storage. They are separate from desktop tax data and can be reset by clearing the site's stored data. The website must not present these preferences as an account, synchronization service, or secure vault.

No desktop storage location, encryption mechanism, retention policy, backup behavior, or deletion workflow is claimed as verified yet. Those details must be documented from an implemented release rather than invented in advance.

## Failure modes

- Browser storage is unavailable, blocked, full, or cleared, so website preferences return to defaults.
- A private-browsing session discards website preferences when the session ends.
- A future desktop feature requires network access but does not have a complete disclosure.
- A user assumes that local storage is the same as encryption, secure backup, or protection from another person who can access the computer.
- A user assumes that closing the application deletes retained data.

The product must describe the actual storage and network behavior. It must not use the term local-first as a substitute for concrete privacy information.

## Security and privacy

- Do not enter tax records or credentials into the public website.
- Do not treat browser-local preferences as a secure storage mechanism.
- Do not publish sensitive report content in issue trackers, discussions, or other public support channels.
- Verify desktop backup and deletion behavior against a released version before relying on it.

## Verification status

This documentation change did not inspect network traffic, packaged storage, encryption, deletion, backup, or recovery behavior. The local-first statement is an explicit product requirement, not runtime verification.

## Related articles

- [Canadian tax-report preparation](canadian-tax-report-preparation.md)
- [Website preferences and search](website-preferences-and-search.md)
- [Verification status](verification-status.md)
