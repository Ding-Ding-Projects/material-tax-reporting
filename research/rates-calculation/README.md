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
| Ontario credits | CRA ON479, Form 5006-TC, `5006-tc-25e`; Worksheet ON479 | page updated 2026-01-20; political-contribution formula captured |
| Ontario schedules | ON428-A `5006-a-25e`, ON479-A `5006-tca-25e`, ON-BEN `5006-tg` | 2025 package; ON-BEN concerns 2026 benefit year |
| Federal worksheet | CRA Form 5000-D1, `5000-d1-25e` PDF/text | page updated 2026-01-20 |
| Capital gains | CRA Schedule 3, Form 5000-S3, final 2025 package | page updated 2026-01-20 |
| Minimum tax | CRA Form T691, `t691-fill-25e` and `t691-25e` | final 2025 files; direct line mechanics captured |
| Canada workers benefit | CRA Schedule 6, Form 5000-S6, `5000-s6-25e` | page updated 2026-01-20 |

The source fragment records CPP/CPP2 and EI parameters effective 2025-01-01. All form constants, line-level rounding, clamps, eligibility tests, and exceptions remain controlled by the final form or worksheet that states them.

## Calculation and line-mapping overview

- Federal taxable income is return line 26000. The final 5006-R federal brackets are marginal; the calculated federal tax maps to line 76 and then line 119. Federal non-refundable credits use 14.5% only where the final worksheet directs that rate.
- The federal basic personal amount is line 30000 and depends on net-income line 23600. Between $177,882 and $253,414, the final worksheet uses base $14,538 plus a $1,591 supplement phased out across $75,532: `line10 = max(0, 1591 - (((line23600 - 177882) / 75532) * 1591))`; line 30000 is `min(16129, 14538 + line10)`.
- Dividends map to lines 12000 and 12010. For line 40425, slips take precedence (T3 boxes 39/51, T4PS 26/32, T5 12/26, T5013 131/134). For amounts not shown on slips, use 9.0301% for other-than-eligible and 15.0198% for the eligible residual, with the exact fragment formulas; foreign dividends do not qualify for this credit.
- Schedule 3 controls taxable capital gains to line 12700. The recorded ordinary inclusion rate is one-half for gains before 2026-01-01 unless a final Schedule 3 rule changes the result.
- T691 direct mechanics are captured: line 93 is adjusted taxable income (`line83 - line92`, floor at zero), line 94 is the $177,882 exemption, line 96 is 20.5%, line 97 is gross minimum tax, line 103 is after allowable credits, and a positive Part 5 result drives line 41700 while Part 8 line 12 drives line 40427. Linked special forms remain form-driven.
- Ontario's additional minimum tax is now complete for the ordinary ON428 path: only when T691 Part 5 line 11 is entered, calculate basic additional tax as `line11 * 0.2463`; add ON428 line 65, apply additive 20% and 36% surtax components above $5,710 and $7,307, subtract ON428 line 68 for the incremental surtax, and enter `line1 + line8` on ON428 line 72. If the combined line 3 is at or below $5,710, enter line 1 on line 72; line 4 and line 5 use `max(0, ...)`, and the worksheet states no separate clamp on line 8. T2203 or another special-form route remains outside this ON428-only formula.
- The refundable medical expense supplement maps to line 45200: `max(0, min((line21500 + line33200) * 0.25, 1504) - (max(0, adjustedFamilyNetIncome - 33294) * 0.05))`, with final worksheet eligibility inputs. Schedule 6 (`5000-s6-25e`) now supplies Ontario-context CWB constants/formulas, including line 45300 and advanced CWB line 41500 mapping; eligibility and RC210/spouse allocation remain schedule-driven.
- CPP/CPP2, EI, instalments, interest, and penalties map only through the final schedules and lines named in the fragments. Missing exceptions stay unavailable.
- Ontario ON428 takes line 26000 as line 1 and calculates Ontario tax through line 31. Its surtax is additive through lines 65–68; the Ontario Health Premium is the piecewise line-89 calculation and feeds line 90. Provincial tax is carried to the return's line 147/42800 flow. ON428-A, ON479-A, ON479, and ON-BEN are separate official branches, not guessed shortcuts. ON479 political contributions use line 15/63110 to line 16: contributions at least $3,793 yield $1,666.82; lower amounts use the captured Worksheet ON479 tiers and zero floor.

No formula is inferred from another year, payroll tables, an unofficial calculator, or a narrative that conflicts with a final form. If a fragment disagrees internally, the conservative result is unavailable.

## Eligibility boundaries

The Ontario package is selected only when official package-selection rules point to Ontario, ordinarily residence in Ontario on December 31, 2025 (or the official emigration-date rule). Route instead to the applicable official path for Quebec, a deceased person, a newcomer, an emigrant, multiple residential ties, factual/deemed residence, non-residence, or other listed special situations. If Ontario business income is allocable to a permanent establishment outside Ontario, use the official T2203 path instead of assuming ON428-only treatment. These boundaries are eligibility and routing decisions, not tax advice.

## Explicitly unavailable parameters

Unavailable values are represented as `null` with a reason and required official source in the machine proposal. Important remaining gaps include complete credit-catalogue eligibility and reductions, Schedule 3 special cases, Schedule 8/RC381 and Schedule 13 mechanics, universal self-employed EI premium, T691-linked special-form calculations beyond the directly transcribed lines, quarterly prescribed interest rates, a universal rounding shortcut, and special residence/bankruptcy/deceased-return rules. Do not substitute secondary sources.

## Paper review and printing

The manual-review fragment governs attachments (attach only what official instructions require; retain other records), hand signatures and dates, page-size and PDF legibility checks, due dates, and the separation of payment information from return mailing. Both the return destination and any payment destination or payment instructions require a current official lookup and user review; the app generates no payment. CRA-specific one-sided/double-sided, ink-colour, and staple/fastener rules were not located; those remain unresolved rather than invented. A paper package is a user-controlled mailing artifact, not an electronic filing or CRA acceptance signal.
