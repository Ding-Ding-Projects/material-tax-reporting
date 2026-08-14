# Windows desktop application

The desktop application guides one tax report at a time and keeps the report local. It is not a filing client. Its delivery boundary is a manually reviewed CRA mail-in PDF package.

## Articles

- [Guided report wizard](guided-report-wizard.md)
- [Encrypted project files](encrypted-project-files.md)
- [Append-only local history](local-history.md)

## Build entry points

The app-owned build script is `npm run build --workspace @material-tax-reporting/desktop`. It declares `dist/main/main.js` as the Electron main entry and produces these packaging inputs:

- `apps/desktop/dist/main/main.js`
- `apps/desktop/dist/preload/index.cjs`
- `apps/desktop/dist/renderer/index.html`
- `apps/desktop/dist/build-provenance.json`

The provenance record contains the repository commit and the three application entry outputs. The build was deliberately not run in the implementation lane documented by the current unreleased changelog entry.

## Delivery boundary

The application does not offer or imply NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing. The manual review checklist covers populated forms, calculations, attachments, the mailing destination, and signature fields independently.
