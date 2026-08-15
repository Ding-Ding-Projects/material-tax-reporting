# Windows release delivery

- Added touchless Windows build and installer entrypoints backed by pinned, checksum-verified per-user toolchains and the exact npm lockfile.
- Added Windows-only unsigned Squirrel.Windows packaging with `Setup.exe`, `RELEASES`, a full package, and any generated delta packages.
- Added deterministic multi-resolution icon generation from the project brand source and packaged the generated icon into the application and release assets.
- Staged the exact offline OCR production closure atomically and packaged it under Electron resources, with manifest and per-file hash readback before accepting an installer.
- Added a non-cancelling release workflow for every push and manual dispatch. The workflow builds, packages, and publishes; it intentionally runs no tests, lint, type checks, security scans, accessibility checks, or screenshots.
- Added release evidence for source commit, unsigned status, SHA-256 hashes, bounded prepublication timing, line counts, and a public dim-sum catalog code name when one is available.
- Attached the selected dim-sum dish photograph as a real downloadable release asset instead of only linking it. The photo is downloaded from the public catalog's published release assets, structurally validated byte by byte, hashed into `SHA256SUMS.txt`, and verified by the same authenticated readback as every other asset. A payload that is not a complete image of its declared format is rejected and never attached, and any failure degrades to a release that ships with its version alone and says exactly why.
- Kept releases private until complete notes and every primary and evidence asset pass authenticated readback, making publication the single final state change instead of exposing a half-finished release.
