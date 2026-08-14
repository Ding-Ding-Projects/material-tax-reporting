# Guided return wizard

The Windows desktop application provides a beginner-oriented wizard that asks one question per step. It assumes no tax knowledge and keeps the reason for each question, where to find the answer, a clearly labelled synthetic example, inline validation, and the exact affected form or line visible beside the answer control. Each question also carries a direct internal link to its exact review-map target. Conditional claims identify every candidate line and state that no eligibility is inferred until the later eligibility flow selects an applicable claim.

## Navigation and persistence

- A persistent progress map shows the current, completed, and conditional steps.
- Back and forward navigation never erases an earlier answer.
- Each accepted answer is saved through the transactional local-history service before the live state changes.
- The last completed step and answers resume from stable application data after restart.
- Conditional steps are included only when the earlier answer requires them. The dependant-count step, for example, appears only after the user chooses to review dependant information.

## Slip parser interface

The slip-upload control reads only a user-selected local file and passes bounded bytes to `SlipParserAdapter`. The adapter accepts a parser implementation with one asynchronous `parse` method and returns draft values plus warnings. The desktop shell does not depend on a specific parser package, so the parser can be delivered independently without changing the wizard contract.

Parser output is never accepted as a final tax value. Imported values are marked as requiring manual correction, and each later correction must create its own local-history revision. When no parser is registered, the wizard gives an honest unavailable state and keeps manual entry available.

## CRA mail-in boundary

The desktop application prepares only a CRA mail-in PDF package. It does not implement or imply NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.

Before export or print can be requested, the user must acknowledge that they manually inspected:

1. every populated form and form line;
2. every calculation and its source inputs;
3. every required attachment;
4. the current applicable CRA mailing address; and
5. every signature and date field.

The export control remains disabled until all five acknowledgements are active. The main-process package adapter independently repeats the same complete-review requirement. If the CRA PDF package generator is not registered, the application reports that no file was created; it does not substitute a mock or unrelated PDF.

## Accessibility and presentation

The wizard is part of a frameless Material Design 3 desktop shell with a left-docked vertical tab list. It provides visible keyboard focus, labelled controls, responsive layouts, reduced-motion handling, non-blocking notifications, and a command palette opened with `Ctrl+Shift+F`. Language mode, independent English and Cantonese funny levels, theme, and dialog-emoji preferences are persisted as ordinary settings mutations.

Search fields expose an adjacent guided regular-expression builder. Plain text remains the default, while the builder provides anchors, character classes, capture groups, alternatives, quantifiers, flags, syntax feedback, and sample matches.

## Failure behaviour

An answer is not accepted when validation fails or local history cannot record it. History, parser, package-generator, and export failures are presented as non-blocking recovery notifications with factual next steps. No failure silently changes tax state.
