# Documentation browser

## What this is

The application build copies the tracked feature articles into the packaged resources and writes a manifest beside
them. At run time the browser resolves that manifest from a fixed list of candidate locations, using the same
bounded, allowlisted discipline as the packaged runtime lookup, and refuses any path that resolves outside the
packaged root.

## Rendering

Markdown is rendered from a typed node list rather than from an HTML string, so the shipped content security policy
keeps holding. Headings, paragraphs, ordered and unordered lists, fenced code, pipe tables, inline code and links are
supported. Links to other packaged articles resolve inside the browser; anything else is not followed.

Each article shows an outline of its own headings, and the search field is a full search builder over the article
text that reports the heading each match sits under.

## Deep links from the wizard

Every wizard step names the article that owns it, and the step's own control opens that article directly.

## Boundaries

The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing. Every packaged article restates that boundary.

## Failure modes

- When no packaged manifest is present, the destination names the searched locations and explains that the
  application build has not been run for this copy.
- A link that resolves to no packaged article names the missing article rather than leaving a blank pane.

## Verification status

The application build (`npm run build --workspace @material-tax-reporting/desktop`) was run and completed, and the generated main, preload and renderer bundles were parsed to confirm they are syntactically valid. No tests, lint, type checks, packaging, installer creation, release, runtime launch, screenshot, accessibility conformance check, performance measurement or native-speaker language review were run for this change, so none is claimed here.

## Related articles

- [Changelog viewer](changelog-viewer.md)
- [Guided report wizard](guided-report-wizard.md)
- [Regex builders](regex-builders.md)
