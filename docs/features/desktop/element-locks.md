# Element locks

## What this is

A person can lock an individual element, or one appearance property of an element, behind an answer only they know.
Each lock carries its own credential, its own grace period and its own recovery note.

## These are presentation locks

The unlock copy says it plainly: element locks only guard against accidental edits in this interface. They are not a
security control and they do not protect stored data. Project confidentiality comes from the project password and the
encrypted project file.

## How the secret is handled

The interface process never holds a comparison secret. A candidate answer is sent to the privileged boundary, which
derives a salted verifier and answers only accepted or not accepted. Each lock keeps its own salt and verifier, and
the record is sealed with the operating system's protected storage using the same pattern as the project key store,
so no second protected-storage mechanism exists in the application.

Attempts are rate limited in the privileged boundary. After five unsuccessful answers a cooldown applies before
another attempt is accepted.

## What a lock may never cover

The manual PDF review checklist, the mail-in-only disclosure, the wizard validation line, and the ability to save or
close a project can never be locked. Attempting to lock one of those elements is refused.

## History

Every lock, unlock, unsuccessful attempt and reset is recorded as an append-only entry in the project history when a
project is open, under the shared action names.

## Boundaries

The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.

## Failure modes

- Protected storage that is unavailable prevents a lock from being stored, and says so.
- A reset removes the lock without needing the answer and records the reset; it is the documented recovery path.

## Verification status

The application build (`npm run build --workspace @material-tax-reporting/desktop`) was run and completed, and the generated main, preload and renderer bundles were parsed to confirm they are syntactically valid. No tests, lint, type checks, packaging, installer creation, release, runtime launch, screenshot, accessibility conformance check, performance measurement or native-speaker language review were run for this change, so none is claimed here.

## Related articles

- [Appearance editor](appearance-editor.md)
- [Authenticator and support tickets](authenticator-and-support.md)
- [Append-only local history](local-history.md)
