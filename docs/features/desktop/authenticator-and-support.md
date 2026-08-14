# Authenticator and support tickets

## Authenticator

The application implements the standard time-based one-time password algorithms with the host cryptography
implementation. This is a standards utility only: it is bound to no account in this product, it grants access to
nothing, and it performs no network access.

A pairing is presented three ways, all generated on this computer: a pairing code painted as inline vector shapes, the
raw pairing address, and the manual base32 secret. The countdown and the next-code window are shown once a pairing is
confirmed. A wrong confirmation code is refused with a clear message that discloses nothing about the secret.

The shared secret is sealed with the operating system's protected storage and is never returned to the interface
after the registration screen is dismissed.

There is no network, no email and no server-side recovery. If the shared secret is lost, the pairing has to be
removed and registered again.

## Support tickets

A ticket is a private note stored on this computer, with open, in progress and resolved states, searchable with the
shared search builder and exportable through the export path.

The Social Insurance Number, an address and project answers are never placed in a ticket body. Anything shaped like a
government identifier, a monetary amount or an absolute filesystem path is removed from the body before it is stored,
and the categories that were removed are reported back.

## Boundaries

The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing. Neither the authenticator nor a ticket sends anything anywhere.

## Failure modes

- Protected storage that is unavailable prevents a pairing from being stored, and says so.
- A ticket state change that is not an allowed transition is refused with the reason.

## Verification status

The application build (`npm run build --workspace @material-tax-reporting/desktop`) was run and completed, and the generated main, preload and renderer bundles were parsed to confirm they are syntactically valid. No tests, lint, type checks, packaging, installer creation, release, runtime launch, screenshot, accessibility conformance check, performance measurement or native-speaker language review were run for this change, so none is claimed here.

## Related articles

- [Element locks](element-locks.md)
- [Exports and bulk actions](exports-and-bulk-actions.md)
- [Notifications](notifications.md)
