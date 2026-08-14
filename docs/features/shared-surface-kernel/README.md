# Shared surface kernel

`@material-tax-reporting/surface-kernel` holds the cross-cutting logic both user-facing surfaces need: the documentation site and the desktop application. It is shared logic only. The package performs no network access, no filesystem access and no rendering, and it contains no user interface of any kind.

The package compiles with the ES2022 standard library alone. React, Electron and DOM types are not available inside it, so a rendering concern cannot accidentally be written here: every element, hook, inter-process handler and file operation stays in the surface that owns it, and the shared rules stay in one place with one behaviour.

## Behaviour

Each module is a set of pure functions, plain reducers, or a small class that receives what it needs through the interfaces in `src/ports.ts`. Nothing reaches for an ambient global except the Web Cryptography implementation, which is requested explicitly and fails with a plain message when it is absent.

| Module | Entry points |
| --- | --- |
| `ports.ts` | `KeyValueStore`, `Clock`, `IdFactory`, `BinarySource`, `AbortSignalLike`, `WebCryptoLike`, `requireWebCrypto`, `systemClock`, `systemIdFactory`, `createFixedClock`, `createSequenceIdFactory` |
| `storage-keys.ts` | `STORAGE_KEYS`, `LEGACY_PREFERENCES_KEY`, `migratePreferencesV1toV2` |
| `regex-builder.ts` | `SEARCH_FLAG_ALLOWLIST`, `MAX_PATTERN_LENGTH`, `MAX_SAMPLE_LENGTH`, `MAX_SAMPLE_MATCHES`, `BUILDER_TOKENS`, `SearchState`, `createSearchState`, `validateFlags`, `compileSearchPattern`, `matchesSearch`, `analyzeSearchPattern`, `insertToken`, `describeSearch` |
| `preferences.ts` | `Preferences`, `Dock`, `Theme`, `Density`, `MotionChoice`, `LanguageMode`, `FunnyLevel`, `DEFAULT_PREFERENCES`, `PREFERENCE_KEYS`, `validatePreferences`, `applyPreferencePatch`, `normalizeAccent` |
| `language.ts` | `CopyBundle`, `resolveCopy`, `formatBilingual`, `DEFAULT_FACT_TOKENS`, `assertFactsInvariant` |
| `vocabulary.ts` | `VOCABULARY_SCHEMA_VERSION`, `MAX_VOCABULARY_BYTES`, `MAX_VOCABULARY_ENTRIES`, `validateVocabularyDocument`, `compileReplacements`, `applyVocabulary` |
| `command-registry.ts` | `CommandDescriptor`, `ControlDescriptor`, `TeleportTarget`, `CommandRegistry`, `searchCommands`, `teleportTarget`, `assertCommandCoverage` |
| `notifications.ts` | `Notification`, `NotificationSeverity`, `DEFAULT_TOAST_MS`, `isPersistent`, `createNotification`, `reduceNotifications`, `filterNotifications`, `selectBulkScope` |
| `history.ts` | `HISTORY_ACTIONS`, `HistoryRecord`, `DiffEntry`, `HistoryStore`, `DEFAULT_HISTORY_CAP`, `DEFAULT_REDACTION_RULES`, `redactRecord`, `filterHistory`, `restoreAsNewRevision`, `capHistory` |
| `exports.ts` | `ExportFormat`, `ExportManifest`, `serializeExport`, `neutralizeCsvCell`, `previewBulkScope`, `describeOmissions` |
| `appearance.ts` | `APPEARANCE_PROPERTIES`, `mergeAppearance`, `setAppearanceProperty`, `resetAppearanceProperty`, `resetElementAppearance`, `exportAppearancePreset`, `importAppearancePreset` |
| `color.ts` | `ColorSpace`, `NAMED_COLORS`, `parseColor`, `convertColor`, `formatColor`, `relativeLuminance`, `contrastRatio`, `wcagVerdict`, `isOutOfGamut`, `readableForeground` |
| `locks.ts` | `LOCK_DISCLOSURE`, `LockScope`, `LockRecord`, `createLock`, `verifyLock`, `lockExpiry`, `isMutationBlocked` |
| `tabs.ts` | `DockEdge`, `TabModel`, `TabGroup`, `TabsState`, `reduceTabs`, `moveTab`, `pinTab`, `groupTabs`, `resolveKeyboardMove`, `bulkCloseByQuery`, `computeOverflow`, `sortTabs`, `isVerticalDock` |
| `scheduling.ts` | `ScheduleRule`, `SettingsSource`, `AppliedOverlay`, `localParts`, `ruleIsActive`, `evaluateSchedule`, `resolvePrecedence`, `validateExternalSettings` |
| `narration.ts` | `VoiceDescriptor`, `NarrationHost`, `NarrationPreferences`, `NarrationQueue`, `NARRATION_EXCLUSIONS`, `mayNarrate`, `bilingualSegments` |
| `identity.ts` | `LogoSelection`, `MAX_DISPLAY_NAME_LENGTH`, `MAX_LOGO_BYTES`, `ALLOWED_LOGO_TYPES`, `validateLogoUpload`, `resolveDisplayName`, `describeLogoSelection` |
| `converter-registry.ts` | `ConversionAdapter`, `ConversionResult`, `ConverterRegistry`, `convertWithRegistry` |
| `docs-index.ts` | `DocNode`, `InlineNode`, `DocArticle`, `DocsIndex`, `parseMarkdown`, `buildDocsIndex`, `searchDocs`, `nodesToPlainText`, `headingId` |
| `changelog.ts` | `ChangelogEntry`, `parseChangelog`, `filterChangelogEntries`, `commitUrl` |
| `totp.ts` | `TOTP_DIGITS`, `TOTP_PERIOD_SECONDS`, `generateTotpSecret`, `totpUri`, `currentTotp`, `verifyTotp`, `totpCounter`, `base32Encode`, `base32Decode` |
| `qr.ts` | `encodeQrMatrix`, `QR_ERROR_CORRECTION_LEVEL`, `QR_MIN_VERSION`, `QR_MAX_VERSION` |
| `support-tickets.ts` | `SupportTicket`, `TICKET_TRANSITIONS`, `createTicket`, `advanceTicket`, `filterTickets`, `redactTicketBody` |
| `download-states.ts` | `DownloadState`, `DownloadEvent`, `EMPTY_MANIFEST_PHASE`, `createDownloadState`, `reduceDownloadState`, `downloadFraction`, `describeDownload` |
| `tokens.ts` and `tokens.css` | `MATERIAL_TOKENS`, `TokenName`, `tokenVar`, `isTokenName`, and the Material 3 custom-property set |

