# Tabs and navigation

## Behaviour

The tab strip is persisted state, not a fixed list. Ordering, pinning, grouping, keyboard movement, overflow and bulk close are kernel functions, so the strip behaves the same whichever edge it is docked to.

The strip is one stop in the tab order and uses a roving tabindex. Arrow keys follow the docked edge, so a vertical strip responds to up and down and a horizontal strip to left and right; Home and End jump to the ends. Control with an arrow key moves the active tab within its section, and a pointer drag does the same.

A pinned tab sorts ahead of the others and shows only its icon, with its name still available to assistive technology. Groups have a coloured header that collapses and expands the group.

Overflow is a menu button driven by a resize observer, not a horizontal scroll region, so a tab that does not fit is still reachable by keyboard. The Home tab is never closable.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

Four searches, each with its own anchored builder: a tab search, a group search, a filter on the move picker, and a bulk-close query. Bulk close lists the exact matched set and requires confirmation before anything closes.

## Failure modes

- A stored strip that cannot be read falls back to the shipped strip rather than leaving the site without navigation.
- An unknown tab identifier in a stored record is dropped, and the Home tab is restored if it is missing.
- Pinned tabs and the Home tab are excluded from a bulk close by the kernel, not by the component.

## Privacy and security

The strip is stored in this browser under its own versioned key and is never transmitted.

## Verification status

This lane ran the site build (`npm run pages:build` in `apps/site`) and the source checks in `apps/site/src/checks`. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [Command palette](command-palette.md)
- [Material 3 shell and appearance](material-3-shell-and-appearance.md)
