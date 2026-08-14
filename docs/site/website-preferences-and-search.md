# Website preferences, search, and accessibility

## Status

**Included in the initial website implementation; browser verification not performed in this change.**

## Behavior

The documentation website is designed as a responsive, tabbed interface using Material Design 3 principles. It provides documentation navigation, local presentation preferences, and site search. Search uses plain text by default and offers an anchored regular-expression builder beside the search field for users who deliberately enable pattern matching.

The regular-expression builder should expose the active pattern and flags, give syntax feedback, and keep invalid patterns from being applied as though they were valid. Search remains a documentation-navigation feature; it does not search a user's tax records or desktop files.

## Configuration

Website preferences may include presentation choices such as theme and navigation state. These preferences are intended to be stored only in the visitor's browser and do not create an account. Clearing the site's stored data resets them.

The initial site should remain usable without saved preferences. If storage is unavailable, the site should continue with documented defaults and explain that persistence is unavailable rather than reporting a successful save.

## Accessibility

The site is designed for keyboard navigation, visible focus, semantic headings and landmarks, readable contrast, reduced-motion preferences, and responsive layouts suitable for narrow screens. Tab controls, preference controls, and search controls require accessible names and states.

These are implementation requirements. This documentation change did not perform an accessibility evaluation or browser interaction check.

## Failure modes

- Browser storage is refused or cleared, causing preferences to reset.
- JavaScript is unavailable, limiting interactive navigation, preferences, or pattern search.
- A regular expression is invalid or exceeds the site's evaluation limits.
- A search has no matching article.
- A narrow viewport requires navigation to collapse without hiding the current location.

The site should retain readable documentation and honest status messages in these conditions. It must not imply that a preference was saved or a pattern was applied when it was not.

## Security and privacy

Search terms and preferences should remain local to the browser. Visitors should not paste tax records, credentials, account numbers, or other sensitive information into the website search field. The site must not use the search field as a network submission form.

## Verification status

No tests, lint checks, type checks, accessibility checks, reviews, screenshots, or browser-based quality assurance were run for this initial website documentation change.

## Related articles

- [Local-first privacy](local-first-privacy.md)
- [Installer and releases](installer-and-releases.md)
- [Verification status](verification-status.md)
