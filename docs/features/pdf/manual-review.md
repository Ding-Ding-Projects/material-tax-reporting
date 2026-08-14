# Mandatory manual review before export or print

## Why review is mandatory

PDF preparation cannot establish that a person's tax facts are complete, every calculation is appropriate, a supporting document belongs to the claim, a mailing address remains current, or the taxpayer signed the return. Export and printing therefore require a complete, content-bound review record.

No review state represents filing. The software does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, simulated filing, or automatic filing.

## State machine

The review state is bound to both the package id and final package SHA-256.

1. `not-started` — review items exist, but none can be confirmed until review starts explicitly.
2. `in-progress` — individual items can be confirmed after the user inspects the preview and calculation details.
3. `items-complete` — every item is confirmed, but export and printing remain blocked.
4. `acknowledged` — the user supplied the exact final acknowledgement after every item was complete.

Any change to a form, calculation, attachment, mailing destination, signature-field declaration, or assembled content changes the SHA-256 and invalidates the state. A review record for one package cannot authorize another.

## Required checklist coverage

The state generator creates separate items for every populated form and its pages, every calculation line routed to a form, every supporting attachment, the selected tax-centre name and full address, and every manual signature, date, and related field declared by the form plan.

The host interface makes each underlying artifact available beside its checklist item. Confirmation is an explicit user action; scrolling, opening a preview, or reaching the end of a document does not confirm anything.

## Final acknowledgement and authorization

The exact acknowledgement text is exported as `FINAL_REVIEW_ACKNOWLEDGEMENT`. It states that the user inspected every listed form, calculation, attachment, mailing destination, and signature field; understands that the package must be signed and mailed by the user; and understands that no return has been filed.

The package rejects alternate or shortened text. `createPrintAuthorization` succeeds only for an acknowledged review whose id, digest, and items match the current manifest. The authorization permits only atomic local PDF export and local printing and carries explicit prohibitions against every electronic or automatic filing route.

The PDF adapter receives the authorization on each export or print call. An adapter that exposes a path around this requirement does not satisfy the package contract.

## Failure and recovery

- An unknown checklist item cannot be confirmed.
- A changed observed digest requires review to restart on the regenerated package.
- Pending items block final acknowledgement.
- Missing or altered final acknowledgement blocks authorization.
- An authorization whose package id or digest differs from the manifest blocks export and print.

The safe recovery is to reopen the current preview, regenerate review state for its digest, and repeat the checklist. The package never weakens review to preserve an earlier acknowledgement.

## Verification status

This state-machine implementation was not tested or executed under the expedited no-test boundary and remains unverified.
