"use client";

/**
 * The documentation site shell.
 *
 * Every engine here comes from the shared surface kernel; this file is the
 * wiring. It owns the persisted records, the guarded setter every mutation
 * routes through, the copy accessor that applies humour and personal
 * vocabulary once at render time, and the layout of the tabbed surfaces.
 *
 * Nothing on this site files, submits or transmits a return, and no control
 * here changes a tax figure, a rule citation, the paper-only boundary or the
 * manual-review requirement.
 */

import {
  type AppearanceStore,
  type CommandDescriptor,
  type LockRecord,
  type Notification,
  type Preferences,
  type SearchState,
  type SupportTicket,
  type TabsState,
  DEFAULT_PREFERENCES,
  LEGACY_PREFERENCES_KEY,
  MAX_FONT_SCALE,
  MAX_FUNNY_LEVEL,
  MIN_FONT_SCALE,
  STORAGE_KEYS,
  applyPreferencePatch,
  applyVocabulary,
  compileReplacements,
  createSearchState,
  importAppearancePreset,
  matchesSearch,
  migratePreferencesV1toV2,
  resolveCopy,
  resolveDisplayName,
  teleportTarget,
  validatePreferences,
  validateVocabularyDocument,
} from "@material-tax-reporting/surface-kernel";
import {
  type CSSProperties,
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AppearanceEditor, APPEARANCE_ELEMENTS, appearanceLabel, appearanceStyle } from "./appearance.tsx";
import { ChangelogViewer, EMPTY_RANGE, type ChangelogRange } from "./changelog-viewer.tsx";
import { CommandPalette } from "./command-palette.tsx";
import { ConverterPanel } from "./converter-panel.tsx";
import { CHANGELOG_AREAS } from "./data/changelog.ts";
import { SETTING_DESCRIPTORS, buildCommandRegistry, uncoveredPreferenceKeys } from "./data/commands.ts";
import {
  CANTONESE_TONE_NOTES,
  COPY,
  DISCLAIMER_SENTENCE,
  ENGLISH_TONE_NOTES,
  FOOTER_DISCLAIMER,
  OFFICIAL_REFERENCES,
  REVIEW_AREAS,
  SHIPPED_PRODUCT_NAME,
  SITE_IMMUTABLE_SPANS,
  WORKFLOW_STEPS,
} from "./data/copy.ts";
import { DOC_ENTRIES } from "./data/docs.ts";
import { DocumentationBrowser } from "./docs-browser.tsx";
import { DownloadSurfaces, RELEASE_ASSET_COUNT } from "./download-surfaces.tsx";
import {
  EXPORT_SANDBOX_NOTE,
  copyExport,
  deliverConvertedFile,
  deliverExport,
  folderSaveSupported,
  type ConvertedFileRequest,
  type ExportRequest,
} from "./exports.ts";
import { HistoryPanel } from "./history-panel.tsx";
import { diffRecords, useHistory, vocabularyShape } from "./history.ts";
import { BrandMark, IdentitySettings } from "./identity.tsx";
import { LOCK_DISCLOSURE, LockPanel, useLocks, validateLocks } from "./locks.tsx";
import { useNarration } from "./narration.ts";
import { NotificationsCentre } from "./notifications-centre.tsx";
import { useNotifications, validateNotifications } from "./notifications.ts";
import { LocalModelRuntimePanel } from "./ollama-tab.tsx";
import { ExternalSettingsPanel, SchedulePanel } from "./scheduling-panel.tsx";
import {
  DEFAULT_SCHEDULE_STATE,
  MANUAL_OVERRIDE_STORAGE_KEY,
  SCHEDULABLE_TARGETS,
  applyOverlay,
  describeScheduleShape,
  governedTargets,
  pruneManualOverrides,
  useScheduling,
  validateManualOverrides,
  validateScheduleState,
  type EffectiveSource,
  type ManualOverrides,
  type ScheduleState,
} from "./scheduling.ts";
import { MenuFilterWithBuilder, SearchWithBuilder, type SearchBinding } from "./search-builder.tsx";
import { SupportNotesPanel, validateTickets } from "./support-tickets.tsx";
import { TabStrip } from "./tab-strip.tsx";
import { SITE_TABS, defaultTabsState, tabDescriptor, validateTabsState, type SiteTabId } from "./tabs.ts";
import { AuthenticatorPanel } from "./totp-panel.tsx";

const AUTHENTICATOR_STORAGE = STORAGE_KEYS.authenticator;

/** The settings card, and the lock check, both address a setting by this id. */
const SETTING_ID_BY_PREFERENCE_KEY: ReadonlyMap<string, string> = new Map(
  SETTING_DESCRIPTORS.map((descriptor) => [descriptor.preferenceKey as string, descriptor.id]),
);

/** What the settings card says about where its current value came from. */
const SOURCE_LABELS: Record<EffectiveSource, string> = {
  manual: "your own change, held while a rule is setting this",
  rule: "an active schedule rule",
  external: "the external settings document",
  default: "local preference",
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* A browser that refuses the write keeps the previous record. */
  }
}

function useNarrowLayout(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
}

