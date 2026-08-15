# Website changelog

## Unreleased

### Added

- Moved every user-facing string into one copy bundle with five humour levels per language, and added a source check that runs the shared kernel's fact invariant so humour can change tone but never a number, a date, an official name, a link or an action label.
- Added a decorative dialog emoji preference that marks the emoji as hidden from assistive technology and never lets it replace a word.
- Applied the personal-vocabulary map to every string the site renders instead of two call sites, moved its validation to the shared kernel, and protected the official reference wording and addresses, the paper-only boundary sentence and the disclaimers as immutable spans.
- Added a source check that fails when a built-in vocabulary map, example or private default appears in the application sources.
- Added read-aloud over the browser's own speech synthesis, driven by the shared kernel's narration queue so bilingual output is strictly serialized, started only from an explicit control, and disabled with the exact reported reason when a browser exposes no speech synthesis or no installed voices.
- Added scheduled presentation rules that contribute an overlay rather than overwriting the stored preference, evaluated on one interval and again when the tab becomes visible, with the shared kernel resolving precedence between a hold placed by hand, an active rule, the external document and the stored preference.
- Added a hold, so a setting changed by hand while a rule is setting it keeps the chosen value: the hold is stored under its own key in this browser, survives a reload, is recorded in local history and announced as a notification, and is listed in the schedule panel with a `Follow the schedule rule again` control that also appears on the settings card whose value it decides. A hold expires by itself once nothing is scheduling that setting, so the rule's next window still applies.
- Added an opt-in external presentation-settings source, off by default, restricted to a complete https address, bounded by an abort timeout, validated against the shared kernel's bounded schema, limited to presentation values, and falling back to the local rules with the exact reason on any failure.
- Added a display name and a mark for this browser, with local images validated by the shared kernel for declared type, declared length and leading bytes, and vector markup rejected. The shared page title is left as the shipped product name.
- Added a file converter for this site's own records, registering shared-kernel adapters for the personal-vocabulary map, the documentation index, the changelog view and the notification history, with a per-file preview before anything is written, a working cancel, and a named reason for every rejected file.
- Added a local model runtime surface that reports only what a browser probe observed, names the actual probe failure, and never renders a connected or healthy state that was not observed.
- Promoted the tab strip to persisted state driven by the shared kernel tab model, with keyboard and pointer reordering, pinning, named collapsible groups, a move picker, a resize-observed overflow menu button in place of a horizontal scroll region, and a bulk close that names the exact matched set before it acts.
- Added a per-element appearance editor emitting scoped custom properties, reachable from a context menu and from the command palette, with typography and colour controls, preset export and bounded preset import, and reset for one property or for a whole element.
- Added a colour translator covering hexadecimal, rgb, hsl, hwb, lab, lch, oklab, oklch and named colours, reporting out-of-gamut results and the computed contrast ratio against the resolved surface with an explicit pass or fail.
- Added element locks bound to the shared kernel, refusing a preference write through one guarded setter and withholding a locked setting from the schedule overlay, counting incorrect attempts, relocking on a timer that is re-checked when the tab becomes visible, and repeating the kernel's disclosure that a lock is a presentation guard with no security property.
- Added a local authenticator utility that draws its QR image from the shared kernel's encoder as inline vector shapes, with no external image and no network access, labelled as bound to no account because this site has no accounts.
- Added browser-local support notes with shared-kernel redaction on save and a visible statement that notes stay in this browser and are never transmitted.
- Added append-only local history over the browser's indexed database, recording every preference, appearance, tab, lock, schedule, ticket, export and vocabulary change, with a date range filter, an action filter, per-entry differences, a restore that writes a new record and names the values it would reapply, and a documented cap with a visible prune control.
- Rebuilt the notification centre with kinds, read state, full timestamps, assertive announcement for errors, persistent progress notices, per-row selection with select-all-visible and shift-range, bulk mark-read and bulk dismiss behind a confirmation that states the exact count, and an unread-only badge.
- Added a changelog viewer generated at build time from the tracked changelog files, grouped by area and release, with a search, an area filter, a real date range, an export, each release's verification block shown verbatim, and a commit link only where a real identifier exists.
- Replaced the six hard-coded summary cards with a documentation browser generated at build time from the tracked Markdown, working offline from the bundle with no runtime fetch, with a filterable index, resolved internal links, a heading outline, matched-heading context in results, and a feature library whose state statements are read from the tracked verification-status article.
- Generated the command palette from the same declarative sources as the settings grid, the tab strip, the appearance store, the documentation index and the changelog, added live inline controls for every preference, fixed teleport so a command lands in the field it names, moved focus to the palette field on open, trapped Tab inside the dialog, and restored focus to the invoking control on close.
- Added a source check that reports any preference key the command palette cannot reach.
- Repointed every search at the shared kernel engine, deleted the site's duplicate matcher and analyser, attached an independent anchored builder to every search, filter, picker and menu filter, added Escape-to-close that returns focus to the originating field, and added a source check that fails when any module renders its own search input.
- Added exports in four formats through the shared kernel, each stamped with the exact filter that produced it, with a folder-choosing save where the browser supports it, a download fallback, a clipboard path, and an honest statement of the browser limitation instead of an editor button that cannot work.
- Added a shared selection layer with per-row checkboxes, select-all-visible, shift-range selection and a live count, and gated every destructive bulk action behind a confirmation naming the exact count.
- Added the Start, Downloading and Complete transfer surfaces driven by an empty release manifest, so the site keeps rendering its honest unavailable state and the counts shown on the home surface are derived from the manifest rather than hard-coded.
- Added the website feature documentation set under `docs/features/site/`, one article per shipped capability.

