# Command palette

## What this is

A palette that opens with Control, Shift and F from anywhere in the application, and from a visible title-bar button
so pointer and touch users are not limited to a shortcut.

## Coverage

The registry covers every destination and tab, every wizard question, every project action (create, preview and open,
save, save a copy, close), every history action (search, compare, label, restore, undo, verify), every personalization
setting and the appearance editor. Coverage is asserted rather than assumed: any personalization setting without a
command is reported inside the palette itself.

## Behaviour

- Setting results are operable inline in their own result row, so a value can be changed without leaving the list.
- Selecting any other result teleports to the exact element: the owning destination is opened or focused, the element
  is scrolled into view, and focus moves to it.
- The input is a full search builder with its own pattern, flags, sample text and match list.
- Up and Down move the active result, Enter runs it, focus is trapped inside the dialog, and Escape returns focus to
  the element that opened it.

## Boundaries

The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing. No palette command files, transmits or submits anything.

## Failure modes

- A search that matches nothing says so instead of showing an empty list.
- A result whose target element is not present simply focuses the destination panel.

## Verification status

The application build (`npm run build --workspace @material-tax-reporting/desktop`) was run and completed, and the generated main, preload and renderer bundles were parsed to confirm they are syntactically valid. No tests, lint, type checks, packaging, installer creation, release, runtime launch, screenshot, accessibility conformance check, performance measurement or native-speaker language review were run for this change, so none is claimed here.

## Related articles

- [Tabs and navigation](tabs-and-navigation.md)
- [Regex builders](regex-builders.md)
- [Settings and preferences](settings-and-preferences.md)
