# Import, export, and carry-forward data

## Versioned schema

Tax return input uses `canada-annual-personal-tax/1`. Calculation output uses `canada-annual-personal-tax-result/1`. Portable export uses `canada-annual-personal-tax-portable/1`.

Unknown schema versions fail closed. The import parser limits UTF-8 input to 1 MiB, nesting to 24 levels, and the parsed value graph to 50,000 nodes. It rejects unsafe object keys, oversized keys and strings, malformed JSON, unsupported versions, and any input that fails tax-domain validation.

## Carry-forward balances

The schema can import and preserve these balances for later official-form review:

- unused RRSP contributions;
- federal tuition;
- historical Ontario tuition;
- donations;
- capital losses;
- alternative minimum tax.

The engine calculates only the ordinary donation carry-forward created by the current-year 75% net-income limit. Other balances remain explicit imported facts until their applicable official schedule calculates a change.

## Portable export

Portable export omits the Social Insurance Number and lists that redaction. It still contains sensitive identity and tax information. The user must protect the file, keep it local, and inspect it before sharing.

The export cannot submit or file a return. It is not accepted by NETFILE or EFILE and is not transmitted to the CRA.

## Privacy and security

- Parsing and serialization are local operations and make no network request.
- The package does not log tax data or write it to a service.
- Import never executes code or accepts prototypes from the document.
- Export is user-initiated and explicitly describes retained sensitive data and redactions.

## Verification status

No tests, lint, type checks, security review, runtime review, or captures were run for this implementation.
