# 2025 Ontario personal-tax calculation proposal

Status: research proposal, not production tax logic. Accessed 2026-08-14. Supported tax year: 2025. This proposal uses official primary sources only: final Canada Revenue Agency (CRA) forms, worksheets, guides, line instructions, and notices, plus the Ontario government source recorded in the source fragments. It is not tax, accounting, or legal advice, and is not CRA certification, approval, acceptance, or a filing service.

## Hard product contract

The product stops at a CRA mail-in PDF package. It must not implement, offer, advertise, simulate, or imply NETFILE, EFILE, ReFILE, SimpleFile, Auto-fill my return, electronic submission, direct CRA transmission, or automatic filing. It must not claim that CRA will accept, assess, certify, or approve the result.

Before export or print, the user must inspect **every populated form, calculation, attachment, mailing destination, signature field, and date field**, then explicitly acknowledge that review. This is deliberately stronger than CRA source wording; it is a product safety requirement and does not mean CRA acceptance or correctness.

Mailing offices are never hardcoded. Each package requires a fresh official CRA lookup and user-confirmed routing factors (residency status, province or territory, and any specified Ontario area or other factor) before the destination is shown for final review. Payment instructions remain separate from return-mailing instructions.

## Authorities and revisions

The authoritative composition is [`parameters-2025-v1.json`](parameters-2025-v1.json). It references the six source fragments in this directory without copying their full objects, avoiding a second source of truth.

| Area | Final authority and revision observed | Effective/page date |
| --- | --- | --- |
| Ontario return | CRA Form 5006-R, `5006-r-25e` (fillable `5006-r-fill-25e`) | page updated 2026-01-20 |
| Ontario tax | CRA Form 5006-C / ON428, `5006-c-25e` (fillable `5006-c-fill-25e`) | page updated 2026-01-20 |
| Ontario worksheet | CRA Worksheet ON428, Form 5006-D, `5006-d-25e` | page updated 2026-01-20 |
| Ontario credits | CRA ON479, Form 5006-TC, `5006-tc-25e`; Worksheet ON479 | page updated 2026-01-20; Worksheet ON479 formula unavailable |
| Ontario schedules | ON428-A `5006-a-25e`, ON479-A `5006-tca-25e`, ON-BEN `5006-tg` | 2025 package; ON-BEN concerns 2026 benefit year |
| Federal worksheet | CRA Form 5000-D1, `5000-d1-25e` PDF/text | page updated 2026-01-20 |
| Capital gains | CRA Schedule 3, Form 5000-S3, final 2025 package | page updated 2026-01-20 |
| Minimum tax | CRA Form T691, `t691-fill-25e` and `t691-25e` | final 2025 files; full mechanics unavailable |
| Canada workers benefit | CRA Schedule 6, Form 5000-S6, `5000-s6` | page updated 2026-01-20 |

The source fragment records CPP/CPP2 and EI parameters effective 2025-01-01. All form constants, line-level rounding, clamps, eligibility tests, and exceptions remain controlled by the final form or worksheet that states them.

## Calculation and line-mapping overview

- Federal taxable income is return line 26000. The final 5006-R federal brackets are marginal; the calculated federal tax maps to line 76 and then line 119. Federal non-refundable credits use 14.5% only where the final worksheet directs that rate.
- The federal basic personal amount is line 30000 and depends on net-income line 23600. The final Federal Worksheet supplies the complete 2025 phase-out: start with $14,538, add the positive remainder of $1,591 minus `$1,591 × (line 23600 − $177,882) ÷ $75,532`, and cap the result at $16,129.
- The final Federal Worksheet supplies the line 34990 top-up tax credit: add line 33800 and Schedule 9 line 22, subtract $8,319.38 without going below zero, and multiply the remainder by 3.45%.
- Dividends map to lines 12000 and 12010; slips take precedence, otherwise the Federal Worksheet chart controls line 40425. The dividend-credit percentage is unavailable when no slip is present.
- Schedule 3 controls taxable capital gains to line 12700. The recorded ordinary inclusion rate is one-half for gains before 2026-01-01 unless a final Schedule 3 rule changes the result.
- CPP/CPP2, EI, AMT, refundable credits, instalments, interest, and penalties map only through the final schedules and lines named in the fragments. Missing mechanics stay unavailable.
- Ontario ON428 takes line 26000 as line 1, calculates tax on taxable income on line 8, carries that amount to line 51, and completes Ontario tax at line 90. Its surtax is additive through lines 65–68; the Ontario Health Premium is the piecewise line-89 calculation. Provincial tax is carried to return line 42800. ON428-A, ON479-A, ON479, and ON-BEN are separate official branches, not guessed shortcuts.

No formula is inferred from another year, payroll tables, an unofficial calculator, or a narrative that conflicts with a final form. If a fragment disagrees internally, the conservative result is unavailable.

## Eligibility boundaries

The Ontario package is selected only when official package-selection rules point to Ontario, ordinarily residence in Ontario on December 31, 2025 (or the official emigration-date rule). Route instead to the applicable official path for Quebec, a deceased person, a newcomer, an emigrant, multiple residential ties, factual/deemed residence, non-residence, or other listed special situations. If Ontario business income is allocable to a permanent establishment outside Ontario, use the official T2203 path instead of assuming ON428-only treatment. These boundaries are eligibility and routing decisions, not tax advice.

## Explicitly unavailable parameters

Unavailable values are represented as `null` with a reason and required official source in the machine proposal. Important gaps include a no-slip federal dividend-credit percentage, complete credit and Schedule 3/8/RC381/Schedule 13/T691 mechanics, the Ontario ON479 political-contribution formula, the complete Ontario minimum-tax dependency graph, the refundable medical supplement and CWB formulas, quarterly prescribed interest rates, a universal rounding shortcut, and special residence/bankruptcy/deceased-return rules. Do not substitute secondary sources.

## Paper review and printing

The manual-review fragment governs attachments (attach only what official instructions require; retain other records), hand signatures and dates, page-size and PDF legibility checks, due dates, and the separation of payment information from return mailing. Both the return destination and any payment destination or payment instructions require a current official lookup and user review; the app generates no payment. CRA-specific one-sided/double-sided, ink-colour, and staple/fastener rules were not located; those remain unresolved rather than invented. A paper package is a user-controlled mailing artifact, not an electronic filing or CRA acceptance signal.
