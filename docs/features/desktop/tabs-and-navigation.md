# Tabs and navigation

## What this is

Destinations are opened as tabs in a strip that can dock to any of the four window edges. The layout is stored in the
application preference record, so it survives a restart without ever entering the encrypted project file.

## Keyboard behaviour

- A strip docked to the left or right runs vertically, reports `aria-orientation="vertical"` and responds to the Up
  and Down arrows.
- A strip docked to the top or bottom runs horizontally and responds to the Left and Right arrows.
- Home and End move to the first and last tab in both orientations.
- The strip uses the tablist, tab and tabpanel roles with roving focus and an explicit selected state.
- Delete closes a closable tab from the keyboard.

## Grouping, pinning and overflow

Tabs can be pinned, assigned to a named group through a move-to-group picker, and reordered. When the strip runs out
of room the remaining tabs move into an overflow menu that carries its own independent filter. A bulk close matches
tabs by their visible text and confirms by naming the exact set it would close; pinned and non-closable tabs are
never included.

## Sizing

Interactive targets in the strip are at least 48 pixels, and a narrow-window fallback keeps the strip usable at the
760-pixel minimum window width. Below the narrow breakpoint the strip moves to the bottom edge and shows icons with
accessible names.

## Boundaries

The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing. Closing or rearranging a tab never changes an answer or the recorded history.

## Failure modes

- A stored layout that references an unknown destination is dropped during validation, and the default layout is
  seeded instead.
- A bulk close that matches nothing says so rather than opening an empty confirmation.

## Verification status

The application build (`npm run build --workspace @material-tax-reporting/desktop`) was run and completed, and the generated main, preload and renderer bundles were parsed to confirm they are syntactically valid. No tests, lint, type checks, packaging, installer creation, release, runtime launch, screenshot, accessibility conformance check, performance measurement or native-speaker language review were run for this change, so none is claimed here.

## Related articles

- [Command palette](command-palette.md)
- [Regex builders](regex-builders.md)
- [Settings and preferences](settings-and-preferences.md)
