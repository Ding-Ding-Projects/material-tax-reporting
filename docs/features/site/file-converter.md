# File converter

## Behaviour

The converter changes this site's own records between formats. The registered adapters cover the personal-vocabulary map between JSON, comma-separated and two-column tab-separated form, and the documentation index, the changelog view and the notification history from their JSON form into comma-separated or Markdown tables.

The registry is fail-closed. A pair nothing is registered for produces a named refusal rather than a partial result, because a partially converted document is worse than no document.

Each chosen file is validated, converted and previewed before anything is written. The panel shows the first converted rows for each file, and only then offers to save. A cancel control aborts the batch; a file rejected during a batch names its own reason and does not affect the others.

A saved result leaves through the surface's shared export delivery rather than a path of its own, so it is written to a folder the reader chooses where the browser offers that interface and delivered as an ordinary download where it does not, it reports the file name, the size and the path it took, and it carries the same manifest an export carries. The pair of formats that produced a result is recorded on the result itself, so choosing a different conversion after a batch has run cannot mislabel what is saved.

A vocabulary JSON result is the one target written without an inline manifest, because the vocabulary schema accepts only its `version` and `replacements` root fields and would refuse a stamped document the next time it was read. The panel states that beside the result before it is saved. Every other target carries the manifest: a comma-separated or tab-separated result as leading `#` comment lines the converter's own reader discards, and a Markdown result as a heading and a bullet list above the table.

The converter never accepts tax slips or return data, and no adapter for them exists.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

- A searchable adapter catalogue, with its own anchored builder.
- A per-file preview of the first converted rows.
- A cancel control backed by an abort signal.
- A per-result save that states what the written file will carry before it is written.

## Failure modes

- An input over the local size limit is rejected by name.
- An input the adapter rejects reports the adapter's own reason.
- A cancelled batch reports the remaining files as cancelled rather than as converted.
- A refused save reports the browser's own reason and nothing is written.

## Privacy and security

Conversion happens in the browser. Where the browser has no folder-choosing interface, output is delivered through a temporary object address that is released immediately after the download is dispatched; that address is created in the shared export delivery, which is the only place in the website's sources that creates one.

Saving a result is recorded in local history as the pair of formats that produced it. The name of the file the reader chose is not written to the record.

## Verification status

This lane ran the site build (`npm run pages:build` in `apps/site`) and read the built bundle back to confirm that the shared delivery, its manifest wording and its stated limitation are present in it. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. No file has been converted or written by a browser, so everything above is read from the sources rather than observed. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [Personal vocabulary](personal-vocabulary.md)
- [Exports and bulk actions](exports-and-bulk-actions.md)
