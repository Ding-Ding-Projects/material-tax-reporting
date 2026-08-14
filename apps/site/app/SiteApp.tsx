"use client";

import {
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type TabId = "home" | "workflow" | "scope" | "docs" | "settings";
type Dock = "left" | "top" | "right" | "bottom";
type Theme = "system" | "light" | "dark";
type Density = "comfortable" | "compact";
type MotionChoice = "system" | "reduce" | "full";
type LanguageMode = "en" | "zh" | "both";

type Preferences = {
  dock: Dock;
  theme: Theme;
  density: Density;
  accent: string;
  fontScale: number;
  motion: MotionChoice;
  language: LanguageMode;
  englishFunny: number;
  cantoneseFunny: number;
};

type SearchState = {
  query: string;
  regex: boolean;
  pattern: string;
  flags: string;
  sample: string;
  builderOpen: boolean;
};

type NotificationItem = {
  id: number;
  title: string;
  body: string;
  createdAt: string;
};

const STORAGE_KEY = "material-tax-reporting.site.preferences.v1";
const VOCABULARY_KEY = "material-tax-reporting.site.vocabulary.v1";
const MAX_PATTERN_LENGTH = 256;
const MAX_SAMPLE_LENGTH = 2000;

const defaultPreferences: Preferences = {
  dock: "left",
  theme: "system",
  density: "comfortable",
  accent: "#4355b9",
  fontScale: 1,
  motion: "system",
  language: "en",
  englishFunny: 1,
  cantoneseFunny: 3,
};

const emptySearch = (): SearchState => ({
  query: "",
  regex: false,
  pattern: "",
  flags: "i",
  sample: "",
  builderOpen: false,
});

const tabs: Array<{ id: TabId; en: string; zh: string; short: string }> = [
  { id: "home", en: "Home", zh: "首頁", short: "H" },
  {
    id: "workflow",
    en: "Paper-only workflow",
    zh: "紙本流程",
    short: "P",
  },
  {
    id: "scope",
    en: "Canada/Ontario scope",
    zh: "加拿大／安省範圍",
    short: "C",
  },
  { id: "docs", en: "Documentation", zh: "文件", short: "D" },
  { id: "settings", en: "Settings", zh: "設定", short: "S" },
];

const documentationArticles = [
  {
    id: "paper-boundary",
    title: "Paper-only product boundary",
    summary:
      "The planned product ends with generation of a CRA mail-in PDF package. It will not submit a return electronically or file automatically.",
    topics: ["paper", "PDF", "scope", "filing"],
  },
  {
    id: "manual-review",
    title: "Mandatory manual review",
    summary:
      "Before any future export or print action, the user must inspect every populated form, calculation, attachment, mailing destination, and signature field, then acknowledge that review.",
    topics: ["review", "forms", "calculations", "signatures"],
  },
  {
    id: "jurisdiction",
    title: "Canada and Ontario coverage",
    summary:
      "The documented planning scope is an individual federal T1 return with Ontario forms. Official CRA sources remain authoritative for current packages and paper-filing instructions.",
    topics: ["Canada", "Ontario", "T1", "CRA"],
  },
  {
    id: "privacy",
    title: "Local-first privacy direction",
    summary:
      "This documentation describes local-only browser preferences. No taxpayer workflow exists on this site, and this site does not collect tax records.",
    topics: ["privacy", "local", "browser", "taxpayer data"],
  },
  {
    id: "availability",
    title: "Current availability",
    summary:
      "There is currently no shipped application, installer, tax engine, PDF generator, documentation release, or software release.",
    topics: ["installer", "release", "availability", "status"],
  },
  {
    id: "unavailable-features",
    title: "Broader feature inventory",
    summary:
      "Automatic filing, submission services, accounts, payments, cloud tax storage, a tax engine, PDF generation, and downloadable software are unavailable. The controls on this site personalize documentation only.",
    topics: ["unavailable", "features", "controls", "documentation"],
  },
];

const commandItems: Array<{
  label: string;
  detail: string;
  tab: TabId;
  target?: string;
}> = [
  { label: "Open Home", detail: "Project status and boundaries", tab: "home" },
  {
    label: "Open paper-only workflow",
    detail: "Required review sequence",
    tab: "workflow",
  },
  {
    label: "Open Canada/Ontario scope",
    detail: "Official source links",
    tab: "scope",
  },
  {
    label: "Search documentation",
    detail: "Find an article",
    tab: "docs",
    target: "documentation-search",
  },
  {
    label: "Change theme",
    detail: "Open the theme setting",
    tab: "settings",
    target: "theme-setting",
  },
  {
    label: "Change tab docking",
    detail: "Open the docking setting",
    tab: "settings",
    target: "dock-setting",
  },
  {
    label: "Load personal vocabulary",
    detail: "Open the local JSON control",
    tab: "settings",
    target: "vocabulary-setting",
  },
  {
    label: "Change language mode",
    detail: "Open language settings",
    tab: "settings",
    target: "language-setting",
  },
];

function safeStoredPreferences(): Preferences {
  if (typeof window === "undefined") return defaultPreferences;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPreferences;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return { ...defaultPreferences, ...parsed };
  } catch {
    return defaultPreferences;
  }
}

