# Windows desktop application

The desktop application guides one tax report at a time and keeps the report local. It is not a filing client. Its
delivery boundary is a manually reviewed CRA mail-in PDF package. The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.

## Articles

### Preparing a report

- [Guided report wizard](guided-report-wizard.md)
- [Encrypted project files](encrypted-project-files.md)
- [Append-only local history](local-history.md)
- [File converter](file-converter.md)
- [Transfer surfaces](transfer-surfaces.md)
- [Exports and bulk actions](exports-and-bulk-actions.md)

### Personalizing the application

- [Settings and preferences](settings-and-preferences.md)
- [Language modes and humour levels](language-and-funny-levels.md)
- [Personal vocabulary](personal-vocabulary.md)
- [Read aloud](narration.md)
- [Scheduled and external settings](scheduled-and-external-settings.md)
- [Display name and logo](display-name-and-logo.md)
- [Appearance editor](appearance-editor.md)
- [Element locks](element-locks.md)

### Finding your way around

- [Tabs and navigation](tabs-and-navigation.md)
- [Command palette](command-palette.md)
- [Regex builders](regex-builders.md)
- [Documentation browser](documentation-browser.md)
- [Changelog viewer](changelog-viewer.md)
- [Notifications](notifications.md)
- [Authenticator and support tickets](authenticator-and-support.md)

## Build entry points

The app-owned build script is `npm run build --workspace @material-tax-reporting/desktop`. It declares
`dist/main/main.js` as the Electron main entry and produces these packaging inputs:

- `apps/desktop/dist/main/main.js`
- `apps/desktop/dist/preload/index.cjs`
- `apps/desktop/dist/renderer/index.html`
- `apps/desktop/dist/changelog.json`
- `apps/desktop/dist/docs/docs-manifest.json` and one copied article per tracked feature article
- `apps/desktop/dist/build-provenance.json`

The provenance record contains the repository commit and every generated output. The build was run for the change
documented by the current unreleased changelog entry, and it completed. No packaging, installer creation, release,
runtime launch or screenshot was performed.

## Security posture

The interface process runs with context isolation on, node integration off and the sandbox on, behind a content
security policy that forbids connections. Every file, dialog, process and network decision happens in the privileged
main process. The interface subscribes to exactly four allowlisted push channels: transfer progress, local model
state, notification pushes and applied schedules. There is no wildcard channel.

## Delivery boundary

The application does not offer or imply NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic
filing. The manual review checklist covers populated forms, calculations, attachments, the mailing destination, and
signature fields independently.
