# Verification status

## Status recorded by this change

Implementation source now exists for the website, the desktop application, and the shared packages, and the documentation describes that source. Source is not a released product: no article here treats the presence of a file as proof that a person built, packaged, installed, launched, or used anything. The product boundaries, privacy model, website behavior, installer position, the permanent prohibition on electronic filing, and the mandatory manual-review workflow are recorded as requirements, not as verified behavior.

The per-capability record, including each capability's implementation files, its state, and its explicit evidence gaps, is `docs/features/feature-inventory.json`. Its states describe source only.

## What was verified

Exactly four things were run and their results observed:

- The shared surface-kernel package compiled with no diagnostics, and its 89 tests passed.
- The local model package compiled with no diagnostics, and its 37 tests passed, along with the 6 tests of the local coding-assistant package.
- The website's production build completed and emitted its static bundle.
- The desktop application's build completed and all of its generated bundles parsed.

Nothing beyond those four results is established. A successful build shows that source compiles and is emitted; it shows nothing about how a surface looks or behaves.

## What was not run

This change did not run:

- application launches of the website or the desktop application;
- screenshots, recordings, or other captures;
- lint checks;
- type checks beyond the packages' own compilation;
- accessibility checks;
- browser-based user-interface quality assurance;
- desktop user-interface quality assurance;
- packaging, installer, tag, or release steps; or
- performance measurement or native-speaker review of any Cantonese wording.

No statement in these articles should be read as evidence from one of those activities.

## What is not yet verified

- A public desktop release, installer, release asset, or download control. None exists.
- A packaged desktop runtime.
- Supported tax years, forms, schedules, calculations, imports, exports, or a CRA mail-in PDF package.
- The mandatory review of every populated form, calculation, attachment, mailing destination, and signature field, including acknowledgement invalidation after a change.
- PDF generation, export, printing, package completeness, or official-link handling.
- Local desktop storage, encryption, backup, retention, deletion, or recovery behavior.
- Browser behavior, accessibility conformance, responsive layout, or deployment at the public site URL.
- Any behavior of the website or desktop capabilities listed in the feature inventory. Every one of them is source that no person has exercised.

## Evidence required for future status updates

A future documentation update should identify the exact release version and commit, the implemented feature, the applicable jurisdiction and tax year, the verification activity actually performed, and the public evidence supporting the claim. Installer availability should also include the verified release and asset details described in [Installer and releases](installer-and-releases.md).

NETFILE, EFILE, electronic submission, direct CRA transmission, and automatic filing are not features awaiting evidence. They are permanently outside the product boundary and must not be implemented, advertised, simulated, or implied.

## Reporting a discrepancy

If the website and a published release disagree, treat the release's verified feature inventory and evidence as authoritative and report the documentation discrepancy without including personal tax data or credentials.

## Related articles

- [Documentation index](README.md)
- [Installer and releases](installer-and-releases.md)
- [Mail-in PDF and manual review](mail-in-pdf-and-manual-review.md)
- [Canada and Ontario boundary](canada-ontario-boundaries.md)
