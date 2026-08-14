# Element locks

## Behaviour

A lock guards an element, or one appearance property of an element, behind a question. It exists to make an accidental edit harder, and the kernel's disclosure is repeated on every lock surface: a lock is an interface guard with no security property, and it protects no stored data.

Every mutation is routed through one guarded setter, so a locked target cannot be changed by the settings grid, by the command palette, by the appearance editor or by a scheduled rule.

A wrong answer shows the hint, counts the attempt and leaves the control disabled. A correct answer unlocks the target for the kernel's grace period and relocks on a timer that is re-checked whenever the tab becomes visible again, so a backgrounded tab cannot stay unlocked.

The answer is never stored. The kernel keeps a salted key-derivation verifier and compares it in length-constant time.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

- A locked-items list with its own anchored builder.
- A hint of up to the kernel's limit, shown only after an incorrect attempt.
- A documented reset path: remove a lock while it is unlocked, or clear this site's data in the browser, which removes the locks with the other local preferences.

## Failure modes

- An answer outside the accepted length is refused before a lock is created.
- A browser without a Web Cryptography implementation cannot create a lock and reports that.
- A stored record that is not a lock is discarded when the list is read.

## Privacy and security

The verifier is stored in this browser. Because a lock protects no data, losing every answer costs nothing beyond clearing the local records.

## Verification status

This lane ran the site build (`npm run pages:build` in `apps/site`) and the source checks in `apps/site/src/checks`. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [Appearance editor](appearance-editor.md)
- [Local history](local-history.md)