### One search engine

Every list, picker, menu, settings grid and bulk action calls `matchesSearch`. Filtering compiles the pattern without the global flag, so repeated calls are not stateful; analysis compiles with it so every match in the sample can be listed. A zero-width match advances the cursor rather than looping, and an over-length pattern or sample returns a reason string instead of throwing. The builder palette includes explicit start-anchor and end-anchor tokens, which is why the interface can describe itself as an anchored builder.

### One append-only history model

`restoreAsNewRevision` returns a new record. It never edits, amends or removes an existing one, and it never mutates the list it was given. Redaction is a separate pure pass that replaces vocabulary values, identity answers and absolute filesystem paths with a marker.

## Configuration

The package has no runtime dependencies and no configuration file. Behaviour is configured entirely by what a surface injects:

- persistence through `KeyValueStore`, with the key names in `STORAGE_KEYS`;
- time through `Clock`, so schedules, locks and history records are testable;
- identifiers through `IdFactory`;
- byte access through `BinarySource`, whose declared length is checked before a read;
- speech through `NarrationHost`; and
- any external presentation-settings read through `SettingsSource`, which the kernel never calls on its own.

`migratePreferencesV1toV2` upgrades an existing version 1 preference record rather than discarding it.

## Failure modes

- An unsupported, repeated or conflicting search flag stops the pattern from compiling; the field reports the reason and matches nothing.
- A vocabulary or appearance document that is too large, uses an unknown root field, declares the wrong schema version, or carries a prototype-shaped key is rejected with a reason, and the previously accepted document stays in place.
- A conversion with no registered adapter returns a named refusal rather than a partial output.
- The transfer reducer cannot enter its complete phase without a measured byte count, a size that agrees with any published size, and a hash that agrees with any published hash; otherwise it fails with a reason.
- `commitUrl` returns `null` when no real commit identifier was recorded, rather than producing a guessed address.
- `encodeQrMatrix` refuses input that will not fit the supported versions instead of truncating it.
- Colour values outside a destination gamut are reported by `isOutOfGamut` rather than silently clamped.
- A missing Web Cryptography implementation raises a plain error; nothing falls back to a weaker substitute.

