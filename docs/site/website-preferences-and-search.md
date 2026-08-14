# Website preferences, search, and accessibility

## Status

**Implemented in source; no browser verification has been performed.**

## Behavior

The documentation website is a responsive, tabbed interface built on Material Design 3 tokens. It provides documentation navigation, local presentation preferences, and site search. Search uses plain text by default and offers an anchored regular-expression builder beside the search field for visitors who deliberately enable pattern matching.

The builder exposes the active pattern and flags, reports syntax feedback against a sample, and keeps an invalid pattern from being applied as though it were valid. One engine backs every search field on the site, so a pattern behaves the same way in a list, a filter, a picker, and a menu. The engine and its flag allowlist, length bounds, and anchor tokens are documented in [the shared surface kernel](../features/shared-surface-kernel/README.md); how the builder is bound beside each field on this site is documented in [the website regular-expression builders article](../features/site/regex-builders.md), and the equivalent desktop binding in [the desktop regular-expression builders article](../features/desktop/regex-builders.md).

Search remains a documentation-navigation feature. It searches the site's own bundled articles and lists; it does not search a visitor's tax records or desktop files, and it never sends a query anywhere. The website describes the product as a mail-in PDF preparation tool and must not advertise or simulate electronic filing.

## Configuration

The stored preference record holds the navigation dock position, theme, density, accent colour, font scale, motion setting, language mode, an English humour level and a Cantonese humour level, whether decorative emoji appear in headings, a local display name, the chosen mark, and the read-aloud settings. Alongside it, the site stores the tab layout, per-element appearance overrides, a personal vocabulary document, presentation schedules, element locks, local history, notifications, and support notes, each under its own versioned key.

Everything in the previous paragraph is stored only in the visitor's own browser. None of it creates an account, and none of it is transmitted. Clearing the site's stored data resets all of it. Individual articles describe each store: see [website preferences and personalization](../features/site/README.md) for the full set.

The site remains usable without saved preferences. If storage is unavailable, the site continues with the documented defaults and states that persistence is unavailable rather than reporting a successful save.

## Accessibility

The site is designed for keyboard navigation, visible focus, semantic headings and landmarks, readable contrast, reduced-motion preferences, and responsive layouts suitable for narrow screens. Tab controls, preference controls, and search controls require accessible names and states.

These are implementation requirements, and the source is written to meet them. No accessibility evaluation, keyboard walkthrough, contrast measurement, or browser interaction check has been performed, so none of them is claimed as conformance.

## Failure modes

- Browser storage is refused or cleared, causing preferences to reset.
- JavaScript is unavailable, limiting interactive navigation, preferences, or pattern search.
- A regular expression is invalid or exceeds the site's evaluation limits.
- A search has no matching article.
- A narrow viewport requires navigation to collapse without hiding the current location.

The site should retain readable documentation and honest status messages in these conditions. It must not imply that a preference was saved or a pattern was applied when it was not.

## Security and privacy

Search terms and preferences should remain local to the browser. Visitors should not paste tax records, credentials, account numbers, or other sensitive information into the website search field. The site must not use the search field as a network submission form, and no website control may suggest that it sends a return to the CRA.

## Verification status

The website's production build completed and emitted its static bundle. Nothing else about this surface was checked: no browser opened the site, and no test, lint check, type check, accessibility check, review, screenshot, or other capture was produced for it. The per-capability evidence gaps are recorded in `docs/features/feature-inventory.json`.

## Related articles

- [Regular-expression builders](../features/site/regex-builders.md)
- [Local-first privacy](local-first-privacy.md)
- [Mail-in PDF and manual review](mail-in-pdf-and-manual-review.md)
- [Installer and releases](installer-and-releases.md)
- [Verification status](verification-status.md)
