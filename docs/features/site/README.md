# Website features

This directory documents the capabilities of the public documentation website in `apps/site`. Each article describes what the surface does, how it is configured, how it fails, what it keeps, and what has not been verified.

Every surface in this directory is a documentation and personalization surface. None of them changes a tax figure, a rule citation, the paper-only product boundary, or the manual-review requirement. The product boundary is unchanged: a future application may produce a CRA mail-in package as a PDF, and nothing here implements NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.

## Shared foundations

Every engine on the site comes from the shared surface kernel, so the site and the desktop application behave the same way where they present the same idea. See [the shared surface kernel](../shared-surface-kernel/README.md).

## Articles

- [Material 3 shell and appearance](material-3-shell-and-appearance.md)
- [Language and humour levels](language-and-funny-levels.md)
- [Personal vocabulary](personal-vocabulary.md)
- [Read aloud](narration.md)
- [Scheduled and external presentation settings](scheduled-and-external-settings.md)
- [Display name and mark](display-name-and-logo.md)
- [File converter](file-converter.md)
- [Tabs and navigation](tabs-and-navigation.md)
- [Appearance editor](appearance-editor.md)
- [Element locks](element-locks.md)
- [Authenticator utility and support notes](authenticator-and-support.md)
- [Local history](local-history.md)
- [Notifications](notifications.md)
- [Changelog viewer](changelog-viewer.md)
- [Documentation browser](documentation-browser.md)
- [Command palette](command-palette.md)
- [Regular-expression builders](regex-builders.md)
- [Exports and bulk actions](exports-and-bulk-actions.md)
- [Download surfaces](download-surfaces.md)

## Where the data lives

Every record described in this directory is stored in the visitor's own browser, under the versioned keys the shared kernel declares. Nothing is transmitted, and the site has no accounts, no server-side storage and no analytics.

## Verification status

This lane ran the site build and the source checks in `apps/site/src/checks`. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. No article in this directory should be read as evidence from one of those activities. The tracked record of what has and has not been proven is [the website verification status](../../site/verification-status.md).
