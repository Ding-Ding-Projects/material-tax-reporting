# Regular-expression builders

## Behaviour

There is one search engine, and it lives in the shared surface kernel. The site's own duplicate implementation has been removed, so a pattern typed into any field behaves the same way everywhere: filtering compiles without the global flag, analysis compiles with it, a zero-width match advances instead of looping, and an over-length pattern or sample returns a reason rather than throwing.

Every search, filter, lookup, picker and menu filter has its own builder instance: the documentation index and its area and topic filters, the changelog with its area and text search, the tab search, the group search, the move picker and the bulk-close query, the notifications centre, the local history, the appearance property picker, the colour-space list, the locked-items list, the converter catalogue, the support notes, the schedule rules, the command palette, and the local model runtime's installed, catalogue and batch lists.

The builder panel closes on Escape and returns focus to the field it belongs to, which the previous implementation did not do because it left focus on a removed button.

The theme, motion, dock, density and language pickers keep their segmented controls as the fast path and also expose a filterable menu, so a builder has a collection to anchor to.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

- A plain-text mode and a pattern mode per field.
- A flags field restricted to the kernel's allowlist, with the reason shown when a flag is refused.
- A guided token palette, including the start and end anchors that make the builder an anchored builder.
- A bounded sample area with a live match list.

## Failure modes

- An invalid pattern matches nothing and shows the compiler's own message.
- An over-length pattern or sample reports the limit rather than truncating silently.
- A repeated flag, or the two mutually exclusive Unicode flags together, is refused by name.

## Privacy and security

Evaluation stays in the browser. Patterns and sample text are bounded and are not persisted.

## Verification status

This lane ran the site build (`npm run pages:build` in `apps/site`) and the source checks in `apps/site/src/checks`. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [Documentation browser](documentation-browser.md)
- [Command palette](command-palette.md)
