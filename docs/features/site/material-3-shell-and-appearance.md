# Material 3 shell and appearance

## Behaviour

The site renders a Material 3 shell: a sticky header, a dockable tab strip, a content area and a footer, laid out with CSS grid. Colour, spacing, density and motion come from the shared token stylesheet published by the surface kernel, imported once at the top of the site stylesheet.

The active theme, density and motion choice are also written to the document element as data attributes, so the shared tokens and the site's own palette resolve to the same values. A complete light palette is defined unconditionally; dark values are redefined once for the system preference, guarded so an explicit light choice still wins, and once for an explicit dark choice.

The shell is responsive. Below 1050 pixels the two-column reading layouts collapse to one column. Below 760 pixels the tab strip moves to the top edge whatever edge is configured, and the settings grid, the review panel and the documentation browser become single-column.

Motion has a complete reduced path. A visitor who chooses to reduce motion, and a visitor whose system asks for reduced motion while the site follows the system, both get animations and transitions collapsed to an imperceptible duration, including on every surface added by the feature set.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

- Theme: system, light or dark.
- Density: comfortable or compact.
- Accent colour: any six-digit hexadecimal value, normalized by the kernel.
- Font scale, between the kernel's minimum and maximum.
- Motion: system, reduce or full.

Each is stored in this browser under the versioned preference key and is reachable both from the settings grid and from the command palette.

## Failure modes

- A browser that refuses local storage keeps the shipped defaults; the site still renders.
- An unreadable stored record falls back to the shipped defaults, because the kernel validator returns a complete record for any input.
- A superseded version 1 preference record is migrated once to version 2, keeping the visitor's existing dock, theme, density, accent, font scale, motion, language and humour choices.

## Privacy and security

Preferences never leave the browser. The document title is deliberately not personalized, so a shared link carries no local choice.

## Verification status

This lane ran the site build (`npm run pages:build` in `apps/site`) and the source checks in `apps/site/src/checks`. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [Appearance editor](appearance-editor.md)
- [Tabs and navigation](tabs-and-navigation.md)
- [Scheduled and external presentation settings](scheduled-and-external-settings.md)