function safeStoredVocabulary(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(VOCABULARY_KEY) ?? "{}",
    ) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([key, value]) =>
          typeof key === "string" && typeof value === "string" && key.length > 0,
      ),
    );
  } catch {
    return {};
  }
}

function contrastText(hex: string) {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((index) =>
    Number.parseInt(value.slice(index, index + 2), 16),
  );
  const luminance =
    (0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]) /
    255;
  return luminance > 0.57 ? "#111318" : "#ffffff";
}

function useNarrowLayout() {
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

function matchesSearch(value: string, state: SearchState) {
  if (!state.query && !state.pattern) return true;
  if (!state.regex) {
    return value.toLocaleLowerCase().includes(state.query.toLocaleLowerCase());
  }
  if (!state.pattern || state.pattern.length > MAX_PATTERN_LENGTH) return false;
  try {
    return new RegExp(state.pattern, state.flags.replaceAll("g", "")).test(value);
  } catch {
    return false;
  }
}

function regexAnalysis(state: SearchState) {
  if (!state.pattern) return { feedback: "Enter a pattern to inspect it.", matches: [] };
  if (state.pattern.length > MAX_PATTERN_LENGTH) {
    return {
      feedback: `Pattern exceeds ${MAX_PATTERN_LENGTH} characters.`,
      matches: [],
    };
  }
  if (state.sample.length > MAX_SAMPLE_LENGTH) {
    return {
      feedback: `Sample exceeds ${MAX_SAMPLE_LENGTH} characters.`,
      matches: [],
    };
  }
  try {
    const flags = state.flags.includes("g") ? state.flags : `${state.flags}g`;
    const expression = new RegExp(state.pattern, flags);
    const matches: Array<{ value: string; index: number; groups: string[] }> = [];
    let found: RegExpExecArray | null;
    while ((found = expression.exec(state.sample)) && matches.length < 50) {
      matches.push({
        value: found[0],
        index: found.index,
        groups: found.slice(1),
      });
      if (found[0] === "") expression.lastIndex += 1;
    }
    return {
      feedback: `${matches.length} local match${matches.length === 1 ? "" : "es"}.`,
      matches,
    };
  } catch (error) {
    return {
      feedback: error instanceof Error ? error.message : "Invalid regular expression.",
      matches: [],
    };
  }
}

function SearchWithBuilder({
  id,
  label,
  placeholder,
  state,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  state: SearchState;
  onChange: (state: SearchState) => void;
}) {
  const analysis = useMemo(() => regexAnalysis(state), [state]);
  const insert = (token: string) => {
    const pattern = `${state.pattern}${token}`.slice(0, MAX_PATTERN_LENGTH);
    onChange({ ...state, pattern, regex: true });
  };

  return (
    <div className="search-builder" id={id}>
      <label className="field-label" htmlFor={`${id}-input`}>
        {label}
      </label>
      <div className="search-row">
        <input
          id={`${id}-input`}
          type="search"
          value={state.regex ? state.pattern : state.query}
          placeholder={placeholder}
          maxLength={MAX_PATTERN_LENGTH}
          onChange={(event) =>
            onChange(
              state.regex
                ? { ...state, pattern: event.target.value }
                : { ...state, query: event.target.value },
            )
          }
        />
        <button
          className="icon-button"
          type="button"
          aria-expanded={state.builderOpen}
          aria-controls={`${id}-builder`}
          aria-label={`${label} regular expression builder`}
          onClick={() => onChange({ ...state, builderOpen: !state.builderOpen })}
        >
          <span aria-hidden="true">.*</span>
        </button>
      </div>
      <label className="inline-check">
        <input
          type="checkbox"
          checked={state.regex}
          onChange={(event) =>
            onChange({
              ...state,
              regex: event.target.checked,
              pattern: event.target.checked
                ? state.pattern || state.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                : state.pattern,
            })
          }
        />
        Use regular expression
      </label>
      {state.builderOpen && (
        <section
          className="regex-panel"
          id={`${id}-builder`}
          aria-label={`${label} regular expression builder`}
        >
          <div className="regex-heading">
            <div>
              <p className="eyebrow">ECMAScript regular expressions</p>
              <h3>Build and test locally</h3>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => onChange({ ...state, builderOpen: false })}
            >
              Close
            </button>
          </div>
          <div className="regex-fields">
            <label>
              Raw pattern
              <input
                type="text"
                value={state.pattern}
                maxLength={MAX_PATTERN_LENGTH}
                onChange={(event) =>
                  onChange({ ...state, pattern: event.target.value, regex: true })
                }
              />
            </label>
            <label>
              Flags
              <input
                type="text"
                value={state.flags}
                maxLength={4}
                aria-describedby={`${id}-flags-help`}
                onChange={(event) =>
                  onChange({
                    ...state,
                    flags: event.target.value.replace(/[^dgimsuvy]/g, ""),
                  })
                }
              />
              <small id={`${id}-flags-help`}>Supported by this browser; “i” ignores case.</small>
            </label>
          </div>
          <div className="token-tray" aria-label="Guided pattern inserts">
            <button type="button" onClick={() => insert("literal")}>Literal</button>
            <button type="button" onClick={() => insert("[A-Za-z]")}>Character class</button>
            <button type="button" onClick={() => insert("^")}>Start anchor</button>
            <button type="button" onClick={() => insert("$")}>End anchor</button>
            <button type="button" onClick={() => insert("(group)")}>Group</button>
            <button type="button" onClick={() => insert("|")}>Alternation</button>
            <button type="button" onClick={() => insert("+")}>One or more</button>
            <button type="button" onClick={() => insert("{1,3}")}>Range</button>
          </div>
          <label>
            Bounded sample text
            <textarea
              value={state.sample}
              maxLength={MAX_SAMPLE_LENGTH}
              onChange={(event) => onChange({ ...state, sample: event.target.value })}
              placeholder="Try the pattern against local text. Nothing is transmitted or saved."
            />
          </label>
          <p
            className={`syntax-feedback ${analysis.feedback.includes("Invalid") || analysis.feedback.includes("exceeds") ? "error" : ""}`}
            role="status"
          >
            {analysis.feedback}
          </p>
          {analysis.matches.length > 0 && (
            <ol className="match-list">
              {analysis.matches.slice(0, 8).map((match, index) => (
                <li key={`${match.index}-${index}`}>
                  <code>{match.value || "(zero-width match)"}</code> at {match.index}
                  {match.groups.length > 0 && (
                    <span> · captures: {match.groups.map((item) => item ?? "∅").join(", ")}</span>
                  )}
                </li>
              ))}
            </ol>
          )}
          <p className="privacy-note">
            Evaluation stays in this browser. Patterns and sample text are bounded and are not persisted.
          </p>
        </section>
      )}
    </div>
  );
}

