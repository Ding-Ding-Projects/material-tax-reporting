# Personal vocabulary

## What this is

A person may supply a small local JSON file that renames wording in the interface. The control is present and
explained on the settings destination before any file exists, so the feature is discoverable rather than hidden.

## Schema

A version 1 object with exactly one `replacements` map and no other root fields. Every key is 1 to 80 characters,
every value is a string of at most 200 characters, at most 200 replacements are accepted, and the whole document is
bounded to 64 KB. Keys shaped like prototype members are rejected. The shipped fixtures carry no payload beyond this
neutral schema description.

## What the substitution never changes

Official names and product boundaries survive substitution untouched. The following spans are always preserved:
`CRA`, `Ontario`, `Social Insurance Number`, `mail-in`, `NETFILE` and `EFILE`.

## Where the data lives

Parsing and the derived cache stay in the privileged boundary, inside the application data directory. Vocabulary
content is never placed in a project file, a history record, an export, a log or a notification body. A rejected
document never replaces an accepted one, so the wording already in use cannot be broken by a malformed file.

## Shared mode

A renamable shared mode suppresses the non-English wording features while it is on and restores the previous choices
when it is turned off. The mode's name is stored with the preferences.

## Boundaries

The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing. Renaming wording never renames a form, a field, a limit or the boundary statement.

## Failure modes

- A document that fails validation is refused with the exact reason, and the previous wording stays in place.
- Removing the accepted vocabulary restores the shipped wording immediately and does not touch the file on disk.

## Verification status

The application build (`npm run build --workspace @material-tax-reporting/desktop`) was run and completed, and the generated main, preload and renderer bundles were parsed to confirm they are syntactically valid. No tests, lint, type checks, packaging, installer creation, release, runtime launch, screenshot, accessibility conformance check, performance measurement or native-speaker language review were run for this change, so none is claimed here.

## Related articles

- [Language modes and humour levels](language-and-funny-levels.md)
- [Settings and preferences](settings-and-preferences.md)
- [Exports and bulk actions](exports-and-bulk-actions.md)
