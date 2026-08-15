# Scheduled and external presentation settings

## Behaviour

This article is about the site's own presentation settings. It has nothing to do with a tax schedule or an official form.

A rule changes a presentation setting during a time window. A rule never writes to the stored preference: the kernel evaluates the active rules into an overlay, and precedence is fixed. Highest first, the layers are a hold the reader placed by hand, then an active rule, then the external document, then the stored preference. Turning a rule off restores the stored value exactly, because that value was never replaced.

The window is evaluated in the browser's own time zone, including a window that crosses midnight. One interval re-evaluates while the tab is visible, and a visibility change re-evaluates immediately, so a tab that was in the background catches up instead of showing a stale window.

### A change made by hand, and how long it is held

Changing a setting a rule is currently setting does two things. It writes the stored preference, as any settings change does, and it records a **hold** for that setting. The hold is what makes the change visible: without it the rule would go on winning, and where the stored value already equalled the value the reader chose there would be no change to write at all, so the control would appear to do nothing and snap back to the rule's value.

A hold is stored in this browser under its own key, separate from the rules, so editing a rule cannot drop a hold and handing a setting back cannot edit a rule. It survives a reload, because otherwise the rule would win again on the next load and the reader's change would be lost exactly as if the control had never worked.

**A hold lasts while a rule or the external document is still setting that value, or until the reader hands it back.** It ends in one of two ways:

- **It expires** as soon as nothing is scheduling that setting. Nothing visible happens at that moment, because a hold is always written together with the stored preference it came from, so the two already agree. What expiry restores is the rule's *next* window. A hold that never expired would silently defeat that rule for good, with nothing on screen to say why the rule had stopped applying.
- **The reader ends it early** with `Follow the schedule rule again`, offered on the settings card whose value is currently held and in the schedule panel's list of held settings. The rule setting that value takes it back immediately.

Both a new hold and a hold handed back are recorded in the local history alongside the preference change, under a `scheduleHold.` path, and each is announced as a non-blocking notification. The schedule panel names every setting currently held, or says plainly that none is.

### Locked settings

A setting locked in the settings tab is resolved from the stored preference alone: the overlay, the external document and any surviving hold are all withheld for it.

This is enforced in two places, because a value can be changed in two ways. The settings grid, the command palette and the appearance editor write through one guarded setter, which refuses a write to a locked setting. A rule and an external document do not write at all — they contribute an overlay — so the same lock check is applied where the overlay is resolved. Both halves read the same kernel predicate, so they cannot come to disagree about what is locked. The settings card for a locked setting says so, and adds that the rule naming it is not applied either when one is active.

The external half is off by default. When it is switched on, one address the reader types may supply presentation values only. The address must be a complete https address, the fetch is bounded by an abort timeout, and the document is validated against the kernel's bounded schema and must declare the same origin it was served from. Any failure falls back to the local rules and states the exact reason.

A change to a rule or to the external switch is recorded in the local history like any other settings change. The record carries how many rules exist, how many are active, a one-line description of each rule, whether the external half is on, and whether an address is set. The address itself is never written to a record.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

- Rules, each with a target setting, a value, a start time, an end time and an optional set of weekdays.
- External presentation settings: off by default, with an address and an explicit read control.
- Holds, which are not configured directly. One appears when a setting is changed by hand while a rule or the external document is setting it, and is removed by `Follow the schedule rule again` or by its own expiry.

Only presentation settings are reachable: theme, density, motion, dock edge, accent colour, font scale and the decorative emoji. A key outside that set is ignored by name.

The value control follows the target it belongs to, so a rule can carry any value the setting itself accepts:

- Accent colour is a colour control over the whole range, with the chosen value shown beside it. Any six-digit hexadecimal colour can be scheduled, not a shortlist of them.
- Font scale is a slider between the smallest and largest scale the shared validator accepts, shown as a percentage.
- Theme, density, motion, dock edge and the decorative emoji are lists of their own choices, taken from the shared validator's own sets so the editor and the validator cannot disagree. These are enumerations, so a list is the correct control rather than a limit on what can be scheduled.

Every value passes through one normalizer, both when it is edited and when the stored record is read.

## Failure modes

- A malformed time or an empty window makes the rule inactive rather than raising an error.
- A stored hold naming a setting that cannot be scheduled is dropped when the record is read, and a held value outside its range is corrected by the same normalizer a rule value passes. The key set is bounded by the schedulable settings themselves, so the record cannot grow past seven entries however it was edited.
- A hold on a setting that is later locked stops being applied, because a locked setting resolves from the stored preference alone. The hold itself is left intact and applies again if the lock is removed while a rule is still setting that value.
- A stored value outside the range its target accepts is corrected when the record is read, so the editor shows the value that will actually be used. A scale beyond either end is brought to that end, and a colour or a choice that is not recognized returns to the shipped default for that setting.
- A non-https address, a failed request, a timeout, a document that is too large, a document with unknown fields, or a document declaring a different origin all fall back to the local rules with the reason shown.
- Values that are not presentation settings are listed as ignored rather than silently dropped.

## Privacy and security

Nothing is uploaded. The external read is a plain request for a document the reader chose, made without credentials and without following a redirect, and it can change presentation only.

## Verification status

An earlier revision of this article described the manual-over-rule precedence as behaviour when it was only a sentence. The site passed an empty override map to the kernel, so an active rule always won and a settings control the rule named was inert: choosing the value the rule was hiding diffed against an unchanged stored preference, wrote nothing and snapped back. The same revision inherited a comment claiming a scheduled rule passed the guarded preference setter, which it never did, so a lock was bypassed by a rule naming the same setting. Both are now implemented and described above; this note is kept so the correction is legible rather than silent.

The lane that implemented them ran the site build (`npm run pages:build` in `apps/site`, exit 0) and the server-side render smoke check, which reported that the shell rendered and every structural check held — 10 tabs against 10 panels, 20 search fields against 20 builder toggles, and no rendered button without an accessible name, which covers the two controls added here.

The precedence and expiry functions were exercised in process against the real module and the shared kernel, over twenty cases: a rule winning with no hold; a hold equal to the stored value beating an active rule, which is the exact case that used to write nothing; a hold of a different value beating an active rule; a locked target taking neither the rule nor a hold; the external document applying only where no rule does; a hold beating the external document; expiry dropping an ungoverned hold, preserving object identity when nothing expired, and clearing every hold when nothing is scheduled; and the validator dropping an unschedulable key, normalizing an out-of-range scale, and refusing a value that is not an object.

It did not run tests, lint checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. `apps/site` carries no TypeScript project configuration and the build strips types without checking them, so **no type check was run against this application**, here or previously. No rule has fired from a real clock in a browser, no external document has been read from a running page, and neither the value controls nor the new hand-back control has been operated by a person. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [Material 3 shell and appearance](material-3-shell-and-appearance.md)
- [Local history](local-history.md)
