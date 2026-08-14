# Repository Instructions

These instructions apply to automated and human contributors working in this public repository.

## Project state

- Treat the repository as a foundation only. There is no shipped application, installer, tax engine, PDF generator, documentation site, test suite, or release workflow.
- Keep claims in source files, documentation, commits, and hosted records factual and tied to obtained evidence.
- Do not add demonstration taxpayer records, fabricated forms, or sample data that could be mistaken for product output.

## Product boundary

- The future product may generate a CRA mail-in PDF package only.
- Never implement, offer, advertise, simulate, or imply NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.
- Any future export or print path must require manual inspection of every populated form, calculation, attachment, mailing destination, and signature field, followed by explicit user acknowledgement.
- Tax behaviour must identify its tax year and rely on cited, current official CRA or Ontario sources. Do not invent rates, rules, forms, addresses, or deadlines.

## Privacy and security

- Never commit real taxpayer data, credentials, government identifiers, completed tax forms, local secrets, or machine-specific configuration.
- Use synthetic fixtures only after a test or development-data policy exists and clearly labels them.
- Keep future tax data local by default and document every storage, import, export, logging, and network boundary.

## Repository discipline

- Inspect repository status before editing and preserve unrelated changes.
- Use isolated branches and linked worktrees when concurrent work could overlap.
- Keep changes within assigned paths and avoid unrelated cleanup.
- Keep the npm lockfile synchronized with package manifests.
- Leave the root build scripts fail-closed until real build and installer commands exist. Do not replace their nonzero status with a simulated success.
- Run only checks authorized for the task and report exactly what was and was not run.
- Do not publish, tag, release, merge, rewrite history, or delete work without explicit authority.

## Public records

Use ordinary professional language. Do not include private operational terminology, personal filesystem paths, host details, tokens, or internal infrastructure information in repository files or public records.
