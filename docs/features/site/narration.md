# Read aloud

## Behaviour

The site can read a section aloud using the browser's own speech synthesis. No dependency is added and no audio is fetched. Voices are enumerated from what the browser reports, including the asynchronous event browsers fire when the voice list becomes available.

Bilingual output is strictly serialized by the kernel's narration queue: the English utterance finishes before the Cantonese one begins, and each utterance carries its own language. Exactly one utterance is ever in flight.

Narration starts only from an explicit action: a read control on a section, or an opt-in setting that reads a notification title when one arrives. Nothing is spoken on load. The kernel's exclusion list is honoured, so identifiers, account numbers, mailing addresses, attachment names and unlock answers are never read aloud.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

- Read-aloud on or off.
- An English voice and a Cantonese voice, chosen only from voices the browser reported.
- Rate and pitch, within the kernel's bounds.
- Whether an arriving notification title is read.

## Failure modes

- When the browser exposes no speech synthesis, the controls are disabled and the panel states exactly that.
- When the browser reports no installed voices, the controls are disabled and the panel states exactly that.
- When no reported voice matches a language, the utterance still carries the correct language tag and the browser chooses.

## Privacy and security

Speech happens in the browser and no text is sent anywhere. The excluded field kinds exist because speaking them can disclose them to anybody within earshot.

## Verification status

This lane ran the site build (`npm run pages:build` in `apps/site`) and the source checks in `apps/site/src/checks`. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [Language and humour levels](language-and-funny-levels.md)
- [Notifications](notifications.md)
