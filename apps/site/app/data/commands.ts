/**
 * The declarative source behind both the settings grid and the command
 * palette.
 *
 * The settings grid renders `SETTING_DESCRIPTORS`; the palette registers a
 * control command for each one from the same array. A new setting therefore
 * cannot ship without a command, and `assertCommandCoverage` proves it rather
 * than leaving it to review.
 */

import {
  type CommandDescriptor,
  type ControlDescriptor,
  type Preferences,
  CommandRegistry,
  DENSITIES,
  DOCKS,
  LANGUAGE_MODES,
  MAX_FONT_SCALE,
  MAX_FUNNY_LEVEL,
  MIN_FONT_SCALE,
  MIN_FUNNY_LEVEL,
  MOTION_CHOICES,
  PREFERENCE_KEYS,
  THEMES,
  assertCommandCoverage,
} from "@material-tax-reporting/surface-kernel";
import { SITE_TABS, type SiteTabId } from "../tabs.ts";
import { SHIPPED_PRODUCT_NAME } from "./copy.ts";

export type SettingDescriptor = {
  /** Element identifier the palette teleports to. */
  id: string;
  preferenceKey: keyof Preferences;
  titleKey: string;
  bodyKey: string;
  /** Plain words the settings search matches against. */
  keywords: string;
  control: ControlDescriptor;
};

const label = (value: string) => value.slice(0, 1).toUpperCase() + value.slice(1);

/** The shipped inline marks a person may choose instead of a local image. */
export const SHIPPED_LOGOS: readonly { id: string; label: string }[] = [
  { id: "sheets", label: "Stacked sheets" },
  { id: "envelope", label: "Sealed envelope" },
  { id: "checkmark", label: "Reviewed check" },
];

export const SETTING_DESCRIPTORS: readonly SettingDescriptor[] = [
  {
    id: "theme-setting",
    preferenceKey: "theme",
    titleKey: "setting.theme.title",
    bodyKey: "setting.theme.body",
    keywords: "theme light dark system appearance colour scheme",
    control: {
      control: "select",
      preferenceKey: "theme",
      options: THEMES.map((value) => ({ value, label: label(value) })),
    },
  },
  {
    id: "dock-setting",
    preferenceKey: "dock",
    titleKey: "setting.dock.title",
    bodyKey: "setting.dock.body",
    keywords: "tab docking left top right bottom navigation edge",
    control: {
      control: "segmented",
      preferenceKey: "dock",
      options: DOCKS.map((value) => ({ value, label: label(value) })),
    },
  },
  {
    id: "density-setting",
    preferenceKey: "density",
    titleKey: "setting.density.title",
    bodyKey: "setting.density.body",
    keywords: "density compact comfortable spacing",
    control: {
      control: "segmented",
      preferenceKey: "density",
      options: DENSITIES.map((value) => ({ value, label: label(value) })),
    },
  },
  {
    id: "accent-setting",
    preferenceKey: "accent",
    titleKey: "setting.accent.title",
    bodyKey: "setting.accent.body",
    keywords: "accent colour color seed primary",
    control: { control: "colour", preferenceKey: "accent" },
  },
  {
    id: "font-scale-setting",
    preferenceKey: "fontScale",
    titleKey: "setting.fontScale.title",
    bodyKey: "setting.fontScale.body",
    keywords: "font scale size typography text",
    control: {
      control: "range",
      preferenceKey: "fontScale",
      min: MIN_FONT_SCALE,
      max: MAX_FONT_SCALE,
      step: 0.05,
    },
  },
  {
    id: "motion-setting",
    preferenceKey: "motion",
    titleKey: "setting.motion.title",
    bodyKey: "setting.motion.body",
    keywords: "motion reduced system full animation",
    control: {
      control: "select",
      preferenceKey: "motion",
      options: MOTION_CHOICES.map((value) => ({ value, label: label(value) })),
    },
  },
  {
    id: "language-setting",
    preferenceKey: "language",
    titleKey: "setting.language.title",
    bodyKey: "setting.language.body",
    keywords: "language English Cantonese bilingual",
    control: {
      control: "segmented",
      preferenceKey: "language",
      options: LANGUAGE_MODES.map((value) => ({
        value,
        label: value === "en" ? "English" : value === "zh" ? "廣東話" : "Bilingual",
      })),
    },
  },
  {
    id: "english-funny-setting",
    preferenceKey: "englishFunny",
    titleKey: "setting.funny.title",
    bodyKey: "setting.funny.body",
    keywords: "humour level English playful serious tone",
    control: {
      control: "range",
      preferenceKey: "englishFunny",
      min: MIN_FUNNY_LEVEL,
      max: MAX_FUNNY_LEVEL,
      step: 1,
    },
  },
  {
    id: "cantonese-funny-setting",
    preferenceKey: "cantoneseFunny",
    titleKey: "setting.funny.title",
    bodyKey: "setting.funny.body",
    keywords: "humour level Cantonese playful serious tone",
    control: {
      control: "range",
      preferenceKey: "cantoneseFunny",
      min: MIN_FUNNY_LEVEL,
      max: MAX_FUNNY_LEVEL,
      step: 1,
    },
  },
  {
    id: "emoji-setting",
    preferenceKey: "dialogEmoji",
    titleKey: "setting.emoji.title",
    bodyKey: "setting.emoji.body",
    keywords: "emoji decorative dialog toast notification palette",
    control: { control: "switch", preferenceKey: "dialogEmoji" },
  },
  {
    id: "display-name-setting",
    preferenceKey: "displayName",
    titleKey: "setting.identity.title",
    bodyKey: "setting.identity.body",
    keywords: "display name rename brand title",
    control: {
      control: "select",
      preferenceKey: "displayName",
      options: [{ value: "", label: `${SHIPPED_PRODUCT_NAME} (shipped name)` }],
    },
  },
  {
    id: "logo-setting",
    preferenceKey: "logo",
    titleKey: "setting.identity.title",
    bodyKey: "setting.identity.body",
    keywords: "logo mark image icon brand",
    control: {
      control: "select",
      preferenceKey: "logo",
      options: SHIPPED_LOGOS.map((logo) => ({ value: logo.id, label: logo.label })),
    },
  },
  {
    id: "narration-setting",
    preferenceKey: "narration",
    titleKey: "setting.narration.title",
    bodyKey: "setting.narration.body",
    keywords: "narration read aloud speech voice rate pitch",
    control: { control: "switch", preferenceKey: "narration" },
  },
];