## Privacy and security

- No module opens a network connection, reads or writes a file, or touches a document. Those capabilities belong to the surfaces.
- CSV cells are escaped and any leading `=`, `+`, `-` or `@` is prefixed with an apostrophe, so an exported cell cannot execute as a spreadsheet formula.
- Support-ticket bodies are redacted before they are stored or exported: text shaped like a government identifier, a monetary amount or an absolute filesystem path is replaced, and the replaced categories are reported.
- History records are redacted through an explicit rule set, and the record passed in is never modified.
- Element locks store only a salted PBKDF2-SHA-256 verifier and compare it in length-constant time. `LOCK_DISCLOSURE` states plainly that these are presentation guards with no security property, and that sentence must accompany the feature wherever it is described.
- Logo uploads accept PNG and JPEG only, check the leading bytes against the declared type, and reject vector images outright so untrusted markup is never inlined.
- Appearance overrides are limited to an allowlist of custom properties, and any value containing a URL, a declaration terminator or a block terminator is refused.
- External presentation settings are validated against an explicit https origin allowlist and bounded primitive values before a surface may apply them. The kernel performs the validation; it never performs the request.
- The one-time-password utility implements a public standard, is bound to no account in this product, and grants access to nothing.
- The transfer state carries `unsigned` as the literal `true`, so no code path can express a signature-authenticity claim about an artifact.
- The package opens no connection of any kind, so it cannot send anything anywhere. It contains no taxpayer data, and its test fixtures are invented values labelled as synthetic.

## Verification status

What was run in this lane, with the observed result:

- `tsc -p tsconfig.json` in `packages/surface-kernel`: completed with no diagnostics, and a full emit to `dist` also completed before the directory was removed.
- `node --test --experimental-strip-types test/*.test.ts` in `packages/surface-kernel`: 89 tests, 89 passing, 0 failing.
- `npm install` at the repository root and `npm install --package-lock-only --workspaces=false` in `apps/site`: both completed, and `npm ci --prefix . --workspaces=false` in `apps/site` was then run to confirm the regenerated site lockfile installs and links the two workspace packages.
- The QR encoder's format-information and version-information bit patterns were compared against the published tables for error-correction level M, and the count of non-function modules for versions 1 to 10 was compared against the published remainder-bit counts. Both matched.
- The colour conversions for sRGB red were compared against the published CIE Lab and Oklch values, and matched.

What was not run: no lint, no accessibility check, no screen capture, no browser or desktop runtime interaction, no build of the site or the desktop application, no packaging, no installer, and no release. No rendered QR code was scanned by a reader. No performance measurement and no native-speaker review of any Cantonese wording were performed. No claim beyond the list above should be read into this article.

## Related articles

- [Append-only local history](../desktop/local-history.md)
- [Encrypted project files](../desktop/encrypted-project-files.md)
- [Data import and export](../tax/data-import-export.md)
- [Privacy and filing boundaries](../tax/privacy-and-filing-boundaries.md)