export function SiteApp(): ReactNode {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);
  const [vocabulary, setVocabulary] = useState<Record<string, string>>({});
  const [vocabularyStatus, setVocabularyStatus] = useState("No personal vocabulary file is loaded.");
  const [tabsState, setTabsState] = useState<TabsState>(defaultTabsState);
  const [appearance, setAppearance] = useState<AppearanceStore>({});
  const [locks, setLocks] = useState<LockRecord[]>([]);
  const [schedule, setSchedule] = useState<ScheduleState>(DEFAULT_SCHEDULE_STATE);
  const [overrides, setOverrides] = useState<ManualOverrides>({});
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [authenticatorSecret, setAuthenticatorSecret] = useState<string | null>(null);
  const [searches, setSearches] = useState<Record<string, SearchState>>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [appearanceTarget, setAppearanceTarget] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [changelogRange, setChangelogRange] = useState<ChangelogRange>(EMPTY_RANGE);
  const [narrationEnabled, setNarrationEnabled] = useState(false);

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const paletteInvoker = useRef<HTMLElement | null>(null);
  const narrow = useNarrowLayout();

  // ------------------------------------------------------------- loading --
  useEffect(() => {
    const storedPreferences = window.localStorage.getItem(STORAGE_KEYS.preferences);
    const legacy = window.localStorage.getItem(LEGACY_PREFERENCES_KEY);
    setPreferences(
      storedPreferences !== null
        ? validatePreferences(readJson(STORAGE_KEYS.preferences, DEFAULT_PREFERENCES))
        : legacy !== null
          ? migratePreferencesV1toV2(legacy)
          : DEFAULT_PREFERENCES,
    );
    const storedVocabulary = readJson<Record<string, string>>(STORAGE_KEYS.vocabulary, {});
    setVocabulary(storedVocabulary);
    const count = Object.keys(storedVocabulary).length;
    if (count > 0) {
      setVocabularyStatus(`${count} validated local replacement${count === 1 ? "" : "s"} loaded.`);
    }
    setTabsState(validateTabsState(readJson(STORAGE_KEYS.tabs, null)));
    const storedAppearance = window.localStorage.getItem(STORAGE_KEYS.appearance);
    if (storedAppearance !== null) {
      const verdict = importAppearancePreset(storedAppearance);
      if (verdict.ok) setAppearance(verdict.store);
    }
    setLocks(validateLocks(readJson(STORAGE_KEYS.locks, [])));
    setSchedule(validateScheduleState(readJson(STORAGE_KEYS.schedules, null)));
    setOverrides(validateManualOverrides(readJson(MANUAL_OVERRIDE_STORAGE_KEY, null)));
    setTickets(validateTickets(readJson(STORAGE_KEYS.tickets, [])));
    const secret = window.localStorage.getItem(AUTHENTICATOR_STORAGE);
    setAuthenticatorSecret(secret !== null && secret.length > 0 ? secret : null);
    setLoaded(true);
  }, []);

  // ---------------------------------------------------------- persistence --
  useEffect(() => {
    if (loaded) writeJson(STORAGE_KEYS.preferences, preferences);
  }, [loaded, preferences]);
  useEffect(() => {
    if (loaded) writeJson(STORAGE_KEYS.tabs, tabsState);
  }, [loaded, tabsState]);
  useEffect(() => {
    if (loaded) {
      writeJson(STORAGE_KEYS.appearance, { version: 1, name: "current", elements: appearance });
    }
  }, [appearance, loaded]);
  useEffect(() => {
    if (loaded) writeJson(STORAGE_KEYS.locks, locks);
  }, [loaded, locks]);
  useEffect(() => {
    if (loaded) writeJson(STORAGE_KEYS.schedules, schedule);
  }, [loaded, schedule]);
  // A hold has to survive a reload, or a rule would win again on the next load
  // and the control the reader just used would appear to have done nothing.
  useEffect(() => {
    if (loaded) writeJson(MANUAL_OVERRIDE_STORAGE_KEY, overrides);
  }, [loaded, overrides]);
  useEffect(() => {
    if (loaded) writeJson(STORAGE_KEYS.tickets, tickets);
  }, [loaded, tickets]);
  useEffect(() => {
    if (!loaded) return;
    if (authenticatorSecret === null) window.localStorage.removeItem(AUTHENTICATOR_STORAGE);
    else window.localStorage.setItem(AUTHENTICATOR_STORAGE, authenticatorSecret);
  }, [authenticatorSecret, loaded]);

  // ------------------------------------------------------------- services --
  const persistNotifications = useCallback((list: Notification[]) => {
    writeJson(STORAGE_KEYS.notifications, list.slice(0, 200));
  }, []);
  const notifications = useNotifications(persistNotifications);
  const notify = useCallback(
    (kind: "success" | "error" | "progress" | "info", title: string, body: string) =>
      notifications.notify({ kind, title, body }),
    [notifications],
  );
  const notifyPair = useCallback(
    (kind: "success" | "error", title: string, body: string) => {
      notify(kind, title, body);
    },
    [notify],
  );

  // Restores the persisted centre without replaying old notices as toasts.
  const hydrateNotifications = notifications.hydrate;
  useEffect(() => {
    hydrateNotifications(validateNotifications(readJson(STORAGE_KEYS.notifications, [])));
  }, [hydrateNotifications]);

  const history = useHistory({
    redaction: { vocabularyValues: Object.values(vocabulary) },
    onError: (message) => notify("error", "Local history unavailable", message),
  });

  const locksApi = useLocks({
    locks,
    onChange: (next) => {
      setLocks(next);
      history.record("lock-create", "Changed the element locks", [
        { path: "locks.count", before: String(locks.length), after: String(next.length) },
      ]);
    },
  });

  // A schedule edit is a settings change, so it is recorded like one. The
  // shape carries the rules and whether an external address is set, never the
  // address itself.
  const scheduling = useScheduling({
    state: schedule,
    onChange: (next) => {
      const diff = diffRecords(describeScheduleShape(schedule), describeScheduleShape(next));
      setSchedule(next);
      if (diff.length > 0) history.record("schedule-change", "Changed the presentation schedule", diff);
    },
  });

  // A lock is enforced in two places because a value can be changed in two
  // ways: the guarded setter refuses a write to the stored preference, and this
  // withholds the overlay. A rule reaches the effective settings without
  // passing the setter, so without this half a lock on a setting would be
  // bypassed by a rule naming the same setting.
  const isBlocked = locksApi.blocked;
  const lockedTargets = useMemo(() => {
    const locked = new Set<string>();
    for (const target of SCHEDULABLE_TARGETS) {
      const id = SETTING_ID_BY_PREFERENCE_KEY.get(target);
      if (id !== undefined && isBlocked(id)) locked.add(target);
    }
    return locked;
  }, [isBlocked]);

  /** The settings a rule or the external document is setting at this moment. */
  const governed = useMemo(
    () => governedTargets(scheduling.overlay, scheduling.externalState.values),
    [scheduling.externalState.values, scheduling.overlay],
  );

  // A hold expires when nothing is setting that value any more. Returning the
  // same object when nothing expired is what keeps this from looping.
  useEffect(() => {
    if (!loaded) return;
    setOverrides((current) => pruneManualOverrides(current, governed));
  }, [governed, loaded]);

  const resolution = useMemo(
    () =>
      applyOverlay(
        preferences,
        scheduling.overlay,
        scheduling.externalState.values,
        overrides,
        lockedTargets,
      ),
    [lockedTargets, overrides, preferences, scheduling.externalState.values, scheduling.overlay],
  );
  const effective = resolution.preferences;

  // Read back from the resolution rather than from the stored record, so the
  // list names the settings a hold is actually deciding. A locked setting takes
  // no hold, and saying otherwise would describe an effect that is not there.
  const heldTargets = useMemo(
    () => SCHEDULABLE_TARGETS.filter((target) => resolution.sources[target] === "manual"),
    [resolution.sources],
  );

  const narration = useNarration(effective.narration, effective.language);

  // ------------------------------------------------------------ vocabulary --
  const compiled = useMemo(() => compileReplacements(vocabulary), [vocabulary]);
  const personalize = useCallback(
    (text: string) => applyVocabulary(text, compiled, { immutableSpans: [...SITE_IMMUTABLE_SPANS] }),
    [compiled],
  );
  const copy = useCallback(
    (key: string) =>
      personalize(
        resolveCopy(COPY, key, effective.language, effective.englishFunny, effective.cantoneseFunny),
      ),
    [effective.cantoneseFunny, effective.englishFunny, effective.language, personalize],
  );
  const copyIn = useCallback(
    (key: string, language: "en" | "zh") => {
      const entry = COPY[key];
      if (!entry) return key;
      const level = language === "en" ? effective.englishFunny : effective.cantoneseFunny;
      const index = Math.min(4, Math.max(0, Math.round(level) - 1));
      return personalize(entry[language][index] ?? "");
    },
    [effective.cantoneseFunny, effective.englishFunny, personalize],
  );

  // --------------------------------------------------------------- search --
  const bind = useCallback(
    (id: string, label: string, placeholder?: string): SearchBinding => ({
      id,
      label: personalize(label),
      ...(placeholder === undefined ? {} : { placeholder: personalize(placeholder) }),
      state: searches[id] ?? createSearchState(),
      onChange: (state: SearchState) => setSearches((current) => ({ ...current, [id]: state })),
    }),
    [personalize, searches],
  );

  // ------------------------------------------------------- guarded setter --
  const settingIdFor = useCallback((key: string) => {
    return SETTING_ID_BY_PREFERENCE_KEY.get(key) ?? null;
  }, []);

  /**
   * The one guarded setter every surface writes a preference through.
   *
   * A change to a setting a rule is currently setting also becomes a hold. The
   * stored preference alone is not enough there: the rule would keep winning,
   * and where the stored value already equalled the chosen one there would be
   * no change at all to record, so the control would write nothing, announce
   * nothing and snap straight back to the rule's value.
   */
  const updatePreferences = useCallback(
    (patch: Partial<Preferences>, summary: string) => {
      const blocked = Object.keys(patch).filter((key) => {
        const id = settingIdFor(key);
        return id !== null && locksApi.blocked(id);
      });
      if (blocked.length > 0) {
        notify(
          "error",
          "Change blocked by a lock",
          `${blocked.join(", ")} is locked in this browser. Unlock it in the settings tab before changing it. ${LOCK_DISCLOSURE}`,
        );
        return;
      }
      const next = applyPreferencePatch(preferences, patch);
      const diff = diffRecords(
        preferences as unknown as Record<string, unknown>,
        next as unknown as Record<string, unknown>,
      );
      const held: ManualOverrides = { ...overrides };
      const newlyHeld: string[] = [];
      for (const key of Object.keys(patch)) {
        if (!governed.has(key)) continue;
        if (!(key in held)) newlyHeld.push(key);
        held[key] = (next as unknown as Record<string, unknown>)[key];
      }
      const heldDiff = diffRecords(overrides, held, "scheduleHold.");
      if (diff.length === 0 && heldDiff.length === 0) return;
      if (diff.length > 0) setPreferences(next);
      if (heldDiff.length > 0) setOverrides(held);
      history.record("preference-change", summary, [...diff, ...heldDiff]);
      if (newlyHeld.length > 0) {
        notify(
          "info",
          "Held over the schedule",
          `${newlyHeld.join(", ")} will keep the value you just chose while a rule is still setting it, and your stored value is what shows once no rule applies. Choose "Follow the schedule rule again" on that setting to hand it back sooner.`,
        );
      }
    },
    [governed, history, locksApi, notify, overrides, preferences, settingIdFor],
  );

  /** Ends a hold early, so the rule setting that value takes it back. */
  const releaseHold = useCallback(
    (key: string) => {
      if (!(key in overrides)) return;
      const next = { ...overrides };
      delete next[key];
      setOverrides(next);
      history.record(
        "preference-change",
        `Handed ${key} back to the schedule`,
        diffRecords(overrides, next, "scheduleHold."),
      );
      notify("info", "Handed back to the schedule", `${key} follows its schedule rule again.`);
    },
    [history, notify, overrides],
  );

  const updateAppearance = useCallback(
    (next: AppearanceStore, summary: string) => {
      setAppearance(next);
      history.record("appearance-change", summary, [
        {
          path: "appearance.elementCount",
          before: String(Object.keys(appearance).length),
          after: String(Object.keys(next).length),
        },
      ]);
    },
    [appearance, history],
  );

  const updateTabs = useCallback(
    (next: TabsState, summary: string) => {
      setTabsState(next);
      history.record("preference-change", summary, [
        { path: "tabs.open", before: String(tabsState.tabs.length), after: String(next.tabs.length) },
        { path: "tabs.active", before: tabsState.activeId, after: next.activeId },
      ]);
    },
    [history, tabsState],
  );

  const updateTickets = useCallback(
    (next: SupportTicket[], summary: string) => {
      setTickets(next);
      history.record("ticket-create", summary, [
        { path: "tickets.count", before: String(tickets.length), after: String(next.length) },
      ]);
    },
    [history, tickets.length],
  );

  // -------------------------------------------------------------- exports --
  const runExport = useCallback(
    (request: ExportRequest) => {
      void deliverExport(request)
        .then((outcome) => {
          notify(
            "success",
            "Export delivered",
            `${outcome.fileName} (${outcome.byteLength} bytes) via the ${outcome.method} path. ${EXPORT_SANDBOX_NOTE}`,
          );
          history.record("export", `Exported ${request.collection}`, [
            { path: "export.collection", before: null, after: request.collection },
            { path: "export.rows", before: null, after: String(request.rows.length) },
            { path: "export.filter", before: null, after: request.filterDescription },
          ]);
        })
        .catch((error: unknown) =>
          notify(
            "error",
            "Export not delivered",
            error instanceof Error ? error.message : "The export could not be delivered.",
          ),
        );
    },
    [history, notify],
  );

  /**
   * A converted file leaves through the same delivery the exports use, so it
   * reports the same way and is recorded the same way. The reader's own file
   * name is not written to the record: the pair that produced the result is
   * what the record is about.
   */
  const saveConvertedFile = useCallback(
    (request: ConvertedFileRequest) => {
      void deliverConvertedFile(request)
        .then((outcome) => {
          notify(
            "success",
            "Converted file delivered",
            `${outcome.fileName} (${outcome.byteLength} bytes) via the ${outcome.method} path. ${outcome.manifestNote}`,
          );
          history.record("conversion", `Saved a converted ${request.targetType} file`, [
            { path: "conversion.source", before: null, after: request.sourceType },
            { path: "conversion.target", before: null, after: request.targetType },
            { path: "conversion.manifest", before: null, after: outcome.manifestStamped ? "stamped" : "omitted" },
          ]);
        })
        .catch((error: unknown) =>
          notify(
            "error",
            "Converted file not delivered",
            error instanceof Error ? error.message : "The converted file could not be delivered.",
          ),
        );
    },
    [history, notify],
  );

  const copyToClipboard = useCallback(
    (request: ExportRequest) => {
      void copyExport(request)
        .then((outcome) => notify("success", "Copied", `${outcome.byteLength} characters copied to the clipboard.`))
        .catch((error: unknown) =>
          notify("error", "Not copied", error instanceof Error ? error.message : "Clipboard access was refused."),
        );
    },
    [notify],
  );

  // ------------------------------------------------------------- commands --
  const registry = useMemo(
    () =>
      buildCommandRegistry({
        preferences: effective,
        documentation: DOC_ENTRIES.map((entry) => ({ slug: entry.slug, title: entry.title })),
        changelogAreas: CHANGELOG_AREAS,
        appearanceElements: APPEARANCE_ELEMENTS.map((element) => ({ id: element.id, label: element.label })),
      }),
    [effective],
  );

  useEffect(() => {
    const missing = uncoveredPreferenceKeys(registry);
    if (missing.length > 0) {
      notify(
        "error",
        "A setting has no command",
        `These preference keys are not reachable from the command palette: ${missing.join(", ")}.`,
      );
    }
    // Reported once per registry rebuild; the registry only changes with the
    // declarative sources.
  }, [registry]); // eslint-disable-line react-hooks/exhaustive-deps

  const openTab = useCallback(
    (id: string) => {
      const descriptor = tabDescriptor(id);
      if (!descriptor) return;
      setTabsState((current) =>
        current.tabs.some((tab) => tab.id === id)
          ? { ...current, activeId: id }
          : {
              ...current,
              activeId: id,
              tabs: [
                ...current.tabs,
                {
                  id,
                  order: current.tabs.length,
                  pinned: false,
                  groupId: descriptor.groupId,
                  closable: descriptor.closable,
                },
              ],
            },
      );
    },
    [],
  );

  const teleport = useCallback(
    (command: CommandDescriptor) => {
      openTab(command.tab);
      setPaletteOpen(false);
      const target = teleportTarget(command);
      window.setTimeout(() => {
        const preferred =
          target.preferInputId === undefined ? null : document.getElementById(target.preferInputId);
        const element =
          preferred ??
          document.getElementById(`${target.elementId}-input`) ??
          document.getElementById(target.elementId);
        if (!element) return;
        (element as HTMLElement).focus();
        element.scrollIntoView({ block: "center", behavior: effective.motion === "reduce" ? "auto" : "smooth" });
        element.classList.add("teleport-highlight");
        window.setTimeout(() => element.classList.remove("teleport-highlight"), 1400);
      }, 60);
    },
    [effective.motion, openTab],
  );

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    paletteInvoker.current?.focus();
  }, []);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        paletteInvoker.current = document.activeElement as HTMLElement | null;
        setPaletteOpen(true);
      }
      if (event.key === "Escape") {
        if (paletteOpen) closePalette();
        if (appearanceTarget !== null) setAppearanceTarget(null);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [appearanceTarget, closePalette, paletteOpen]);

  // -------------------------------------------------------------- styling --
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = effective.theme;
    root.dataset.density = effective.density;
    root.dataset.motion = effective.motion;
  }, [effective.density, effective.motion, effective.theme]);

  const effectiveDock = narrow ? "top" : effective.dock;
  const shellStyle = {
    "--accent": effective.accent,
    "--font-scale": effective.fontScale,
  } as CSSProperties;

  const appearanceProps = useCallback(
    (id: string) => ({
      style: appearanceStyle(appearance, id) as Record<string, string>,
      onContextMenu: (event: React.MouseEvent) => {
        event.preventDefault();
        setAppearanceTarget(id);
      },
    }),
    [appearance],
  );

  // ---------------------------------------------------------- vocabulary IO --
  const onVocabularyFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const verdict = validateVocabularyDocument(await file.text());
    if (!verdict.ok) {
      setVocabularyStatus(`File rejected: ${verdict.reason}`);
      notify("error", "Vocabulary not loaded", "The previous valid local vocabulary remains unchanged.");
      return;
    }
    const count = Object.keys(verdict.replacements).length;
    writeJson(STORAGE_KEYS.vocabulary, verdict.replacements);
    setVocabulary(verdict.replacements);
    setVocabularyStatus(
      `${count} validated local replacement${count === 1 ? "" : "s"} loaded. The source filename was not retained.`,
    );
    history.record("vocabulary-import", "Loaded a personal vocabulary file", vocabularyShape(verdict.replacements));
    notify("success", "Personal vocabulary loaded", `${count} local replacement${count === 1 ? "" : "s"} are active.`);
  };

  const clearVocabulary = () => {
    window.localStorage.removeItem(STORAGE_KEYS.vocabulary);
    setVocabulary({});
    setVocabularyStatus("No personal vocabulary file is loaded.");
    history.record("vocabulary-clear", "Cleared the personal vocabulary", vocabularyShape({}));
    notify("success", "Personal vocabulary cleared", "Original site wording is active again.");
  };

  // ---------------------------------------------------------------- panels --
  const openTabIds = useMemo(() => new Set(tabsState.tabs.map((tab) => tab.id)), [tabsState.tabs]);
  const activeId = tabsState.activeId ?? "home";
  const emoji = effective.dialogEmoji;
  const displayName = personalize(resolveDisplayName(effective, SHIPPED_PRODUCT_NAME));

  const settingsSearch = bind("settings-search", copy("settings.searchLabel"), "Search setting names and values");
  const settingVisible = (keywords: string) => matchesSearch(keywords, settingsSearch.state);

  const readSection = (key: string) => {
    narration.read(copyIn(key, "en"), copyIn(key, "zh"));
  };

  const ReadAloud = ({ copyKey, label }: { copyKey: string; label: string }): ReactNode => (
    <button
      type="button"
      className="text-button read-aloud"
      disabled={!narration.available}
      aria-label={`${copy("action.readSection")}: ${label}`}
      title={narration.available ? undefined : narration.statusMessage}
      onClick={() => readSection(copyKey)}
    >
      <span aria-hidden="true">◈</span> {copy("action.readSection")}
    </button>
  );

  const panelProps = (id: SiteTabId) => ({
    id: `panel-${id}`,
    role: "tabpanel" as const,
    "aria-labelledby": `tab-${id}`,
    hidden: activeId !== id,
    tabIndex: -1,
    ...appearanceProps(`panel-${id}`),
  });

  return (
    <div
      className={`app-shell dock-${effectiveDock} density-${effective.density} motion-${effective.motion}`}
      data-theme={effective.theme}
      style={shellStyle}
    >
      <a className="skip-link" href="#main-content">
        {copy("shell.skipToContent")}
      </a>

      <header className="top-bar" id="top-bar" {...appearanceProps("top-bar")}>
        <BrandMark logo={effective.logo} />
        <div className="brand-copy">
          <strong>{displayName}</strong>
          <span>{copy("brand.tagline")}</span>
        </div>
        <div className="header-actions">
          <span className="status-chip">
            <span aria-hidden="true">●</span> {copy("shell.statusChip")}
          </span>
          <button
            type="button"
            className="tonal-button"
            onClick={(event) => {
              paletteInvoker.current = event.currentTarget;
              setPaletteOpen(true);
            }}
          >
            {copy("shell.commands")} <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd>
          </button>
          <button
            type="button"
            className="icon-button history-button"
            aria-label={`${copy("notifications.open")}: ${notifications.unreadCount} unread`}
            onClick={() => setNotificationsOpen(true)}
          >
            <span aria-hidden="true">◴</span>
            {notifications.unreadCount > 0 && <span className="badge">{notifications.unreadCount}</span>}
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={copy("history.title")}
            onClick={() => setHistoryOpen(true)}
          >
            <span aria-hidden="true">⟲</span>
          </button>
        </div>
      </header>

      <TabStrip
        state={tabsState}
        onChange={updateTabs}
        dock={effectiveDock}
        language={effective.language}
        onNotify={notifyPair}
        registerRef={(id, element) => {
          tabRefs.current[id] = element;
        }}
        appearanceProps={appearanceProps}
        searches={{
          tabs: bind("tab-search", "Search open tabs", "Search tab names"),
          groups: bind("tab-group-search", "Search tab groups", "Search group names"),
          movePicker: bind("tab-move-search", "Filter the move picker", "Search positions"),
          bulkClose: bind("tab-bulk-close-search", "Close tabs matching a query", "Search tab names"),
        }}
      />

      <main id="main-content" className="content-area" tabIndex={-1} {...appearanceProps("main-content")}>
        {openTabIds.has("home") && (
          <section {...panelProps("home")}>
            <div className="hero-grid">
              <div className="hero-copy">
                <p className="eyebrow">{copy("home.eyebrow")}</p>
                <h1>{copy("home.title")}</h1>
                <p className="hero-lede">{copy("home.lede")}</p>
                <div className="hero-actions">
                  <button type="button" className="filled-button" onClick={() => openTab("workflow")}>
                    {copy("home.readWorkflow")}
                  </button>
                  <button type="button" className="outlined-button" onClick={() => openTab("scope")}>
                    {copy("home.openSources")}
                  </button>
                  <ReadAloud copyKey="home.lede" label={copy("home.title")} />
                </div>
              </div>
              <aside className="boundary-card" aria-labelledby="boundary-title">
                <div className="boundary-graphic" aria-hidden="true">
                  <span className="sheet sheet-back" />
                  <span className="sheet sheet-front">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="review-stamp">REVIEW</span>
                </div>
                <p className="eyebrow">{copy("home.boundaryEyebrow")}</p>
                <h2 id="boundary-title">{copy("home.boundaryTitle")}</h2>
                <p>{copy("home.boundaryBody")}</p>
              </aside>
            </div>

            <div className="status-grid" aria-label={copy("home.statusLabel")}>
              <article>
                <span className="metric">0</span>
                <h2>{copy("home.shippedApplications")}</h2>
                <p>{copy("home.shippedApplicationsNote")}</p>
              </article>
              <article>
                <span className="metric">{RELEASE_ASSET_COUNT}</span>
                <h2>{copy("home.availableInstallers")}</h2>
                <p>{copy("home.availableInstallersNote")}</p>
              </article>
              <article>
                <span className="metric">{REVIEW_AREAS.length}</span>
                <h2>{copy("home.reviewAreas")}</h2>
                <p>{copy("home.reviewAreasNote")}</p>
              </article>
            </div>

            <DownloadSurfaces onNotify={notify} />
          </section>
        )}

        {openTabIds.has("workflow") && (
          <section {...panelProps("workflow")}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">{copy("workflow.eyebrow")}</p>
                <h1>{copy("workflow.title")}</h1>
                <p>{copy("workflow.lede")}</p>
              </div>
              <ReadAloud copyKey="workflow.lede" label={copy("workflow.title")} />
            </div>
            <ol className="workflow-list">
              {WORKFLOW_STEPS.map((step) => (
                <li key={step.number}>
                  <span className="step-number">{step.number}</span>
                  <div>
                    <h2>{personalize(step.title)}</h2>
                    <p>{personalize(step.body)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <section className="review-panel" aria-labelledby="review-panel-title">
              <div>
                <p className="eyebrow">{copy("workflow.reviewEyebrow")}</p>
                <h2 id="review-panel-title">{copy("workflow.reviewTitle")}</h2>
                <p>{copy("workflow.reviewBody")}</p>
              </div>
              <ul className="review-checks">
                {REVIEW_AREAS.map((item) => (
                  <li key={item}>
                    <span aria-hidden="true">✓</span>
                    {personalize(item)}
                  </li>
                ))}
              </ul>
            </section>
          </section>
        )}

        {openTabIds.has("scope") && (
          <section {...panelProps("scope")}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">{copy("scope.eyebrow")}</p>
                <h1>{copy("scope.title")}</h1>
                <p>{DISCLAIMER_SENTENCE}</p>
              </div>
              <ReadAloud copyKey="scope.lede" label={copy("scope.title")} />
            </div>
            <div className="scope-grid">
              <article className="scope-card">
                <span className="scope-letter" aria-hidden="true">
                  CA
                </span>
                <h2>{copy("scope.federalTitle")}</h2>
                <p>{copy("scope.federalBody")}</p>
              </article>
              <article className="scope-card">
                <span className="scope-letter" aria-hidden="true">
                  ON
                </span>
                <h2>{copy("scope.ontarioTitle")}</h2>
                <p>{copy("scope.ontarioBody")}</p>
              </article>
            </div>
            <section className="official-links" aria-labelledby="official-links-title">
              <div>
                <p className="eyebrow">{copy("scope.linksEyebrow")}</p>
                <h2 id="official-links-title">{copy("scope.linksTitle")}</h2>
              </div>
              <ul>
                {OFFICIAL_REFERENCES.map((reference) => (
                  <li key={reference.href}>
                    <a href={reference.href} target="_blank" rel="noreferrer">
                      {reference.text} <span aria-hidden="true">↗</span>
                    </a>
                    <p>{personalize(reference.note)}</p>
                  </li>
                ))}
              </ul>
            </section>
          </section>
        )}

        {openTabIds.has("docs") && (
          <section {...panelProps("docs")}>
            <div className="section-heading docs-heading">
              <div>
                <p className="eyebrow">{copy("docs.eyebrow")}</p>
                <h1>{copy("docs.title")}</h1>
                <p>{copy("docs.lede")}</p>
              </div>
              <ReadAloud copyKey="docs.lede" label={copy("docs.title")} />
            </div>
            <DocumentationBrowser
              search={bind("documentation-search", copy("docs.searchLabel"), copy("docs.searchPlaceholder"))}
              areaFilter={bind("documentation-area-search", copy("docs.areaFilterLabel"), "Search areas")}
              topicFilter={bind("documentation-topic-search", copy("docs.topicFilterLabel"), "Search topics")}
              activeSlug={activeDoc}
              onSelect={setActiveDoc}
              onExport={runExport}
              copy={copy}
            />
            <section className="feature-boundary" aria-labelledby="unavailable-title">
              <p className="eyebrow">Honest capability inventory</p>
              <h2 id="unavailable-title">Unavailable broader features</h2>
              <p>
                This site does not present placeholders as working product features. Accounts, electronic
                filing, submission services, payments, cloud tax storage, tax calculations, PDF generation,
                installers and automatic updates are not available. The feature library above lists what this
                site does do, links each capability to its article, and repeats what the tracked
                verification-status article records as not run.
              </p>
            </section>
          </section>
        )}

        {openTabIds.has("changelog") && (
          <section {...panelProps("changelog")}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Tracked source</p>
                <h1>{copy("changelog.title")}</h1>
                <p>{copy("changelog.lede")}</p>
              </div>
              <ReadAloud copyKey="changelog.lede" label={copy("changelog.title")} />
            </div>
            <ChangelogViewer
              search={bind("changelog-search", copy("changelog.searchLabel"), "Search entries")}
              areaFilter={bind("changelog-area-search", "Filter changelog areas", "Search areas")}
              range={changelogRange}
              onRangeChange={setChangelogRange}
              onExport={runExport}
              copy={copy}
            />
          </section>
        )}

        {openTabIds.has("downloads") && (
          <section {...panelProps("downloads")}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Release manifest</p>
                <h1>{copy("downloads.title")}</h1>
                <p>{copy("downloads.unsignedNotice")}</p>
              </div>
            </div>
            <DownloadSurfaces onNotify={notify} />
          </section>
        )}

        {openTabIds.has("converter") && (
          <section {...panelProps("converter")}>
            <ConverterPanel
              binding={bind("converter-catalog-search", "Search registered conversions", "Search formats")}
              onNotify={notify}
              onSave={saveConvertedFile}
              copy={copy}
            />
          </section>
        )}

        {openTabIds.has("assistant") && (
          <section {...panelProps("assistant")}>
            <LocalModelRuntimePanel
              installedSearch={bind("ollama-installed-search", "Search installed models", "Search references")}
              catalogSearch={bind("ollama-catalog-search", "Search the catalogue", "Search references")}
              queueSearch={bind("ollama-queue-search", "Search the batch", "Search references")}
              onNotify={notify}
            />
          </section>
        )}

        {openTabIds.has("utilities") && (
          <section {...panelProps("utilities")}>
            <AuthenticatorPanel
              secret={authenticatorSecret}
              onSecretChange={setAuthenticatorSecret}
              onNotify={notifyPair}
            />
            <SupportNotesPanel
              tickets={tickets}
              onChange={updateTickets}
              binding={bind("ticket-search", "Search support notes", "Search titles and bodies")}
              onNotify={notifyPair}
              onExport={runExport}
            />
          </section>
        )}

        {openTabIds.has("settings") && (
          <section {...panelProps("settings")}>
            <div className="section-heading settings-heading">
              <div>
                <p className="eyebrow">{copy("settings.eyebrow")}</p>
                <h1>{copy("settings.title")}</h1>
                <p>{copy("settings.lede")}</p>
              </div>
              <button
                type="button"
                className="outlined-button"
                onClick={() => updatePreferences(DEFAULT_PREFERENCES, "Reset every personalization value")}
              >
                {copy("settings.reset")}
              </button>
            </div>

            <SearchWithBuilder {...settingsSearch} />

            <div className="settings-grid">
              {SETTING_DESCRIPTORS.filter(
                (descriptor) => !["displayName", "logo", "narration"].includes(descriptor.preferenceKey),
              )
                .filter((descriptor) => settingVisible(`${descriptor.keywords} ${copy(descriptor.titleKey)}`))
                .map((descriptor) => {
                  const locked = locksApi.blocked(descriptor.id);
                  const control = descriptor.control;
                  const value = effective[descriptor.preferenceKey];
                  const source: EffectiveSource = resolution.sources[descriptor.preferenceKey] ?? "default";
                  return (
                    <section
                      className={`setting-card${control.control === "range" ? " wide-setting" : ""}`}
                      key={descriptor.id}
                      id={descriptor.id}
                      tabIndex={-1}
                      {...appearanceProps(descriptor.id)}
                    >
                      <div>
                        <h2>{copy(descriptor.titleKey)}</h2>
                        <p>{copy(descriptor.bodyKey)}</p>
                      </div>
                      {control.control === "select" && (
                        <select
                          id={`${descriptor.id}-input`}
                          aria-label={copy(descriptor.titleKey)}
                          disabled={locked}
                          value={String(value)}
                          onChange={(event) =>
                            updatePreferences(
                              { [descriptor.preferenceKey]: event.target.value } as Partial<Preferences>,
                              `Set ${descriptor.preferenceKey}`,
                            )
                          }
                        >
                          {control.options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )}
                      {control.control === "segmented" && (
                        <div className="segmented" role="group" aria-label={copy(descriptor.titleKey)}>
                          {control.options.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              id={option.value === String(value) ? `${descriptor.id}-input` : undefined}
                              disabled={locked}
                              aria-pressed={String(value) === option.value}
                              onClick={() =>
                                updatePreferences(
                                  { [descriptor.preferenceKey]: option.value } as Partial<Preferences>,
                                  `Set ${descriptor.preferenceKey}`,
                                )
                              }
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                      {control.control === "colour" && (
                        <label className="color-control">
                          <input
                            id={`${descriptor.id}-input`}
                            type="color"
                            disabled={locked}
                            aria-label={copy(descriptor.titleKey)}
                            value={String(value)}
                            onChange={(event) =>
                              updatePreferences({ accent: event.target.value }, "Set the accent colour")
                            }
                          />
                          <span>{String(value).toUpperCase()}</span>
                        </label>
                      )}
                      {control.control === "range" && (
                        <label className="range-control">
                          <span>
                            {descriptor.preferenceKey === "fontScale"
                              ? `${Math.round(Number(value) * 100)}%`
                              : `${Number(value)} of ${MAX_FUNNY_LEVEL}`}
                          </span>
                          <input
                            id={`${descriptor.id}-input`}
                            type="range"
                            disabled={locked}
                            aria-label={copy(descriptor.titleKey)}
                            min={control.min}
                            max={control.max}
                            step={control.step}
                            value={Number(value)}
                            onChange={(event) =>
                              updatePreferences(
                                { [descriptor.preferenceKey]: Number(event.target.value) } as Partial<Preferences>,
                                `Set ${descriptor.preferenceKey}`,
                              )
                            }
                          />
                          <span>
                            {descriptor.preferenceKey === "englishFunny"
                              ? ENGLISH_TONE_NOTES[Math.min(4, Math.max(0, Number(value) - 1))]
                              : descriptor.preferenceKey === "cantoneseFunny"
                                ? CANTONESE_TONE_NOTES[Math.min(4, Math.max(0, Number(value) - 1))]
                                : `Between ${MIN_FONT_SCALE * 100}% and ${MAX_FONT_SCALE * 100}%.`}
                          </span>
                        </label>
                      )}
                      {control.control === "switch" && (
                        <label className="inline-check">
                          <input
                            id={`${descriptor.id}-input`}
                            type="checkbox"
                            disabled={locked}
                            checked={value === true}
                            onChange={(event) =>
                              updatePreferences(
                                { [descriptor.preferenceKey]: event.target.checked } as Partial<Preferences>,
                                `Set ${descriptor.preferenceKey}`,
                              )
                            }
                          />
                          {copy(descriptor.titleKey)}
                        </label>
                      )}
                      {(control.control === "select" || control.control === "segmented") && (
                        <details className="picker-menu">
                          <summary>Filter these choices</summary>
                          <MenuFilterWithBuilder
                            binding={bind(
                              `${descriptor.id}-menu`,
                              `Filter the ${copy(descriptor.titleKey)} choices`,
                              "Search choices",
                            )}
                            options={control.options}
                            selected={String(value)}
                            onSelect={(choice) =>
                              updatePreferences(
                                { [descriptor.preferenceKey]: choice } as Partial<Preferences>,
                                `Set ${descriptor.preferenceKey}`,
                              )
                            }
                          />
                        </details>
                      )}
                      <small>
                        {locked
                          ? `This setting is locked in this browser${
                              governed.has(descriptor.preferenceKey)
                                ? ", so the rule naming it is not applied either"
                                : ""
                            }. ${LOCK_DISCLOSURE}`
                          : `Current source: ${SOURCE_LABELS[source]}.`}
                        {!locked && source === "manual" && (
                          <button
                            type="button"
                            className="text-button"
                            aria-label={`Follow the schedule rule again for ${copy(descriptor.titleKey)}`}
                            onClick={() => releaseHold(descriptor.preferenceKey)}
                          >
                            Follow the schedule rule again
                          </button>
                        )}
                      </small>
                    </section>
                  );
                })}

              {settingVisible("humour level English Cantonese playful serious tone") && (
                <section className="setting-card wide-setting funny-setting" id="humour-summary" tabIndex={-1}>
                  <div>
                    <h2>{copy("setting.funny.title")}</h2>
                    <p>{copy("setting.funny.body")}</p>
                  </div>
                  <div className="funny-grid">
                    <p>
                      English {effective.englishFunny}: {ENGLISH_TONE_NOTES[Math.min(4, effective.englishFunny - 1)]}
                    </p>
                    <p lang="zh-Hant">
                      廣東話 {effective.cantoneseFunny}:{" "}
                      {CANTONESE_TONE_NOTES[Math.min(4, effective.cantoneseFunny - 1)]}
                    </p>
                  </div>
                  <small>
                    Product limits, official names, links, counts, dates and action labels are identical at every
                    level.
                  </small>
                </section>
              )}

              {settingVisible("display name mark logo rename brand") && (
                <IdentitySettings
                  preferences={effective}
                  onChange={updatePreferences}
                  onNotify={notifyPair}
                  copy={copy}
                />
              )}

              {settingVisible("narration read aloud speech voice rate pitch") && (
                <section className="setting-card wide-setting" id="narration-setting" tabIndex={-1}>
                  <div>
                    <h2>{copy("setting.narration.title")}</h2>
                    <p>{copy("setting.narration.body")}</p>
                  </div>
                  <p className="file-status" role="status">
                    {narration.statusMessage}
                  </p>
                  <label className="inline-check">
                    <input
                      id="narration-setting-input"
                      type="checkbox"
                      disabled={!narration.available}
                      checked={effective.narration.enabled}
                      onChange={(event) =>
                        updatePreferences(
                          { narration: { ...effective.narration, enabled: event.target.checked } },
                          "Changed read-aloud",
                        )
                      }
                    />
                    Offer a read control on each section
                  </label>
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={narrationEnabled}
                      disabled={!narration.available}
                      onChange={(event) => setNarrationEnabled(event.target.checked)}
                    />
                    Also read a notification title when one arrives
                  </label>
                  <label className="field-label" htmlFor="narration-english-voice">
                    English voice
                  </label>
                  <select
                    id="narration-english-voice"
                    disabled={narration.englishVoices.length === 0}
                    value={effective.narration.englishVoiceId ?? ""}
                    onChange={(event) =>
                      updatePreferences(
                        { narration: { ...effective.narration, englishVoiceId: event.target.value || null } },
                        "Changed the English narration voice",
                      )
                    }
                  >
                    <option value="">Let the browser choose</option>
                    {narration.englishVoices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.label}
                      </option>
                    ))}
                  </select>
                  <label className="field-label" htmlFor="narration-cantonese-voice">
                    Cantonese voice
                  </label>
                  <select
                    id="narration-cantonese-voice"
                    disabled={narration.cantoneseVoices.length === 0}
                    value={effective.narration.cantoneseVoiceId ?? ""}
                    onChange={(event) =>
                      updatePreferences(
                        { narration: { ...effective.narration, cantoneseVoiceId: event.target.value || null } },
                        "Changed the Cantonese narration voice",
                      )
                    }
                  >
                    <option value="">Let the browser choose</option>
                    {narration.cantoneseVoices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.label}
                      </option>
                    ))}
                  </select>
                  <label className="range-control">
                    <span>Rate {effective.narration.rate.toFixed(2)}</span>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.05"
                      value={effective.narration.rate}
                      onChange={(event) =>
                        updatePreferences(
                          { narration: { ...effective.narration, rate: Number(event.target.value) } },
                          "Changed the narration rate",
                        )
                      }
                    />
                  </label>
                  <label className="range-control">
                    <span>Pitch {effective.narration.pitch.toFixed(2)}</span>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.05"
                      value={effective.narration.pitch}
                      onChange={(event) =>
                        updatePreferences(
                          { narration: { ...effective.narration, pitch: Number(event.target.value) } },
                          "Changed the narration pitch",
                        )
                      }
                    />
                  </label>
                  <button type="button" className="outlined-button" onClick={() => narration.cancel()}>
                    {copy("action.stopReading")}
                  </button>
                  <small>
                    Nothing is spoken on load. Identifiers, account numbers, mailing addresses, attachment names
                    and unlock answers are never read aloud.
                  </small>
                </section>
              )}

              {settingVisible("personal vocabulary JSON upload local replace clear") && (
                <section className="setting-card wide-setting" id="vocabulary-setting" tabIndex={-1}>
                  <div>
                    <h2>{copy("setting.vocabulary.title")}</h2>
                    <p>{copy("setting.vocabulary.body")}</p>
                  </div>
                  <div className="upload-actions">
                    <label className="filled-button file-button">
                      Choose JSON file
                      <input
                        id="vocabulary-setting-input"
                        type="file"
                        accept="application/json,.json"
                        onChange={(event) => void onVocabularyFile(event)}
                      />
                    </label>
                    <button
                      type="button"
                      className="outlined-button"
                      onClick={clearVocabulary}
                      disabled={Object.keys(vocabulary).length === 0}
                    >
                      Clear local vocabulary
                    </button>
                  </div>
                  <p className="file-status" role="status">
                    {vocabularyStatus}
                  </p>
                  <details>
                    <summary>Version 1 format and limits</summary>
                    <p>
                      The root contains only <code>version: 1</code> and a <code>replacements</code> object. The
                      file is limited to 64 KB, 200 string replacements, keys of 1 to 80 characters, and values
                      of at most 200 characters. Unsafe object keys and unknown fields are rejected, and the last
                      valid local cache stays active after a rejected file.
                    </p>
                  </details>
                  <small>
                    Replacements apply to every string this site renders, except the official reference wording
                    and addresses, the paper-only boundary sentence and the disclaimers, which are never
                    rewritten.
                  </small>
                </section>
              )}

              {settingVisible("schedule rules time window presentation") && (
                <SchedulePanel
                  api={scheduling}
                  binding={bind("schedule-rule-search", "Search schedule rules", "Search settings and times")}
                  copy={copy}
                  held={heldTargets}
                  onRelease={releaseHold}
                />
              )}

              {settingVisible("external settings https allowlist presentation") && (
                <ExternalSettingsPanel api={scheduling} copy={copy} />
              )}

              {settingVisible("appearance editor element override typography colour") && (
                <section className="setting-card wide-setting" id="appearance-setting" tabIndex={-1}>
                  <div>
                    <h2>{copy("appearance.title")}</h2>
                    <p>{copy("appearance.lede")}</p>
                  </div>
                  <label className="field-label" htmlFor="appearance-setting-input">
                    Element
                  </label>
                  <select
                    id="appearance-setting-input"
                    value={appearanceTarget ?? ""}
                    onChange={(event) => setAppearanceTarget(event.target.value || null)}
                  >
                    <option value="">Choose an element</option>
                    {APPEARANCE_ELEMENTS.map((element) => (
                      <option key={element.id} value={element.id}>
                        {element.group}: {element.label}
                      </option>
                    ))}
                  </select>
                  <small>
                    A right-click or context-menu key on any registered element opens the same editor. Overrides
                    are scoped custom properties: they cannot remove the focus ring and cannot defeat reduced
                    motion.
                  </small>
                  <button
                    type="button"
                    className="outlined-button"
                    onClick={() =>
                      runExport({
                        collection: "Appearance overrides",
                        filterDescription: "Every stored override",
                        columns: [
                          { key: "element", label: "Element" },
                          { key: "property", label: "Property" },
                          { key: "value", label: "Value" },
                        ],
                        rows: Object.entries(appearance).flatMap(([element, properties]) =>
                          Object.entries(properties).map(([property, value]) => ({ element, property, value })),
                        ),
                        format: "json",
                      })
                    }
                  >
                    {copy("action.export")}
                  </button>
                </section>
              )}

              {settingVisible("element locks accidental edit guard") && (
                <LockPanel
                  api={locksApi}
                  binding={bind("lock-search", "Search locked items", "Search elements and hints")}
                  onNotify={notifyPair}
                  onExport={runExport}
                  elements={APPEARANCE_ELEMENTS.map((element) => ({ id: element.id, label: element.label }))}
                />
              )}
            </div>

            <section className="feature-boundary">
              <p className="eyebrow">Export delivery</p>
              <h2>How an export leaves this page</h2>
              <p>
                {EXPORT_SANDBOX_NOTE}{" "}
                {folderSaveSupported()
                  ? "This browser supports choosing a folder."
                  : "This browser did not expose the folder-choosing interface, so an export is delivered as a download."}
              </p>
              <button
                type="button"
                className="outlined-button"
                onClick={() =>
                  copyToClipboard({
                    collection: "Preferences",
                    filterDescription: "Every stored preference",
                    columns: [
                      { key: "key", label: "Setting" },
                      { key: "value", label: "Value" },
                    ],
                    rows: Object.entries(effective).map(([key, value]) => ({
                      key,
                      value: typeof value === "object" ? JSON.stringify(value) : String(value),
                    })),
                    format: "markdown",
                  })
                }
              >
                Copy the current preferences to the clipboard
              </button>
            </section>
          </section>
        )}
      </main>

      <footer className="site-footer" id="site-footer" {...appearanceProps("site-footer")}>
        <p>
          <strong>{displayName}</strong> is an unshipped software foundation. {FOOTER_DISCLAIMER}
        </p>
        <p>{copy("footer.localOnly")}</p>
      </footer>

      {paletteOpen && (
        <CommandPalette
          registry={registry}
          binding={bind("command-search", copy("palette.searchLabel"), "Search destinations and settings")}
          preferences={effective}
          onPreferenceChange={updatePreferences}
          onNavigate={teleport}
          onClose={closePalette}
          emoji={emoji ? "🗂️" : null}
          copy={copy}
        />
      )}

      {notificationsOpen && (
        <NotificationsCentre
          api={notifications}
          binding={bind("notification-search", copy("notifications.searchLabel"), "Search titles and bodies")}
          onClose={() => setNotificationsOpen(false)}
          onExport={runExport}
          emoji={emoji ? "🔔" : null}
          copy={copy}
        />
      )}

      {historyOpen && (
        <HistoryPanel
          api={history}
          binding={bind("history-search", copy("history.searchLabel"), "Search summaries and actions")}
          onClose={() => setHistoryOpen(false)}
          onExport={runExport}
          onNotify={notifyPair}
          emoji={emoji ? "🧾" : null}
          copy={copy}
        />
      )}

      {appearanceTarget !== null && (
        <div
          className="dialog-scrim"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAppearanceTarget(null);
          }}
        >
          <div className="command-palette" role="dialog" aria-modal="true" aria-label={`Appearance: ${appearanceLabel(appearanceTarget)}`}>
            <AppearanceEditor
              elementId={appearanceTarget}
              store={appearance}
              onChange={updateAppearance}
              onClose={() => setAppearanceTarget(null)}
              onNotify={notifyPair}
              isLocked={(elementId, property) => locksApi.blocked(elementId, property)}
              propertySearch={bind("appearance-property-search", "Search appearance properties", "Search properties")}
              colourSearch={bind("appearance-colour-search", "Filter colour spaces", "Search colour spaces")}
            />
          </div>
        </div>
      )}

      <div className="toast-region" aria-live="polite" aria-label="Notifications">
        {notifications.toasts
          .filter((item) => item.kind !== "error")
          .map((item) => (
            <Toast
              key={item.id}
              item={item}
              emoji={emoji ? "🔔" : null}
              onDismiss={() => notifications.dismissToast(item.id)}
              onArrive={() => {
                if (narrationEnabled) narration.read(item.title, item.title, "notification");
              }}
            />
          ))}
      </div>
      <div className="toast-region errors" role="alert" aria-live="assertive" aria-label="Errors">
        {notifications.toasts
          .filter((item) => item.kind === "error")
          .map((item) => (
            <Toast
              key={item.id}
              item={item}
              emoji={emoji ? "⚠️" : null}
              onDismiss={() => notifications.dismissToast(item.id)}
              onArrive={() => {
                if (narrationEnabled) narration.read(item.title, item.title, "notification");
              }}
            />
          ))}
      </div>
    </div>
  );
}

function Toast({
  item,
  emoji,
  onDismiss,
  onArrive,
}: {
  item: Notification;
  emoji: string | null;
  onDismiss: () => void;
  onArrive: () => void;
}): ReactNode {
  useEffect(() => {
    onArrive();
    // Announced once, when this notice first appears.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <article className="toast" data-kind={item.kind}>
      <div>
        <strong>
          {emoji && (
            <span aria-hidden="true" className="decorative-emoji">
              {emoji}
            </span>
          )}
          {item.title}
        </strong>
        <button type="button" aria-label={`Dismiss ${item.title}`} onClick={onDismiss}>
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <p>{item.body}</p>
      {item.persistent && <small>This notice stays until you dismiss it.</small>}
    </article>
  );
}

export default SiteApp;

/** Re-exported so the tab list can be read without importing the module twice. */
export { SITE_TABS };
