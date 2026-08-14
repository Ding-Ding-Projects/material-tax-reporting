# Appearance editor

## Behaviour

An individual element can be restyled. Overrides are emitted as scoped custom properties on the target element, so the cascade does the work and no stylesheet is rewritten at runtime.

The editor is reachable from a context menu on any registered element and from the command palette. It offers typography, from a shipped stack list plus weight, size step, letter spacing and line height, and colour.

The colour translator accepts hexadecimal, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()` and named colours, converts between all of them, reports out-of-gamut results honestly, and shows the computed contrast ratio against the resolved surface with an explicit pass or fail at normal and at large text size.

Two properties are structural rather than promised. The kernel's allowlist contains no outline, shadow, transition or animation property, and the focus ring and the reduced-motion rules read no override value, so an override cannot remove focus visibility and cannot defeat reduced motion.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

- A property picker with its own anchored builder.
- A filter on the colour-space list, also with its own builder.
- Reset one property, reset every property on an element.
- Preset export to the clipboard, and preset import from a bounded JSON document validated like the vocabulary file.

## Failure modes

- A value the kernel refuses is reported by name and nothing changes.
- A locked element or a locked property refuses the change and says so.
- A preset that is too large, is not valid JSON, carries unknown fields, or names a property outside the allowlist is rejected with the exact reason.

## Privacy and security

Overrides stay in this browser. Values are bounded and inert: the kernel rejects anything containing a URL, a declaration terminator or a block terminator, so an override cannot escape the property it belongs to.

## Verification status

This lane ran the site build (`npm run pages:build` in `apps/site`) and the source checks in `apps/site/src/checks`. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [Element locks](element-locks.md)
- [Material 3 shell and appearance](material-3-shell-and-appearance.md)