### Fixed

- Fixed the documented manual-over-rule precedence, which was described in three places and implemented in none. The site called the kernel's `resolvePrecedence` with an empty override map, so an active rule always won and every settings control that rule named was inert: choosing the value the rule was hiding diffed against an unchanged stored preference, wrote nothing, recorded nothing, announced nothing, and left the control showing the rule's value. A change made by hand now records a hold that the kernel resolves as the manual layer, and the settings card reports which of the four layers its value came from.
- Fixed an element lock being bypassed by a schedule rule naming the same setting. A comment asserted that every mutation, a scheduled rule included, was routed through one guarded setter; a rule never writes the stored preference at all, so it never reached that setter and changed a locked setting freely. A locked setting is now withheld from the overlay, the external document and any hold, resolving from the stored preference alone, and the comment describes the two guards that exist rather than the one that did not.

### Changed

- Routed a saved converter result through the shared export delivery instead of a second blob path of its own, so it is written to a chosen folder where the browser offers that interface, reports the file name, size and path it took, is recorded in local history, and carries the same manifest every other collection carries. A comma-separated or tab-separated result carries the manifest as leading `#` comment lines the converter's own reader discards, and a Markdown result as a heading and a bullet list; a vocabulary JSON result is written unchanged and says why, because the vocabulary schema accepts only its version and replacements fields and would refuse a stamped document on the way back in. The website's sources now create a temporary object address in exactly one place.
- Gave a saved converter result the target format's own extension and media type in place of the previous plain-text type for every target, and recorded the source and target formats on each result so choosing a different conversion after a batch has run can no longer mislabel what is saved.
- Replaced the site's own preference record with the shared kernel record, migrating an existing version 1 record once so a visitor keeps their dock, theme, density, accent, font scale, motion, language and humour choices.
- Imported the shared kernel token stylesheet once and stamped the theme, density and motion choice on the document element so the shared tokens and the site palette resolve to the same values.
- Narrowed the unavailable-feature statement to the capabilities that are genuinely absent, and moved the honest capability inventory into the documentation browser's feature library, where each row links to its article and repeats what the tracked verification-status article records as not run.
- Replaced the silent forty-item truncation of local activity with a documented cap and a visible prune control.
- Cleared the toast dismissal timer in a cleanup effect instead of leaving it running.
- Extended the site build plugin to generate the documentation and changelog modules from the tracked Markdown, so neither view can drift from the repository.
- Resolved the workspace packages by absolute path in the site build configuration so one package can import another without a duplicated installation.

