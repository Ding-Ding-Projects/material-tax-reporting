# Fresh-Windows build

## Application build

Run `build.bat`. On a fresh 64-bit Windows installation, the script downloads the pinned portable Node.js and MinGit archives from their canonical upstreams, validates their recorded SHA-256 digests, installs the exact `package-lock.json` dependency graph, clears stale desktop output, and invokes the real `@material-tax-reporting/desktop` workspace build.

The build is accepted only when these freshly written files exist and are non-empty:

- `apps/desktop/dist/main/main.js`
- `apps/desktop/dist/preload/index.cjs`
- `apps/desktop/dist/renderer/index.html`
- `apps/desktop/dist/build-provenance.json`

The first three files and their source commit are recorded in `build-provenance.json`. A later package command refuses provenance with a missing, additional, changed, or stale output.

Use `build.bat /s`, `build.bat --silent`, or `SILENT=1 build.bat` for non-interactive execution. Non-silent execution offers to run the built application only after the build succeeds.

## Installer build

Run `build-installer.bat` with the same silent options when required. It repeats the real application build from cleared output, generates a multi-resolution ICO from `assets/brand/material-tax-reporting-mark.png`, clears stale package output, stages the complete offline OCR production closure, and runs electron-builder's Squirrel.Windows target with publication disabled.

Offline OCR staging calls `packages/slip-parser/scripts/stage-offline-ocr-assets.mjs` directly. That script creates a fresh atomic staging directory outside the repository from the exact package-lock and OCR-runtime manifests. Packaging accepts the staging directory only when its Windows x64 offline policy, package closure, file inventory, sizes, hashes, and totals are internally consistent. electron-builder copies the verified directory to `resources/offline-ocr-runtime`; the packaging script then reads that packaged resource directory back and requires the same manifest hash and per-file evidence before accepting the installer.

Success requires exactly one `Setup.exe`, one `RELEASES` index, one full `.nupkg`, any generated delta `.nupkg` files referenced by `RELEASES`, and a `NotSigned` Authenticode status. The script prints the setup path and SHA-256. It never tags, pushes, publishes, or creates a release.

Unsigned installers may trigger Windows SmartScreen or unknown-publisher warnings. Code signing is permanently disabled.

## Failure modes

- An archive digest mismatch stops before extraction.
- A missing desktop build script or required output stops before packaging.
- Missing or changed build provenance stops packaging.
- A missing OCR staging script, manifest, production package, native addon, language data file, WebAssembly file, or evidence mismatch stops packaging.
- Invalid, undersized, oversized, animated, or malformed logo input stops icon generation while leaving no partial icon active.
- Missing Squirrel.Windows output, an inconsistent `RELEASES` index, or any signature status other than `NotSigned` stops the installer build.
