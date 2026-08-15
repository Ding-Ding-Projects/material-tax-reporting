# Exports and bulk actions

## Behaviour

An export is serialized by the kernel into JSON, comma-separated, Markdown or plain text, and always carries a manifest stating the surface, the collection, the moment, the exact filter that produced it, the row count, and what was omitted or redacted. Comma-separated cells are neutralized so a value cannot be interpreted as a formula by a spreadsheet application.

Preferences, appearance overrides, local history, notifications, the changelog view, the documentation index, support notes and locks all use the same path.

A converted file uses the same delivery too, but reaches it differently. Its body is already in its target format, so it is never handed back to the serializer, which would destroy that format; the manifest is stamped onto the finished body instead, in the form the target admits. A comma-separated or tab-separated result carries it as leading `#` comment lines, which the converter's own reader discards, so a stamped result still reads back as the same records. A Markdown result carries it as a heading and a bullet list above the table. Those comment lines substitute a semicolon for a comma and an apostrophe for a quotation mark: a comma-separated writer would otherwise wrap the whole line in quotation marks, its first character would stop being `#`, and the reader would take the manifest for a data row.

One target cannot carry it. A vocabulary JSON result is written unchanged, because the vocabulary schema in the shared kernel accepts only its `version` and `replacements` root fields and would refuse a stamped document the next time it was read back. The panel states that before the result is saved rather than implying a manifest that is not there.

A shared selection layer gives every list per-row checkboxes, select-all-visible, shift-range selection and a live selected count. A destructive bulk action is gated behind a confirmation naming the exact count and listing what would be affected.

Delivery is honest about the browser sandbox. Where the browser supports it, an export can be written to a folder the reader chooses; elsewhere it is delivered as an ordinary download; and a copy-to-clipboard path is always available. The limitation is stated in the interface instead of offering an editor button that cannot work from a page.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

- Four formats.
- A folder-choosing save where the browser supports it, a download fallback, and a clipboard path.
- Selection controls on every list with bulk actions.
- The same folder-or-download delivery for a converted file. The converter writes files and has no clipboard action, so the statement shown there names the two paths it actually offers rather than three.

## Failure modes

- A refused save reports the browser's own reason and nothing is written.
- A browser without clipboard access reports that rather than silently doing nothing.
- A destructive action cancelled at the confirmation changes nothing.

## Privacy and security

Personal-vocabulary values are redacted from every export, which carries key counts and lengths only. The temporary object address used by the download path is released immediately after the download is dispatched, and that path is now the only one in the website's sources that creates such an address.

Saving a converted file is recorded in local history as the pair of formats that produced it. The name of the file the reader chose is not written to the record.

## Verification status

This lane ran the site build (`npm run pages:build` in `apps/site`) and read the built bundle back to confirm that the converted-file delivery, its manifest wording and its stated limitation are present in it. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. No file has been written from a browser, so the stamped manifest and the round trip described above are read from the sources rather than observed on a written file. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [File converter](file-converter.md)
- [Local history](local-history.md)
- [Notifications](notifications.md)