/** Destinations that are not preference controls. */
export type NavigationCommandSeed = {
  id: string;
  label: string;
  detail: string;
  tab: SiteTabId;
  target: string;
};

export const NAVIGATION_COMMANDS: readonly NavigationCommandSeed[] = [
  ...SITE_TABS.map((tab) => ({
    id: `open-${tab.id}`,
    label: `Open ${tab.en}`,
    detail: "Tab",
    tab: tab.id,
    target: `tab-${tab.id}`,
  })),
  {
    id: "search-documentation",
    label: "Search documentation",
    detail: "Move to the documentation search field",
    tab: "docs",
    target: "documentation-search",
  },
  {
    id: "filter-documentation-areas",
    label: "Filter documentation areas",
    detail: "Move to the documentation area filter",
    tab: "docs",
    target: "documentation-area-filter",
  },
  {
    id: "search-changelog",
    label: "Search the changelog",
    detail: "Move to the changelog search field",
    tab: "changelog",
    target: "changelog-search",
  },
  {
    id: "search-settings",
    label: "Search settings",
    detail: "Move to the settings search field",
    tab: "settings",
    target: "settings-search",
  },
  {
    id: "focus-vocabulary",
    label: "Load personal vocabulary",
    detail: "Open the local JSON control",
    tab: "settings",
    target: "vocabulary-setting",
  },
  {
    id: "focus-schedule-rules",
    label: "Edit scheduled presentation rules",
    detail: "Open the rules editor",
    tab: "settings",
    target: "schedule-setting",
  },
  {
    id: "focus-external-settings",
    label: "Review external presentation settings",
    detail: "Open the opt-in external source control",
    tab: "settings",
    target: "external-setting",
  },
  {
    id: "focus-locks",
    label: "Review element locks",
    detail: "Open the locked-items list",
    tab: "settings",
    target: "locks-setting",
  },
  {
    id: "focus-appearance",
    label: "Open the appearance editor",
    detail: "Restyle one registered element",
    tab: "settings",
    target: "appearance-setting",
  },
  {
    id: "focus-converter",
    label: "Open the file converter",
    detail: "Convert this site's own records",
    tab: "converter",
    target: "converter-catalog-search",
  },
  {
    id: "focus-authenticator",
    label: "Open the authenticator utility",
    detail: "A local standards utility bound to no account",
    tab: "utilities",
    target: "authenticator-panel",
  },
  {
    id: "focus-tickets",
    label: "Open support notes",
    detail: "Notes kept in this browser only",
    tab: "utilities",
    target: "tickets-panel",
  },
  {
    id: "focus-assistant",
    label: "Check the local model runtime",
    detail: "Report what a browser probe observed",
    tab: "assistant",
    target: "assistant-panel",
  },
  {
    id: "focus-downloads",
    label: "Open the download surface",
    detail: "Read the release manifest state",
    tab: "downloads",
    target: "download-panel",
  },
];

