# File converter

## Behaviour

The converter changes this site's own records between formats. The registered adapters cover the personal-vocabulary map between JSON, comma-separated and two-column tab-separated form, and the documentation index, the changelog view and the notification history from their JSON form into comma-separated or Markdown tables.

The registry is fail-closed. A pair nothing is registered for produces a named refusal rather than a partial result, because a partially converted document is worse than no document.

Each chosen file is validated, converted and previewed before anything is written. The panel shows the first converted rows for each file, and only then offers to save. A cancel control aborts the batch; a file rejected during a batch names its own reason and does not affect the others.

The converter never accepts tax slips or return data, and no adapter for them exists.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

- A searchable adapter catalogue, with its own anchored builder.
- A per-file preview of the first converted rows.
- A cancel control backed by an abort signal.

## Failure modes

- An input over the local size limit is rejected by name.
- An input the adapter rejects reports the adapter's own reason.
- A cancelled batch reports the remaining files as cancelled rather than as converted.

## Privacy and security

Conversion happens in the browser. Output is delivered through a temporary object address that is released immediately after the download is dispatched.

## Verification status

This lane ran the site build (`npm run pages:build` in `apps/site`) and the source checks in `apps/site/src/checks`. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [Personal vocabulary](personal-vocabulary.md)
- [Exports and bulk actions](exports-and-bulk-actions.md)
