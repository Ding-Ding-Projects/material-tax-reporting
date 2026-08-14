# Guided return wizard

The Windows desktop application provides a beginner-oriented wizard that asks one question per step. It assumes no tax knowledge and keeps the reason for each question, where to find the answer, a clearly labelled synthetic example, inline validation, and the exact affected form or line visible beside the answer control. Each question also carries a direct internal link to its exact review-map target. Conditional claims identify every candidate line and state that no eligibility is inferred until the later eligibility flow selects an applicable claim.

## Navigation and persistence

- A persistent progress map shows the current, completed, and conditional steps.
- Back and forward navigation never erases an earlier answer.
- Each accepted answer is saved through the transactional local-history service before the live state changes.
- The last completed step and answers resume only after the authoritative `.mtrproject` file is opened and authenticated again after restart.
- Conditional steps are included only when the earlier answer requires them. The dependant-count step, for example, appears only after the user chooses to review dependant information.

## Project file

Every report is created, opened, saved, and imported as one `.mtrproject` file. The file is the authoritative copy of the report and contains the encrypted current wizard state, slip attachments, parser confirmation records, tax-year and rule-source metadata, the complete append-only local Git history, and the final PDF review and mailing checklist.

Opening a file validates its container signature and version, authenticated encryption, tax year, required metadata, bounded member paths and sizes, every member hash, absence of an embedded Git remote, and the extracted Git object graph before any live wizard state is replaced. It then authenticates the inner encrypted live-state envelope and requires the wizard tax year, exact five review booleans, parser confirmation records, imported slip records, and encrypted attachment inventory to agree. An archived pending transaction is rejected rather than replayed during preview. The application presents a validated preview and requires an explicit create-copy, reconcile, or replace choice.

Reconciliation is available only while a project is open and the validated import has the same tax year, schema paths, format expectations, and timing-safe identical portable data key. It imports the selected project's complete Git history into collision-bounded namespaced refs, creates a new generic append-only reconciliation commit without rewriting either history, and makes the selected imported project state current. The existing active `.mtrproject` is replaced atomically only after no-remote and full Git object validation; the imported source file remains unchanged. When lineage or another invariant differs, reconciliation fails closed and the preview offers create-copy or explicit replace instead.

The extracted workspace exists only as bounded scratch while the project is open. It is removed on close, failed import, and later stale-scratch cleanup without deleting any `.mtrproject` file. Save and save-copy use atomic local replacement. Create, open, create-copy, and save-copy refuse an empty project-file password without revealing password characteristics. A new copy always requires a new destination and an in-memory password, and never silently overwrites another project file.

## Slip parser interface

The slip-upload control reads only a user-selected local file and passes bounded bytes to `SlipParserAdapter`. The adapter accepts a parser implementation with one asynchronous `parse` method and returns draft values plus warnings. The desktop shell does not depend on a specific parser package, so the parser can be delivered independently without changing the wizard contract.

Parser output is never accepted as a final tax value. The selected source file is stored as an encrypted bounded project member. Imported values are marked as requiring manual correction, and each confirmation or later correction is persisted in the project and creates its own local-history revision. When no parser is registered, the wizard gives an honest unavailable state and keeps manual entry available.

## CRA mail-in boundary

The desktop application prepares only a CRA mail-in PDF package. It does not implement or imply NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.

Before export or print can be requested, the user must acknowledge that they manually inspected:

1. every populated form and form line;
2. every calculation and its source inputs;
3. every required attachment;
4. the current applicable CRA mailing address; and
5. every signature and date field.

The export control remains disabled until all five acknowledgements are active. The completed checklist is part of the encrypted project state so it survives save, close, and validated import. The main-process package adapter independently repeats the same complete-review requirement. If the CRA PDF package generator is not registered, the application reports that no file was created; it does not substitute a mock or unrelated PDF.

## Accessibility and presentation

The wizard is part of a frameless Material Design 3 desktop shell with a left-docked vertical tab list. It provides visible keyboard focus, labelled controls, responsive layouts, reduced-motion handling, non-blocking notifications, and a command palette opened with `Ctrl+Shift+F`. Language mode, independent English and Cantonese funny levels, theme, and dialog-emoji preferences are persisted as ordinary settings mutations.

Search fields expose an adjacent guided regular-expression builder. Plain text remains the default, while the builder provides anchors, character classes, capture groups, alternatives, quantifiers, flags, syntax feedback, and sample matches.

## Failure behaviour

An answer is not accepted when validation fails or local history cannot record it. History, parser, package-generator, and export failures are presented as non-blocking recovery notifications with factual next steps. No failure silently changes tax state.