/**
 * Builds the registry from the declarative sources: the settings grid, the tab
 * strip, the documentation index, the changelog areas and the registered
 * appearance elements.
 */
export function buildCommandRegistry(input: {
  preferences: Preferences;
  documentation: readonly { slug: string; title: string }[];
  changelogAreas: readonly string[];
  appearanceElements: readonly { id: string; label: string }[];
}): CommandRegistry {
  const registry = new CommandRegistry();

  for (const seed of NAVIGATION_COMMANDS) {
    registry.register({
      id: seed.id,
      label: seed.label,
      detail: seed.detail,
      surface: "site",
      kind: "navigate",
      tab: seed.tab,
      target: seed.target,
    });
  }

  for (const descriptor of SETTING_DESCRIPTORS) {
    const control = resolveControl(descriptor, input.preferences);
    registry.register({
      id: `set-${descriptor.id}`,
      label: `Change ${settingTitle(descriptor)}`,
      detail: descriptor.keywords,
      surface: "settings",
      kind: "control",
      tab: "settings",
      target: descriptor.id,
      control,
    });
  }

  for (const article of input.documentation) {
    registry.register({
      id: `doc-${article.slug}`,
      label: `Read: ${article.title}`,
      detail: "Documentation article",
      surface: "documentation",
      kind: "navigate",
      tab: "docs",
      target: `doc-entry-${article.slug}`,
    });
  }

  for (const area of input.changelogAreas) {
    registry.register({
      id: `changelog-${area}`,
      label: `Changelog: ${area}`,
      detail: "Filter the changelog to one area",
      surface: "changelog",
      kind: "navigate",
      tab: "changelog",
      target: `changelog-area-${area}`,
    });
  }

  for (const element of input.appearanceElements) {
    registry.register({
      id: `appearance-${element.id}`,
      label: `Edit appearance: ${element.label}`,
      detail: "Open the per-element appearance editor",
      surface: "appearance",
      kind: "navigate",
      tab: "settings",
      target: `appearance-target-${element.id}`,
    });
  }

  return registry;
}

function settingTitle(descriptor: SettingDescriptor): string {
  return descriptor.keywords.split(" ").slice(0, 2).join(" ");
}

/**
 * Some controls depend on the current record: the display-name choice can only
 * offer the name a person actually saved, and the logo choice adds the local
 * image only when one is loaded.
 */
function resolveControl(descriptor: SettingDescriptor, preferences: Preferences): ControlDescriptor {
  if (descriptor.preferenceKey === "displayName" && descriptor.control.control === "select") {
    const saved = preferences.displayName.trim();
    return {
      control: "select",
      preferenceKey: "displayName",
      options:
        saved.length > 0
          ? [...descriptor.control.options, { value: saved, label: saved }]
          : [...descriptor.control.options],
    };
  }
  if (descriptor.preferenceKey === "logo" && descriptor.control.control === "select") {
    return {
      control: "select",
      preferenceKey: "logo",
      options:
        preferences.logo.kind === "local"
          ? [...descriptor.control.options, { value: "local", label: "Locally chosen image" }]
          : [...descriptor.control.options],
    };
  }
  return descriptor.control;
}

/** Preference keys with no reachable command, sorted. Empty means covered. */
export function uncoveredPreferenceKeys(registry: CommandRegistry): string[] {
  return assertCommandCoverage([...PREFERENCE_KEYS] as string[], registry);
}
