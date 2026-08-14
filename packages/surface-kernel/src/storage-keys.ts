/**
 * Versioned storage keys shared by both surfaces.
 *
 * The keys are literal strings so a stored record can always be located by
 * reading this file, and every key carries its schema version so an older
 * record can be upgraded instead of silently discarded.
 */

import { DEFAULT_PREFERENCES, validatePreferences, type Preferences } from "./preferences.ts";

export const STORAGE_KEYS = {
  /** Replaces the shipped `...preferences.v1` record; see the migration below. */
  preferences: "material-tax-reporting.site.preferences.v2",
  vocabulary: "material-tax-reporting.site.vocabulary.v1",
  history: "material-tax-reporting.site.history.v1",
  notifications: "material-tax-reporting.site.notifications.v1",
  appearance: "material-tax-reporting.site.appearance.v1",
  locks: "material-tax-reporting.site.locks.v1",
  tabs: "material-tax-reporting.site.tabs.v1",
  schedules: "material-tax-reporting.site.schedules.v1",
  tickets: "material-tax-reporting.site.support-tickets.v1",
  authenticator: "material-tax-reporting.site.authenticator.v1",
  identity: "material-tax-reporting.site.identity.v1",
} as const;

export type StorageKeyName = keyof typeof STORAGE_KEYS;

/** The superseded preference key, kept so an existing record can be read once. */
export const LEGACY_PREFERENCES_KEY = "material-tax-reporting.site.preferences.v1";

/**
 * Upgrades a version 1 preference record to version 2. Unknown or missing
 * fields fall back to the shipped defaults; a visitor's existing dock, theme,
 * density, accent, font scale, motion, language and humour levels are kept.
 */
export function migratePreferencesV1toV2(raw: unknown): Preferences {
  if (typeof raw === "string") {
    try {
      return migratePreferencesV1toV2(JSON.parse(raw) as unknown);
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }
  return validatePreferences(raw);
}
