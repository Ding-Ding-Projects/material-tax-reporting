# Command palette

## Behaviour

The palette opens with `Ctrl+Shift+F` and from a visible button beside it. It is generated from the same declarative sources as the settings grid, the tab strip, the appearance store, the documentation index and the changelog, and the kernel's coverage assertion reports any preference key no command can reach. A new setting therefore cannot ship without a command, and `apps/site/src/checks/command-coverage.check.ts` proves it.

A command has a kind. A navigate command moves focus to the element it names, preferring the inner field when the target has one, so a command that says it searches documentation lands in the search field. A control command renders the real control inline in the result row: a select for theme and motion, a segmented control for dock, density and language, a colour input for the accent, a range for the font scale and the humour levels, and a switch for the decorative emoji and for read-aloud. Changing one updates the site immediately without closing the dialog.

Focus moves to the search field when the palette opens, Tab is trapped inside the dialog, up and down move through the results, Enter follows a navigate command, and focus returns to the control that opened the palette when it closes.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

- A search field with its own anchored builder.
- Every tab, every documentation article, every changelog area and every registered appearance element as a destination.
- Every preference as a live inline control.

## Failure modes

- A target element that is not present is a no-op rather than an error.
- A locked setting refuses the change from the palette exactly as it does from the settings grid.
- An empty result reports that no command matched.

## Privacy and security

The palette reads and writes only local preferences. Nothing it does leaves the browser.

## Verification status

This lane ran the site build (`npm run pages:build` in `apps/site`) and the source checks in `apps/site/src/checks`. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [Tabs and navigation](tabs-and-navigation.md)
- [Regular-expression builders](regex-builders.md)
