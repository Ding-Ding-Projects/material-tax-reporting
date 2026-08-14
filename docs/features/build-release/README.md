# Build and release

The project has one supported Windows x64 delivery path. It builds the desktop workspace, generates the application icon from the committed brand source, and packages an unsigned Squirrel.Windows installer.

- [Fresh-Windows build](windows-build.md)
- [Release workflow](release-workflow.md)

The scripts fail closed when the desktop workspace has no real build command, expected output is missing or stale, the brand source cannot produce a valid icon, the installer is signed, or required Squirrel.Windows assets are absent.