### Verification

This change ran the site build (`npm run pages:build` in `apps/site`), the three source checks in `apps/site/src/checks`, and the render smoke check that renders the shell once on the server, and observed their real output. The smoke check reported ten tabs and ten panels, twenty search fields each with a builder toggle, no button without an accessible name, the paper-only boundary sentence, the honest unavailable card and the skip link.

The two fixes above ran the site build (exit 0) and the render smoke check again, which reported the same structural results with the two added controls in place, and exercised the precedence and expiry functions in process against the real module and the shared kernel over twenty cases, including a hold equal to the stored value beating an active rule — the exact case that previously wrote nothing — and a locked target taking neither the rule nor a hold.

Neither ran tests, lint checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. `apps/site` carries no TypeScript project configuration and the build strips types without checking them, so no type check was run against this application. No rule has fired from a real clock in a browser, no external document has been read from a running page, and no control has been operated by a person. No release, installer, packaged artifact or deployment was produced, and the release manifest ships with an empty asset list.

## Backfilled: website implementation that was never recorded

These entries describe behaviour that was already present in `apps/site` before this change and that no earlier changelog entry recorded. They are written from the source, not from a test run.

### Added

- A Material 3 shell with a sticky header, a dockable tab strip, a content area and a footer, laid out with CSS grid.
- Local browser preferences for theme, tab docking edge, density, accent colour, font scale, motion, language mode and two humour levels.
- A responsive layout that collapses two-column reading surfaces below 1050 pixels and moves the tab strip to the top edge below 760 pixels.
- A reduced-motion path for an explicit reduced-motion choice and for a system preference while the site follows the system.
- A skip link, a focus-visible double ring on every interactive control, and a roving tabindex with arrow, Home and End handling on the tab strip.
- A documentation search with an anchored regular-expression builder, a bounded sample area and a local match list.
- A keyboard command palette on `Ctrl+Shift+F` with a visible fallback button.
- A toast region and a notification history panel.
- A validated personal-vocabulary upload, limited to 64 KB, 200 replacements, keys of 1 to 80 characters and values of at most 200 characters, rejecting unsafe object keys and unknown fields.
- An honest installer-unavailable card and an honest inventory of unavailable capabilities.

### Verification

No test, lint check, type check, accessibility check, screenshot or browser-based quality assurance was run for the backfilled behaviour. These entries record what the source does, not what was proven.

## Earlier documentation-only change

### Added

- Created the initial public documentation structure for the Material Tax Reporting website.
- Documented the intended Canadian tax-report preparation scope and the Canada and Ontario jurisdiction boundary.
- Documented the local-first privacy requirement and distinguished product intent from runtime verification.
- Documented website preferences, responsive tabbed navigation, documentation search, and the anchored regular-expression builder.
- Added an explicit installer-unavailable policy that prevents a download link from appearing before a release asset is verified.
- Added a verification-status article that records what is and is not currently proven.
- Defined the permanent paper-only product boundary: no NETFILE, EFILE, electronic submission, direct CRA transmission, automatic filing, or simulated submission.
- Documented that the application ends with generation of a CRA mail-in PDF package.
- Added the mandatory pre-export and pre-print review workflow covering every populated form, calculation, attachment, mailing destination, and signature field, followed by explicit user acknowledgement.
- Linked current official CRA paper-filing, mailing-destination, tax-package, and Ontario guidance without hard-coding mailing addresses or changing figures.

### Verification

This accelerated documentation-only change did not run tests, lint checks, type checks, accessibility checks, reviews, screenshots or other captures, or browser-based user-interface quality assurance.
