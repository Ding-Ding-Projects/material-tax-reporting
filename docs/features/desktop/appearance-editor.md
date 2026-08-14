# Appearance editor

## What this is

Every rendered element that may be restyled carries a stable identifier. The appearance editor is opened from an
element context menu, from a tab or group context menu, and from command-palette results, and it writes bounded
custom properties for that one element.

Shift and F10 opens the editor for the focused element, so the feature is reachable without a pointer.

## Tokens and the dark path

The shared Material 3 tokens are the single source of the palette. The complete light palette is defined on the root,
and the dark values are defined twice: once for the system preference, guarded so an explicit light choice still
wins, and once for an explicit dark choice. The reduced-motion path is complete: it is honoured both from the system
preference and from an explicit motion choice.

## What can be overridden

Font family, size, weight, line height, letter spacing and letter case; background, text, outline and accent colour;
corner radius and padding. Text alignment is not one of the overridable properties in this build, so it is not
offered rather than being offered and always refused.

Colours are translated across hex, rgb, hsl, hwb, lab, lch, oklab, oklch and the supported colour keywords. A value
that falls outside a destination gamut is reported as out of gamut rather than quietly clamped.

## What appearance can never do

An override that would make a required disclosure unreadable is refused by the privileged boundary and the refusal is
shown in the editor. The mail-in-only boundary statements and the wizard validation line are protected: their text
stays at least 12 pixels and their colours must reach a contrast ratio of at least 4.5 to 1.

## Presets

Overrides can be exported and imported as a bounded preset document. An imported preset is validated property by
property, and any entry that would break a protected disclosure is refused and reported. One property, one element,
or every override can be reset.

## Boundaries

The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing. Appearance changes presentation only.

## Failure modes

- An unknown property or a value containing a URL, a declaration terminator or a block terminator is refused.
- A preset over its size or element limit is refused with the exact reason.

## Verification status

The application build (`npm run build --workspace @material-tax-reporting/desktop`) was run and completed, and the generated main, preload and renderer bundles were parsed to confirm they are syntactically valid. No tests, lint, type checks, packaging, installer creation, release, runtime launch, screenshot, accessibility conformance check, performance measurement or native-speaker language review were run for this change, so none is claimed here.

## Related articles

- [Element locks](element-locks.md)
- [Settings and preferences](settings-and-preferences.md)
- [Command palette](command-palette.md)
