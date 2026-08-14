# Authenticator utility and support notes

## Behaviour

The authenticator panel is a standards utility. This site has no accounts, so the shared secret it creates is bound to nothing here and grants access to nothing. It generates a secret, shows the current code with a live countdown, shows the next code, and checks a code a reader types, accepting one period of clock drift on either side.

The QR image is drawn from the kernel's own encoder as inline vector shapes. There is no external image, no content delivery network and no network access of any kind.

Support notes are problem descriptions kept in this browser. There is no support endpoint, no account and no queue behind the panel, and nothing is transmitted. Before a note is saved, the kernel removes anything shaped like a government identifier, a monetary amount or an absolute file path, and names the categories it replaced.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

- Create or remove a shared secret in this browser.
- Create, edit, resolve and reopen a note, each with the state transitions the kernel allows.
- A searchable note list with its own anchored builder, and an export through the shared export path.

## Failure modes

- A browser without a Web Cryptography implementation cannot create a secret and reports that.
- A value that is not valid base32 is refused when a code is produced or checked.
- A note that is too long is truncated at the kernel's limit before it is stored.

## Privacy and security

The secret and the notes stay in this browser. The secret is a local convenience only, and no part of this site treats a code as access to anything.

## Verification status

This lane ran the site build (`npm run pages:build` in `apps/site`) and the source checks in `apps/site/src/checks`. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [Exports and bulk actions](exports-and-bulk-actions.md)
- [Notifications](notifications.md)
