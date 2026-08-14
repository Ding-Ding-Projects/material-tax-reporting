# Guided report wizard

## Behaviour

The wizard presents one question at a time. Every question states:

- what information is being requested;
- why the report needs it;
- where the user can find the source information;
- an example of the expected format without pre-populating taxpayer data;
- the validation rule; and
- the next step.

The initial screen is an honest empty state. It creates a new encrypted project or previews an existing one. It does not seed sample people, slips, amounts, forms, or filing results.

The current wizard covers legal identity, tax-year-scoped Ontario residency, return address, income-document review, encrypted local attachments, optional deduction review notes, a user-verified CRA mailing destination, and the final manual PDF checklist. Ontario is explicit because the currently recorded rule sources are Canada and Ontario sources; the app does not silently apply those rules to another province.

## Persistence

Selecting **Save answer and continue** validates the current answer at the privileged application boundary. A changed answer creates one new append-only local Git commit containing an authenticated encrypted state snapshot. An unchanged answer creates no artificial history entry.

Adding, confirming, or removing an attachment also creates its own history commit. Attachment bytes are encrypted before entering app-private storage. Parser confirmation metadata records only bounded identifiers and timestamps outside the encrypted state.

## Failure modes

- An invalid answer stays on the current question and explains the exact expected shape.
- If protected storage or local history is unavailable, the mutation is not reported as saved.
- If the single project file cannot be replaced atomically, the prior file is preserved and the app reports that Save did not complete.
- A missing bundled OCR runtime reports every packaged location that was searched. The app does not search `PATH`, download a runtime, or use a cloud fallback.

## Security and privacy

The renderer cannot read project files, Git repositories, protected keys, or packaged OCR resources directly. Those operations live in the main process and are exposed through a bounded context-isolated preload API. Project passwords are sent only for the current create, preview, or copy operation and are cleared from renderer inputs immediately afterward.

Plain taxpayer values and usable secrets are never written to Git. Each Git snapshot contains an AES-256-GCM envelope authenticated to the stable project and revision identifiers.

## Verification status

This ultra-speed implementation lane did not run tests, lint, type checks, a build, packaging, a runtime launch, review, or screenshots. The source and contract exist; runtime behaviour remains unverified until a later authorized verification lane exercises the built artifact.

## Suggested articles

- [Encrypted project files](encrypted-project-files.md)
- [Append-only local history](local-history.md)
- [Manual PDF review](../pdf/manual-review.md)
