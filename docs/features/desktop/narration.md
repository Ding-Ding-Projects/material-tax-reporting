# Read aloud

## What this is

Narration is rendered entirely in the interface process: the browser engine already provides speech synthesis, so the
only privileged dependency is storing the choice. Narration is off by default.

## Behaviour

- Installed voices are enumerated from the host. An English voice and a Cantonese voice are selected independently.
- When no voice is installed for a language, the surface says so plainly. Nothing is spoken in another language
  instead.
- Speaking rate and pitch are adjustable.
- A shared queue serializes utterances, so a bilingual announcement is spoken English first and then Cantonese and the
  two never overlap.
- Notices, the current question title and the validation line can be read aloud.

## What is never read aloud

The Social Insurance Number field, any mailing address, an unlock answer and an attachment display name are never
narrated, because speaking them can disclose them to anyone within earshot. That exclusion is stated in the setting's
own supporting text and is enforced by the shared rule rather than by convention.

## Boundaries

The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.

## Failure modes

- When the host reports no speech engine, the control explains that read aloud cannot start.
- Requesting narration of an excluded field kind returns the reason instead of speaking.

## Verification status

The application build (`npm run build --workspace @material-tax-reporting/desktop`) was run and completed, and the generated main, preload and renderer bundles were parsed to confirm they are syntactically valid. No tests, lint, type checks, packaging, installer creation, release, runtime launch, screenshot, accessibility conformance check, performance measurement or native-speaker language review were run for this change, so none is claimed here.

## Related articles

- [Settings and preferences](settings-and-preferences.md)
- [Language modes and humour levels](language-and-funny-levels.md)
- [Notifications](notifications.md)
