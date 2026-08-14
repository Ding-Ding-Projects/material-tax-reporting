# Documentation browser

## Behaviour

The whole tracked documentation corpus is parsed at build time into a generated module, so the browser works offline from the bundle with no runtime fetch. The kernel parser produces typed nodes rather than markup, so nothing is injected as HTML.

The browser has two panes. The index pane filters the corpus and shows, for each result, the heading a match sits under and an excerpt around it. The reading pane renders headings, paragraphs, lists, code and tables, with in-page anchors and a heading outline.

Internal links between articles are resolved at build time and are followed inside the page; an external address opens as an ordinary link in a new tab.

A feature-library view lists every capability this site ships, links each to its article, and repeats the statements the tracked verification-status article records as not run. Those statements are read from the bundled article rather than written in the component, so the site cannot claim more than the repository does.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

- A documentation search with its own anchored builder.
- An area filter and a topic filter, each with its own builder.
- Export of the filtered index.

## Failure modes

- An article that cannot be parsed contributes no nodes rather than failing the build.
- An internal link with no resolved target renders as plain text rather than as a broken link.
- An empty result reports that the filter matched nothing.

## Privacy and security

Everything is bundled with the site. No request is made while reading documentation.

## Verification status

This lane ran the site build (`npm run pages:build` in `apps/site`) and the source checks in `apps/site/src/checks`. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [Changelog viewer](changelog-viewer.md)
- [Regular-expression builders](regex-builders.md)