function LocalizedLabel({
  en,
  zh,
  mode,
}: {
  en: string;
  zh: string;
  mode: LanguageMode;
}) {
  if (mode === "zh") return <>{zh}</>;
  if (mode === "both") {
    return (
      <>
        <span>{en}</span>
        <span className="secondary-language">{zh}</span>
      </>
    );
  }
  return <>{en}</>;
}

export function SiteApp() {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [vocabulary, setVocabulary] = useState<Record<string, string>>({});
  const [vocabularyStatus, setVocabularyStatus] = useState(
    "No personal vocabulary file is loaded.",
  );
  const [settingsSearch, setSettingsSearch] = useState<SearchState>(emptySearch);
  const [docsSearch, setDocsSearch] = useState<SearchState>(emptySearch);
  const [paletteSearch, setPaletteSearch] = useState<SearchState>(emptySearch);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [visibleNotifications, setVisibleNotifications] = useState<NotificationItem[]>([]);
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    home: null,
    workflow: null,
    scope: null,
    docs: null,
    settings: null,
  });
  const narrow = useNarrowLayout();

  useEffect(() => {
    setPreferences(safeStoredPreferences());
    const storedVocabulary = safeStoredVocabulary();
    setVocabulary(storedVocabulary);
    if (Object.keys(storedVocabulary).length > 0) {
      setVocabularyStatus(
        `${Object.keys(storedVocabulary).length} validated local replacement${Object.keys(storedVocabulary).length === 1 ? "" : "s"} loaded.`,
      );
    }
    setPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (preferencesLoaded) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    }
  }, [preferences, preferencesLoaded]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === "Escape" && paletteOpen) setPaletteOpen(false);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [paletteOpen]);

  const notify = useCallback((title: string, body: string) => {
    const item = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      title,
      body,
      createdAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setNotifications((current) => [item, ...current].slice(0, 40));
    setVisibleNotifications((current) => [...current, item]);
    window.setTimeout(() => {
      setVisibleNotifications((current) => current.filter(({ id }) => id !== item.id));
    }, 4800);
  }, []);

  const updatePreferences = <Key extends keyof Preferences>(
    key: Key,
    value: Preferences[Key],
  ) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  const effectiveDock: Dock = narrow ? "top" : preferences.dock;
  const horizontal = effectiveDock === "top" || effectiveDock === "bottom";
  const selectedTheme = preferences.theme;
  const style = {
    "--accent": preferences.accent,
    "--on-accent": contrastText(preferences.accent),
    "--font-scale": preferences.fontScale,
  } as CSSProperties;

  const personalized = (value: string) => vocabulary[value] ?? value;

  const modeCopy = (english: string, cantonese: string) => {
    if (preferences.language === "zh") return cantonese;
    if (preferences.language === "both") return `${english} / ${cantonese}`;
    return english;
  };

  const tabName = (tab: (typeof tabs)[number]) => {
    if (preferences.language === "zh") return tab.zh;
    if (preferences.language === "both") return `${tab.en} / ${tab.zh}`;
    return tab.en;
  };

  const onTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    current: number,
  ) => {
    const previousKey = horizontal ? "ArrowLeft" : "ArrowUp";
    const nextKey = horizontal ? "ArrowRight" : "ArrowDown";
    let nextIndex = current;
    if (event.key === previousKey) nextIndex = (current - 1 + tabs.length) % tabs.length;
    if (event.key === nextKey) nextIndex = (current + 1) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex !== current || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const nextTab = tabs[nextIndex].id;
      setActiveTab(nextTab);
      tabRefs.current[nextTab]?.focus();
    }
  };

  const activate = (tab: TabId, target?: string) => {
    setActiveTab(tab);
    setPaletteOpen(false);
    window.setTimeout(() => {
      const element = target
        ? document.getElementById(target)
        : tabRefs.current[tab];
      element?.focus();
      element?.scrollIntoView({ block: "center", behavior: "smooth" });
      element?.classList.add("teleport-highlight");
      window.setTimeout(() => element?.classList.remove("teleport-highlight"), 1400);
    }, 50);
  };

  const filteredDocs = documentationArticles.filter((article) =>
    matchesSearch(
      `${article.title} ${article.summary} ${article.topics.join(" ")}`,
      docsSearch,
    ),
  );
  const filteredCommands = commandItems.filter((command) =>
    matchesSearch(`${command.label} ${command.detail}`, paletteSearch),
  );

  const settingVisible = (text: string) => matchesSearch(text, settingsSearch);

  const onVocabularyFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 65_536) {
      setVocabularyStatus("File rejected: the 64 KB local limit was exceeded.");
      notify("Vocabulary not loaded", "Choose a JSON file no larger than 64 KB.");
      event.target.value = "";
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("The root must be an object.");
      }
      const record = parsed as Record<string, unknown>;
      if (
        Object.keys(record).some((key) => !["version", "replacements"].includes(key)) ||
        record.version !== 1 ||
        !record.replacements ||
        typeof record.replacements !== "object" ||
        Array.isArray(record.replacements)
      ) {
        throw new Error("Use version 1 with one replacements object and no other fields.");
      }
      const entries = Object.entries(record.replacements as Record<string, unknown>);
      if (entries.length > 200) throw new Error("At most 200 replacements are allowed.");
      const unsafeKeys = new Set(["__proto__", "prototype", "constructor"]);
      for (const [key, value] of entries) {
        if (
          unsafeKeys.has(key) ||
          key.length < 1 ||
          key.length > 80 ||
          typeof value !== "string" ||
          value.length > 200
        ) {
          throw new Error("Every replacement must use a safe 1–80 character key and a string value of at most 200 characters.");
        }
      }
      const replacements = Object.fromEntries(entries) as Record<string, string>;
      window.localStorage.setItem(VOCABULARY_KEY, JSON.stringify(replacements));
      setVocabulary(replacements);
      setVocabularyStatus(
        `${entries.length} validated local replacement${entries.length === 1 ? "" : "s"} loaded. The source filename was not retained.`,
      );
      notify("Personal vocabulary loaded", `${entries.length} local replacement${entries.length === 1 ? "" : "s"} are active.`);
    } catch (error) {
      setVocabularyStatus(
        `File rejected: ${error instanceof Error ? error.message : "invalid JSON"}`,
      );
      notify("Vocabulary not loaded", "The previous valid local vocabulary remains unchanged.");
    } finally {
      event.target.value = "";
    }
  };

  const clearVocabulary = () => {
    window.localStorage.removeItem(VOCABULARY_KEY);
    setVocabulary({});
    setVocabularyStatus("No personal vocabulary file is loaded.");
    notify("Personal vocabulary cleared", "Original site wording is active again.");
  };

  const resetPreferences = () => {
    setPreferences(defaultPreferences);
    notify("Personalization reset", "The site is using its shipped local defaults.");
  };

  const englishTone = [
    "Direct, factual wording.",
    "A little lighter, with every fact intact.",
    "Friendly wording, still precise.",
    "Playful around the edges; the rules stay exact.",
    "Paperwork can wear a party hat, but it still needs every signature.",
  ][preferences.englishFunny - 1];
  const cantoneseTone = [
    "直接、清楚、照足事實。",
    "輕鬆少少，資料照樣準確。",
    "親切啲，但每個步驟都講清楚。",
    "有少少玩味，重要資料一粒都唔會走。",
    "文件可以有啲氣氛，但簽名同覆核一樣唔少得。",
  ][preferences.cantoneseFunny - 1];

  return (
    <div
      className={`app-shell dock-${effectiveDock} density-${preferences.density} motion-${preferences.motion}`}
      data-theme={selectedTheme}
      style={style}
    >
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="top-bar">
        <div className="brand-mark" aria-hidden="true"><span /></div>
        <div className="brand-copy">
          <strong>{personalized("Material Tax Reporting")}</strong>
          <span>{modeCopy("Paper-return planning documentation", "紙本報稅規劃文件")}</span>
        </div>
        <div className="header-actions">
          <span className="status-chip"><span aria-hidden="true">●</span> Foundation only</span>
          <button type="button" className="tonal-button" onClick={() => setPaletteOpen(true)}>
            {modeCopy("Commands", "指令")} <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd>
          </button>
          <button type="button" className="icon-button history-button" aria-label="Open notification history" onClick={() => setHistoryOpen(true)}>
            <span aria-hidden="true">◴</span>
            {notifications.length > 0 && <span className="badge">{notifications.length}</span>}
          </button>
        </div>
      </header>

      <nav
        className="tab-rail"
        aria-label="Primary documentation"
        role="tablist"
        aria-orientation={horizontal ? "horizontal" : "vertical"}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => { tabRefs.current[tab.id] = element; }}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            <span className="tab-icon" aria-hidden="true">{tab.short}</span>
            <span className="tab-label">{personalized(tabName(tab))}</span>
          </button>
        ))}
      </nav>

      <main id="main-content" className="content-area" tabIndex={-1}>
        <section
          id="panel-home"
          role="tabpanel"
          aria-labelledby="tab-home"
          hidden={activeTab !== "home"}
        >
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Canada and Ontario · planned paper workflow</p>
              <h1>{modeCopy("Prepare carefully. Review every detail. Mail only when you are satisfied.", "小心準備，逐項覆核；確認滿意先郵寄。")}</h1>
              <p className="hero-lede">
                {modeCopy("Material Tax Reporting is a foundation for a future local-first desktop application that may generate a CRA mail-in PDF package. No working application or tax output exists today.", "Material Tax Reporting 目前只係未來本機優先桌面應用程式嘅基礎，計劃只可產生寄畀 CRA 嘅 PDF 套件。現時未有可用應用程式或稅務輸出。")}
              </p>
              <div className="hero-actions">
                <button type="button" className="filled-button" onClick={() => setActiveTab("workflow")}>{modeCopy("Read the planned workflow", "閱讀規劃流程")}</button>
                <button type="button" className="outlined-button" onClick={() => setActiveTab("scope")}>{modeCopy("Open official sources", "開啟官方資料")}</button>
              </div>
            </div>
            <aside className="boundary-card" aria-labelledby="boundary-title">
              <div className="boundary-graphic" aria-hidden="true">
                <span className="sheet sheet-back" />
                <span className="sheet sheet-front"><i /><i /><i /></span>
                <span className="review-stamp">REVIEW</span>
              </div>
              <p className="eyebrow">Non-negotiable boundary</p>
              <h2 id="boundary-title">{modeCopy("Paper package only", "只限紙本套件")}</h2>
              <p>
                The product will not implement NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.
              </p>
            </aside>
          </div>

          <div className="status-grid" aria-label="Current project status">
            <article><span className="metric">0</span><h2>Shipped applications</h2><p>The repository is a software foundation.</p></article>
            <article><span className="metric">0</span><h2>Available installers</h2><p>No verified immutable release asset exists.</p></article>
            <article><span className="metric">5</span><h2>Manual review areas</h2><p>Forms, calculations, attachments, destination, and signatures.</p></article>
          </div>

          <section className="installer-card" aria-labelledby="installer-title">
            <div>
              <p className="eyebrow">Installer availability</p>
              <h2 id="installer-title">{modeCopy("Download unavailable", "暫未提供下載")}</h2>
              <p>
                There is no shipped application, installer, tax engine, PDF generator, documentation release, or software release. A download action will appear only after a verified immutable release asset exists.
              </p>
            </div>
            <span className="unavailable-chip">Unavailable</span>
          </section>
        </section>

        <section id="panel-workflow" role="tabpanel" aria-labelledby="tab-workflow" hidden={activeTab !== "workflow"}>
          <div className="section-heading">
            <p className="eyebrow">Planned behavior, not shipped functionality</p>
            <h1>{modeCopy("Paper-only workflow", "紙本限定流程")}</h1>
            <p>A deliberate sequence with a mandatory human review pause before any future export or print action.</p>
          </div>
          <ol className="workflow-list">
            {[
              ["1", "Collect records locally", "Future inputs must stay local by default and clearly identify their source and tax year."],
              ["2", "Prepare Canada and Ontario forms", "The planned scope is a federal T1 return with relevant Ontario forms, driven by cited official rules."],
              ["3", "Build the paper package", "Any future output is limited to a CRA mail-in PDF package. It is not a submission."],
              ["4", "Inspect every populated form", "Review each field against the source records and current official form instructions."],
              ["5", "Verify calculations and attachments", "Check every calculation and confirm that every required attachment is present."],
              ["6", "Confirm destination and signatures", "Use current official CRA guidance for the mailing destination and inspect every signature field."],
              ["7", "Acknowledge review", "The future export or print action remains unavailable until the user explicitly acknowledges completing every review area."],
            ].map(([number, title, body]) => (
              <li key={number}>
                <span className="step-number">{number}</span>
                <div><h2>{title}</h2><p>{body}</p></div>
              </li>
            ))}
          </ol>
          <section className="review-panel" aria-labelledby="review-panel-title">
            <div>
              <p className="eyebrow">Required before future export or print</p>
              <h2 id="review-panel-title">{modeCopy("Manual-review acknowledgement", "人手覆核確認")}</h2>
              <p>This documentation does not perform the review. It records the exact areas a future application must require.</p>
            </div>
            <ul className="review-checks">
              {[
                "Every populated form",
                "Every calculation",
                "Every attachment",
                "The current mailing destination",
                "Every signature field",
              ].map((item) => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}
            </ul>
          </section>
        </section>

        <section id="panel-scope" role="tabpanel" aria-labelledby="tab-scope" hidden={activeTab !== "scope"}>
          <div className="section-heading">
            <p className="eyebrow">Official sources remain authoritative</p>
            <h1>{modeCopy("Canada and Ontario scope", "加拿大及安省範圍")}</h1>
            <p>
              This site provides product documentation, not tax, legal, accounting, or financial advice. It does not claim CRA certification or approval.
            </p>
          </div>
          <div className="scope-grid">
            <article className="scope-card">
              <span className="scope-letter" aria-hidden="true">CA</span>
              <h2>Federal T1 paper return</h2>
              <p>The planned application scope begins with an individual Canadian income tax and benefit return prepared for paper mailing.</p>
            </article>
            <article className="scope-card">
              <span className="scope-letter" aria-hidden="true">ON</span>
              <h2>Ontario forms</h2>
              <p>Ontario provincial forms may be included when relevant. The official Ontario package remains the source for current forms.</p>
            </article>
          </div>
          <section className="official-links" aria-labelledby="official-links-title">
            <div>
              <p className="eyebrow">Current guidance without copied addresses or figures</p>
              <h2 id="official-links-title">{modeCopy("Official CRA references", "CRA 官方參考資料")}</h2>
            </div>
            <ul>
              <li><a href="https://www.canada.ca/en/services/taxes/income-tax/personal-income-tax/how-file/paper.html" target="_blank" rel="noreferrer">File an income tax return on paper <span aria-hidden="true">↗</span></a><p>Current paper-filing guidance.</p></li>
              <li><a href="https://www.canada.ca/en/revenue-agency/corporate/contact-information/where-mail-your-paper-t1-return.html" target="_blank" rel="noreferrer">Where to mail a paper T1 return <span aria-hidden="true">↗</span></a><p>Current mailing-destination guidance.</p></li>
              <li><a href="https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package.html" target="_blank" rel="noreferrer">General income tax and benefit packages <span aria-hidden="true">↗</span></a><p>Current and prior-year federal packages.</p></li>
              <li><a href="https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-pc.html" target="_blank" rel="noreferrer">Ontario information guide and forms <span aria-hidden="true">↗</span></a><p>Official Ontario package entry.</p></li>
            </ul>
          </section>
        </section>

        <section id="panel-docs" role="tabpanel" aria-labelledby="tab-docs" hidden={activeTab !== "docs"}>
          <div className="section-heading docs-heading">
            <div>
              <p className="eyebrow">Public product documentation</p>
              <h1>{modeCopy("Documentation", "文件")}</h1>
              <p>Search the current foundation, constraints, planned workflow, and unavailable capabilities.</p>
            </div>
            <span className="result-count" aria-live="polite">{filteredDocs.length} of {documentationArticles.length} articles</span>
          </div>
          <SearchWithBuilder id="documentation-search" label="Search documentation" placeholder="Search titles, summaries, and topics" state={docsSearch} onChange={setDocsSearch} />
          <div className="article-grid">
            {filteredDocs.map((article) => (
              <article key={article.id} id={article.id} className="article-card">
                <div className="article-top"><span className="article-index" aria-hidden="true">{String(documentationArticles.indexOf(article) + 1).padStart(2, "0")}</span><span className="status-chip">Documentation</span></div>
                <h2>{article.title}</h2>
                <p>{article.summary}</p>
                <div className="topic-row" aria-label="Topics">{article.topics.map((topic) => <span key={topic}>{topic}</span>)}</div>
              </article>
            ))}
          </div>
          {filteredDocs.length === 0 && <div className="empty-state"><h2>No matching article</h2><p>Change the plain-text query or correct the regular expression.</p></div>}
          <section className="feature-boundary" aria-labelledby="unavailable-title">
            <p className="eyebrow">Honest capability inventory</p>
            <h2 id="unavailable-title">Unavailable broader features</h2>
            <p>
              This site does not present placeholders as working product features. Accounts, electronic filing, submission services, payments, cloud tax storage, tax calculations, PDF generation, installers, automatic updates, file conversion, narration, authenticator management, scheduling, local Git history, and application appearance editing are not available. Site-only personalization, search, tab navigation, the command palette, and notification history work locally in this browser.
            </p>
          </section>
        </section>

        <section id="panel-settings" role="tabpanel" aria-labelledby="tab-settings" hidden={activeTab !== "settings"}>
          <div className="section-heading settings-heading">
            <div>
              <p className="eyebrow">Stored only in local browser storage</p>
              <h1>{modeCopy("Settings and personalization", "設定及個人化")}</h1>
              <p>These controls change this documentation surface. They do not alter tax data or product output.</p>
            </div>
            <button type="button" className="outlined-button" onClick={resetPreferences}>Reset personalization</button>
          </div>
          <SearchWithBuilder id="settings-search" label="Search settings" placeholder="Search setting names and values" state={settingsSearch} onChange={setSettingsSearch} />
          <div className="settings-grid">
            {settingVisible("theme light dark system appearance") && (
              <section className="setting-card" id="theme-setting" tabIndex={-1}>
                <div><h2>Theme</h2><p>Choose light, dark, or the browser and operating system preference.</p></div>
                <select aria-label="Theme" value={preferences.theme} onChange={(event) => updatePreferences("theme", event.target.value as Theme)}>
                  <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
                </select>
                <small>Current source: local preference; shipped value is System.</small>
              </section>
            )}
            {settingVisible("tab docking left top right bottom navigation") && (
              <section className="setting-card" id="dock-setting" tabIndex={-1}>
                <div><h2>Tab docking</h2><p>Dock the persistent tab strip to any edge. Narrow layouts temporarily use the top edge.</p></div>
                <div className="segmented" role="group" aria-label="Tab docking edge">
                  {(["left", "top", "right", "bottom"] as Dock[]).map((dock) => <button type="button" key={dock} aria-pressed={preferences.dock === dock} onClick={() => updatePreferences("dock", dock)}>{dock[0].toUpperCase() + dock.slice(1)}</button>)}
                </div>
                <small>Current source: local preference; shipped value is Left.</small>
              </section>
            )}
            {settingVisible("density compact comfortable spacing") && (
              <section className="setting-card">
                <div><h2>Density</h2><p>Adjust spacing while preserving readable targets and focus.</p></div>
                <div className="segmented" role="group" aria-label="Interface density">
                  {(["comfortable", "compact"] as Density[]).map((density) => <button type="button" key={density} aria-pressed={preferences.density === density} onClick={() => updatePreferences("density", density)}>{density[0].toUpperCase() + density.slice(1)}</button>)}
                </div>
                <small>Current source: local preference; shipped value is Comfortable.</small>
              </section>
            )}
            {settingVisible("accent color colour seed") && (
              <section className="setting-card">
                <div><h2>Accent color</h2><p>Choose the primary color used for active navigation and controls.</p></div>
                <label className="color-control"><input type="color" value={preferences.accent} onChange={(event) => updatePreferences("accent", event.target.value)} /><span>{preferences.accent.toUpperCase()}</span></label>
                <small>Current source: local preference; shipped value is #4355B9.</small>
              </section>
            )}
            {settingVisible("font scale size typography") && (
              <section className="setting-card">
                <div><h2>Font scale</h2><p>Scale site typography from 90% to 120%.</p></div>
                <label className="range-control"><span>{Math.round(preferences.fontScale * 100)}%</span><input type="range" min="0.9" max="1.2" step="0.05" value={preferences.fontScale} onChange={(event) => updatePreferences("fontScale", Number(event.target.value))} /></label>
                <small>Current source: local preference; shipped value is 100%.</small>
              </section>
            )}
            {settingVisible("motion reduced system full animation") && (
              <section className="setting-card">
                <div><h2>Motion</h2><p>Follow the system preference, reduce motion, or allow full site motion.</p></div>
                <select aria-label="Motion preference" value={preferences.motion} onChange={(event) => updatePreferences("motion", event.target.value as MotionChoice)}><option value="system">System</option><option value="reduce">Reduce</option><option value="full">Full</option></select>
                <small>Current source: local preference; shipped value is System.</small>
              </section>
            )}
            {settingVisible("language English Cantonese bilingual") && (
              <section className="setting-card wide-setting" id="language-setting" tabIndex={-1}>
                <div><h2>Language mode</h2><p>Choose English, playful Hong Kong-style Cantonese, or a compact bilingual tab-label mode.</p></div>
                <div className="segmented" role="group" aria-label="Language mode">
                  {(["en", "zh", "both"] as LanguageMode[]).map((language) => <button type="button" key={language} aria-pressed={preferences.language === language} onClick={() => updatePreferences("language", language)}>{language === "en" ? "English" : language === "zh" ? "廣東話" : "Bilingual / 雙語"}</button>)}
                </div>
                <small>Current source: local preference; shipped value is English.</small>
              </section>
            )}
            {settingVisible("funny level English Cantonese playful serious") && (
              <section className="setting-card wide-setting funny-setting">
                <div><h2>Funny levels</h2><p>Voice changes around the facts. Product limits, official names, dates, amounts, and actions never change.</p></div>
                <div className="funny-grid">
                  <label>English: {preferences.englishFunny}<input type="range" min="1" max="5" step="1" value={preferences.englishFunny} onChange={(event) => updatePreferences("englishFunny", Number(event.target.value))} /><span>{englishTone}</span></label>
                  <label>廣東話: {preferences.cantoneseFunny}<input type="range" min="1" max="5" step="1" value={preferences.cantoneseFunny} onChange={(event) => updatePreferences("cantoneseFunny", Number(event.target.value))} /><span lang="zh-Hant">{cantoneseTone}</span></label>
                </div>
                <small>Current source: local preference; shipped values are English 1 and Cantonese 3.</small>
              </section>
            )}
            {settingVisible("personal vocabulary JSON upload local replace clear") && (
              <section className="setting-card wide-setting" id="vocabulary-setting" tabIndex={-1}>
                <div>
                  <h2>Local personal vocabulary</h2>
                  <p>Load a private JSON file without sending it anywhere. No mappings, examples, or private defaults are built into this site.</p>
                </div>
                <div className="upload-actions">
                  <label className="filled-button file-button">Choose JSON file<input type="file" accept="application/json,.json" onChange={onVocabularyFile} /></label>
                  <button type="button" className="outlined-button" onClick={clearVocabulary} disabled={Object.keys(vocabulary).length === 0}>Clear local vocabulary</button>
                </div>
                <p className="file-status" role="status">{vocabularyStatus}</p>
                <details><summary>Version 1 format and limits</summary><p>The root contains only <code>version: 1</code> and a <code>replacements</code> object. The file is limited to 64 KB, 200 string replacements, keys of 1–80 characters, and values of at most 200 characters. Unsafe object keys and unknown fields are rejected. The last valid local cache stays active after a rejected replacement file.</p></details>
                <small>The validated cache stays in this browser only. The source filename is not retained.</small>
              </section>
            )}
          </div>
          {!settingVisible("theme light dark system appearance tab docking left top right bottom navigation density compact comfortable spacing accent color colour seed font scale size typography motion reduced system full animation language English Cantonese bilingual funny level playful serious personal vocabulary JSON upload local replace clear") && <div className="empty-state"><h2>No matching setting</h2><p>Change the plain-text query or correct the regular expression.</p></div>}
        </section>
      </main>

      <footer className="site-footer">
        <p><strong>Material Tax Reporting</strong> is an unshipped software foundation. This documentation is not tax, legal, accounting, or financial advice.</p>
        <p>Site preferences remain local to this browser.</p>
      </footer>

      {paletteOpen && (
        <div className="dialog-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaletteOpen(false); }}>
          <section className="command-palette" role="dialog" aria-modal="true" aria-labelledby="palette-title">
            <div className="palette-heading"><div><p className="eyebrow">Keyboard command palette</p><h2 id="palette-title">Go directly to a destination</h2></div><button type="button" className="icon-button" aria-label="Close command palette" onClick={() => setPaletteOpen(false)}>×</button></div>
            <SearchWithBuilder id="command-search" label="Search commands" placeholder="Search destinations and settings" state={paletteSearch} onChange={setPaletteSearch} />
            <div className="command-list" role="list">
              {filteredCommands.map((command) => <button type="button" role="listitem" key={command.label} onClick={() => activate(command.tab, command.target)}><span><strong>{command.label}</strong><small>{command.detail}</small></span><span aria-hidden="true">↵</span></button>)}
              {filteredCommands.length === 0 && <p className="empty-command">No matching command.</p>}
            </div>
          </section>
        </div>
      )}

      {historyOpen && (
        <aside className="history-panel" role="dialog" aria-modal="true" aria-labelledby="history-title">
          <div className="palette-heading"><div><p className="eyebrow">Local activity</p><h2 id="history-title">Notification history</h2></div><button type="button" className="icon-button" aria-label="Close notification history" onClick={() => setHistoryOpen(false)}>×</button></div>
          {notifications.length === 0 ? <div className="empty-state"><h3>No notifications yet</h3><p>Local setting confirmations will appear here.</p></div> : <ol>{notifications.map((item) => <li key={item.id}><div><strong>{item.title}</strong><time>{item.createdAt}</time></div><p>{item.body}</p></li>)}</ol>}
        </aside>
      )}

      <div className="toast-region" aria-live="polite" aria-label="Notifications">
        {visibleNotifications.map((item) => <article className="toast" key={item.id}><div><strong>{item.title}</strong><button type="button" aria-label={`Dismiss ${item.title}`} onClick={() => setVisibleNotifications((current) => current.filter(({ id }) => id !== item.id))}>×</button></div><p>{item.body}</p></article>)}
      </div>
    </div>
  );
}
