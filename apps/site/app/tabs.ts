/**
 * The site's tab strip, bound to the shared kernel tab model.
 *
 * Ordering, pinning, grouping, keyboard movement, overflow and bulk close are
 * all kernel functions. This module supplies the shipped descriptors, the
 * persisted-state validator and the label resolution, and nothing else.
 */

import {
  type LanguageMode,
  type TabGroup,
  type TabModel,
  type TabsState,
  formatBilingual,
  sortTabs,
} from "@material-tax-reporting/surface-kernel";

export type SiteTabId =
  | "home"
  | "workflow"
  | "scope"
  | "docs"
  | "changelog"
  | "downloads"
  | "converter"
  | "assistant"
  | "utilities"
  | "settings";

export type SiteTabDescriptor = {
  id: SiteTabId;
  en: string;
  zh: string;
  short: string;
  groupId: string;
  closable: boolean;
};

/** The shipped tabs, in their shipped order. Home is never closable. */
export const SITE_TABS: readonly SiteTabDescriptor[] = [
  { id: "home", en: "Home", zh: "首頁", short: "H", groupId: "reading", closable: false },
  { id: "workflow", en: "Paper-only workflow", zh: "紙本流程", short: "P", groupId: "reading", closable: true },
  { id: "scope", en: "Canada/Ontario scope", zh: "加拿大／安省範圍", short: "C", groupId: "reading", closable: true },
  { id: "docs", en: "Documentation", zh: "文件", short: "D", groupId: "reading", closable: true },
  { id: "changelog", en: "Changelog", zh: "更新紀錄", short: "L", groupId: "reading", closable: true },
  { id: "downloads", en: "Downloads", zh: "下載", short: "W", groupId: "tools", closable: true },
  { id: "converter", en: "File converter", zh: "檔案轉換", short: "F", groupId: "tools", closable: true },
  { id: "assistant", en: "Local model runtime", zh: "本機模型", short: "M", groupId: "tools", closable: true },
  { id: "utilities", en: "Utilities", zh: "工具", short: "U", groupId: "tools", closable: true },
  { id: "settings", en: "Settings", zh: "設定", short: "S", groupId: "personal", closable: true },
];

/** The shipped groups. `accent` is a token name, never a raw colour. */
export const SITE_TAB_GROUPS: readonly TabGroup[] = [
  { id: "reading", name: "Documentation", accent: "var(--primary)", collapsed: false },
  { id: "tools", name: "Tools", accent: "var(--on-surface-variant)", collapsed: false },
  { id: "personal", name: "Personalization", accent: "var(--outline)", collapsed: false },
];

export const SITE_TAB_IDS: readonly SiteTabId[] = SITE_TABS.map((tab) => tab.id);

const DESCRIPTOR_BY_ID = new Map<string, SiteTabDescriptor>(SITE_TABS.map((tab) => [tab.id, tab]));

/** Looks up a shipped descriptor, or null for an identifier we do not ship. */
export function tabDescriptor(id: string): SiteTabDescriptor | null {
  return DESCRIPTOR_BY_ID.get(id) ?? null;
}

/** The tab label for the active language mode. */
export function tabLabel(descriptor: SiteTabDescriptor, language: LanguageMode): string {
  if (language === "zh") return descriptor.zh;
  if (language === "both") return formatBilingual(descriptor.en, descriptor.zh);
  return descriptor.en;
}

/** The shipped strip: every tab open, in order, nothing pinned. */
export function defaultTabsState(): TabsState {
  return {
    tabs: SITE_TABS.map((tab, index) => ({
      id: tab.id,
      order: index,
      pinned: false,
      groupId: tab.groupId,
      closable: tab.closable,
    })),
    groups: SITE_TAB_GROUPS.map((group) => ({ ...group })),
    activeId: "home",
  };
}

function readTab(raw: unknown, index: number): TabModel | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const descriptor = typeof record.id === "string" ? tabDescriptor(record.id) : null;
  if (!descriptor) return null;
  return {
    id: descriptor.id,
    order: typeof record.order === "number" && Number.isFinite(record.order) ? record.order : index,
    pinned: record.pinned === true,
    groupId:
      typeof record.groupId === "string" && SITE_TAB_GROUPS.some((group) => group.id === record.groupId)
        ? record.groupId
        : null,
    closable: descriptor.closable,
  };
}

/**
 * Reads a persisted strip. Unknown identifiers are dropped, Home is always
 * restored, and a record that cannot be read at all falls back to the shipped
 * strip rather than leaving the site without navigation.
 */
export function validateTabsState(raw: unknown): TabsState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaultTabsState();
  const record = raw as Record<string, unknown>;
  const rawTabs = Array.isArray(record.tabs) ? record.tabs : [];
  const tabs = rawTabs
    .map((entry, index) => readTab(entry, index))
    .filter((tab): tab is TabModel => tab !== null);
  const seen = new Set(tabs.map((tab) => tab.id));
  if (!seen.has("home")) {
    tabs.unshift({ id: "home", order: -1, pinned: false, groupId: "reading", closable: false });
  }
  if (tabs.length === 0) return defaultTabsState();

  const groups = SITE_TAB_GROUPS.map((group) => {
    const stored = Array.isArray(record.groups)
      ? (record.groups as unknown[]).find(
          (entry) =>
            entry !== null &&
            typeof entry === "object" &&
            (entry as Record<string, unknown>).id === group.id,
        )
      : undefined;
    const collapsed =
      stored !== undefined && (stored as Record<string, unknown>).collapsed === true;
    const name =
      stored !== undefined && typeof (stored as Record<string, unknown>).name === "string"
        ? ((stored as Record<string, unknown>).name as string).slice(0, 60)
        : group.name;
    return { ...group, name: name.length > 0 ? name : group.name, collapsed };
  });

  const ordered = sortTabs(tabs).map((tab, index) => ({ ...tab, order: index }));
  const activeId =
    typeof record.activeId === "string" && ordered.some((tab) => tab.id === record.activeId)
      ? record.activeId
      : (ordered[0]?.id ?? "home");
  return { tabs: ordered, groups, activeId };
}

/** Searchable text for one tab, used by every tab-facing search field. */
export function tabHaystack(tab: TabModel, language: LanguageMode): string {
  const descriptor = tabDescriptor(tab.id);
  if (!descriptor) return tab.id;
  return `${descriptor.en} ${descriptor.zh} ${tabLabel(descriptor, language)} ${tab.groupId ?? ""}`;
}
