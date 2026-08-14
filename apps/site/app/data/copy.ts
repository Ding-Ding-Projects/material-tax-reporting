/**
 * Every user-facing string this site renders.
 *
 * Each key exists five times per language, one per humour level. The rule the
 * product depends on is that humour changes tone and never changes a fact:
 * product limits, official names, links, counts, dates and action labels are
 * byte-identical across all five variants. `same()` is used wherever a string
 * carries a fact, so the invariant holds by construction; `tone()` is used only
 * where nothing factual is present.
 *
 * `apps/site/src/checks/copy-facts.check.ts` runs the kernel's
 * `assertFactsInvariant` over this bundle and fails when a variant disagrees.
 *
 * This site ships no personal vocabulary of its own. `SITE_IMMUTABLE_SPANS`
 * lists the exact substrings a reader's own vocabulary file may never rewrite.
 */

import type { CopyBundle, CopyVariants } from "@material-tax-reporting/surface-kernel";

function same(en: string, zh: string): { en: CopyVariants; zh: CopyVariants } {
  return { en: [en, en, en, en, en], zh: [zh, zh, zh, zh, zh] };
}

function tone(en: CopyVariants, zh: CopyVariants): { en: CopyVariants; zh: CopyVariants } {
  return { en, zh };
}

/**
 * The boundary sentence, the disclaimer and the official reference wording are
 * rendered from these constants so the same exact text can also be handed to
 * the vocabulary substitution pass as an immutable span.
 */
export const BOUNDARY_SENTENCE =
  "The product will not implement NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.";

export const DISCLAIMER_SENTENCE =
  "This site provides product documentation, not tax, legal, accounting, or financial advice. It does not claim CRA certification or approval.";

export const FOOTER_DISCLAIMER =
  "This documentation is not tax, legal, accounting, or financial advice.";

export type OfficialReference = {
  href: string;
  text: string;
  note: string;
};

/** Official references, reproduced as link text and address only. */
export const OFFICIAL_REFERENCES: readonly OfficialReference[] = [
  {
    href: "https://www.canada.ca/en/services/taxes/income-tax/personal-income-tax/how-file/paper.html",
    text: "File an income tax return on paper",
    note: "Current paper-filing guidance.",
  },
  {
    href: "https://www.canada.ca/en/revenue-agency/corporate/contact-information/where-mail-your-paper-t1-return.html",
    text: "Where to mail a paper T1 return",
    note: "Current mailing-destination guidance.",
  },
  {
    href: "https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package.html",
    text: "General income tax and benefit packages",
    note: "Current and prior-year federal packages.",
  },
  {
    href: "https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario/5006-pc.html",
    text: "Ontario information guide and forms",
    note: "Official Ontario package entry.",
  },
];

/**
 * Exact substrings a personal vocabulary file may never rewrite: official
 * reference wording and addresses, the paper-only boundary, and the two
 * disclaimers.
 */
export const SITE_IMMUTABLE_SPANS: readonly string[] = [
  ...OFFICIAL_REFERENCES.flatMap((reference) => [reference.href, reference.text]),
  BOUNDARY_SENTENCE,
  DISCLAIMER_SENTENCE,
  FOOTER_DISCLAIMER,
  "NETFILE",
  "EFILE",
  "Canada Revenue Agency",
  "CRA",
  "Ontario",
  "T1",
];

/** The shipped product name, used when no display name has been chosen. */
export const SHIPPED_PRODUCT_NAME = "Material Tax Reporting";

export const COPY: CopyBundle = {
  // ---------------------------------------------------------------- shell --
  "brand.tagline": tone(
    [
      "Paper-return planning documentation",
      "Paper-return planning documentation",
      "Planning notes for a paper return",
      "Planning notes for a paper return, kept tidy",
      "Planning notes for a paper return, kept tidy and calm",
    ],
    [
      "紙本報稅規劃文件",
      "紙本報稅規劃文件",
      "紙本報稅嘅規劃筆記",
      "紙本報稅嘅規劃筆記，整理得好齊",
      "紙本報稅嘅規劃筆記，整理得齊齊整整",
    ],
  ),
  "shell.commands": same("Commands", "指令"),
  "shell.statusChip": same("Foundation only", "只係基礎"),
  "shell.skipToContent": same("Skip to content", "跳至內容"),

  // ----------------------------------------------------------------- home --
  "home.eyebrow": same("Canada and Ontario · planned paper workflow", "加拿大及安省 · 規劃中嘅紙本流程"),
  "home.title": tone(
    [
      "Prepare carefully. Review every detail. Mail only when you are satisfied.",
      "Prepare carefully, review every detail, and mail only when you are satisfied.",
      "Take it slowly, check every detail, and mail only when you are happy with it.",
      "Go slowly, squint at every detail, and mail only when you are genuinely happy.",
      "Paperwork rewards patience: read it twice, then mail it once.",
    ],
    [
      "小心準備，逐項覆核；確認滿意先郵寄。",
      "小心準備，逐項覆核，滿意咗先好寄。",
      "慢慢嚟，逐項望清楚，覺得妥當先好寄出去。",
      "唔使急，每一格都望真啲，真係滿意先好寄。",
      "報稅嘅嘢，睇兩次好過寄兩次。",
    ],
  ),
  "home.lede": tone(
    [
      "This is a foundation for a future local-first desktop application that may generate a CRA mail-in package as a PDF. No working application or tax output exists today.",
      "This is the foundation for a future local-first desktop application that may generate a CRA mail-in package as a PDF. No working application or tax output exists today.",
      "Think of this as groundwork for a future local-first desktop application that may generate a CRA mail-in package as a PDF. No working application or tax output exists today.",
      "This is groundwork, not a product: a future local-first desktop application may generate a CRA mail-in package as a PDF. No working application or tax output exists today.",
      "This is scaffolding with good intentions. A future local-first desktop application may generate a CRA mail-in package as a PDF. No working application or tax output exists today.",
    ],
    [
      "呢度係未來本機優先桌面應用程式嘅基礎，將來或者可以整一份寄畀 CRA 嘅 mail-in PDF 套件。現時未有可用應用程式或稅務輸出。",
      "呢度係未來本機優先桌面應用程式嘅基礎，將來或者可以整一份寄畀 CRA 嘅 mail-in PDF 套件。現時未有可用應用程式或稅務輸出。",
      "當呢度係打底：未來本機優先桌面應用程式或者可以整一份寄畀 CRA 嘅 mail-in PDF 套件。現時未有可用應用程式或稅務輸出。",
      "呢度只係打底，未係成品：未來本機優先桌面應用程式或者可以整一份寄畀 CRA 嘅 mail-in PDF 套件。現時未有可用應用程式或稅務輸出。",
      "呢度係有心機嘅地基。未來本機優先桌面應用程式或者可以整一份寄畀 CRA 嘅 mail-in PDF 套件。現時未有可用應用程式或稅務輸出。",
    ],
  ),
  "home.readWorkflow": same("Read the planned workflow", "閱讀規劃流程"),
  "home.openSources": same("Open official sources", "開啟官方資料"),
  "home.boundaryEyebrow": same("Non-negotiable boundary", "不可更改嘅界線"),
  "home.boundaryTitle": same("Paper package only", "只限紙本套件"),
  "home.boundaryBody": same(BOUNDARY_SENTENCE, BOUNDARY_SENTENCE),
  "home.statusLabel": same("Current project status", "目前專案狀態"),
  "home.shippedApplications": same("Shipped applications", "已發佈應用程式"),
  "home.shippedApplicationsNote": same(
    "The repository is a software foundation.",
    "呢個程式碼庫只係軟件基礎。",
  ),
  "home.availableInstallers": same("Published release assets", "已發佈嘅發行檔案"),
  "home.availableInstallersNote": same(
    "The release manifest on this site lists no asset.",
    "本網站嘅發行清單未有任何檔案。",
  ),
  "home.reviewAreas": same("Manual review areas", "人手覆核範圍"),
  "home.reviewAreasNote": same(
    "Forms, calculations, attachments, destination, and signatures.",
    "表格、計算、附件、寄送地址同簽名。",
  ),

  // ------------------------------------------------------------- workflow --
  "workflow.eyebrow": same("Planned behaviour, not shipped functionality", "規劃中嘅行為，唔係已發佈功能"),
  "workflow.title": same("Paper-only workflow", "紙本限定流程"),
  "workflow.lede": tone(
    [
      "A deliberate sequence with a mandatory human review pause before any future export or print action.",
      "A deliberate sequence, with a mandatory human review pause before any future export or print action.",
      "A deliberate sequence, and a mandatory human review pause before any future export or print action.",
      "A deliberate sequence with one unavoidable pause: a human review before any future export or print action.",
      "A deliberate sequence with one unavoidable pause. A person reads it before any future export or print action, and that pause never gets skipped.",
    ],
    [
      "一個刻意安排嘅次序，喺任何未來匯出或列印之前，必須有人手覆核。",
      "一個刻意安排嘅次序，喺任何未來匯出或列印之前，都要有人手覆核。",
      "步驟係特登排好嘅，任何未來匯出或列印之前，都要有人手覆核。",
      "步驟特登排好，中間有一個唔可以省略嘅停頓：任何未來匯出或列印之前，都要有人手覆核。",
      "步驟特登排好，中間有一個唔可以省略嘅停頓。任何未來匯出或列印之前，都要有人親自睇過。",
    ],
  ),
  "workflow.reviewEyebrow": same("Required before future export or print", "未來匯出或列印之前必須完成"),
  "workflow.reviewTitle": same("Manual-review acknowledgement", "人手覆核確認"),
  "workflow.reviewBody": same(
    "This documentation does not perform the review. It records the exact areas a future application must require.",
    "呢份文件唔會代你覆核。佢只係記低未來應用程式必須要求嘅覆核範圍。",
  ),

  // ---------------------------------------------------------------- scope --
  "scope.eyebrow": same("Official sources remain authoritative", "官方資料為準"),
  "scope.title": same("Canada and Ontario scope", "加拿大及安省範圍"),
  "scope.lede": same(DISCLAIMER_SENTENCE, DISCLAIMER_SENTENCE),
  "scope.federalTitle": same("Federal T1 paper return", "聯邦 T1 紙本報稅表"),
  "scope.federalBody": same(
    "The planned application scope begins with an individual Canadian income tax and benefit return prepared for paper mailing.",
    "規劃中嘅應用程式範圍，由個人加拿大入息稅及福利申報表開始，準備以紙本郵寄。",
  ),
  "scope.ontarioTitle": same("Ontario forms", "安省表格"),
  "scope.ontarioBody": same(
    "Ontario provincial forms may be included when relevant. The official Ontario package remains the source for current forms.",
    "相關嘅安省省級表格可能會包括在內。現行表格仍然以官方 Ontario 套件為準。",
  ),
  "scope.linksEyebrow": same(
    "Current guidance without copied addresses or figures",
    "只提供現行指引，唔會抄錄地址或數字",
  ),
  "scope.linksTitle": same("Official CRA references", "CRA 官方參考資料"),

  // ----------------------------------------------------------------- docs --
  "docs.eyebrow": same("Public product documentation", "公開產品文件"),
  "docs.title": same("Documentation", "文件"),
  "docs.lede": tone(
    [
      "Read the tracked documentation offline. Every article is bundled with the site at build time.",
      "Read the tracked documentation offline. Every article is bundled with the site at build time.",
      "Read the tracked documentation offline; every article travels with the site at build time.",
      "Read the tracked documentation offline. Every article rides along with the site at build time.",
      "Read the tracked documentation offline. Every article packs its own suitcase at build time.",
    ],
    [
      "可以離線閱讀已追蹤嘅文件。所有文章喺建置時一齊打包入網站。",
      "可以離線閱讀已追蹤嘅文件。所有文章喺建置時一齊打包入網站。",
      "可以離線閱讀已追蹤嘅文件；所有文章喺建置時同網站一齊打包。",
      "可以離線閱讀已追蹤嘅文件。所有文章喺建置時同網站一齊上路。",
      "可以離線閱讀已追蹤嘅文件。所有文章喺建置時自己執好行李一齊走。",
    ],
  ),
  "docs.searchLabel": same("Search documentation", "搜尋文件"),
  "docs.searchPlaceholder": same("Search titles, headings, and body text", "搜尋標題、章節同內文"),
  "docs.areaFilterLabel": same("Filter documentation areas", "篩選文件範圍"),
  "docs.topicFilterLabel": same("Filter documentation topics", "篩選文件主題"),
  "docs.readingPaneLabel": same("Article", "文章"),
  "docs.emptyTitle": same("No matching article", "無相符文章"),
  "docs.emptyBody": same(
    "Change the plain-text query or correct the regular expression.",
    "請修改純文字查詢，或者更正正規表達式。",
  ),
  "docs.featureLibraryTitle": same("Feature library", "功能總覽"),
  "docs.featureLibraryLede": same(
    "Each capability on this site, with its documentation and its current state as recorded in the tracked verification-status article.",
    "本網站每項功能，連同對應文件同已追蹤驗證狀態文章所記錄嘅現時狀態。",
  ),

  // ------------------------------------------------------------- settings --
  "settings.eyebrow": same("Stored only in local browser storage", "只儲存喺本機瀏覽器"),
  "settings.title": same("Settings and personalization", "設定及個人化"),
  "settings.lede": tone(
    [
      "These controls change this documentation surface. They do not alter tax data or product output.",
      "These controls change this documentation surface. They do not alter tax data or product output.",
      "These controls change how this documentation looks. They do not alter tax data or product output.",
      "These controls change how this documentation looks and reads. They do not alter tax data or product output.",
      "Rearrange the furniture as much as you like. These controls do not alter tax data or product output.",
    ],
    [
      "呢啲控制項只會改變呢個文件介面，唔會改動稅務資料或產品輸出。",
      "呢啲控制項只會改變呢個文件介面，唔會改動稅務資料或產品輸出。",
      "呢啲控制項只係改文件嘅外觀，唔會改動稅務資料或產品輸出。",
      "呢啲控制項只係改文件嘅外觀同語氣，唔會改動稅務資料或產品輸出。",
      "想點擺就點擺。呢啲控制項唔會改動稅務資料或產品輸出。",
    ],
  ),
  "settings.searchLabel": same("Search settings", "搜尋設定"),
  "settings.reset": same("Reset personalization", "重設個人化"),
  "settings.emptyTitle": same("No matching setting", "無相符設定"),

  // ------------------------------------------------------- setting titles --
  "setting.theme.title": same("Theme", "主題"),
  "setting.theme.body": same(
    "Choose light, dark, or the browser and operating system preference.",
    "揀淺色、深色，或者跟瀏覽器同作業系統嘅設定。",
  ),
  "setting.dock.title": same("Tab docking", "分頁停靠"),
  "setting.dock.body": same(
    "Dock the persistent tab strip to any edge. Narrow layouts temporarily use the top edge.",
    "可以將常駐分頁列停靠喺任何一邊。窄版面會暫時用上邊。",
  ),
  "setting.density.title": same("Density", "密度"),
  "setting.density.body": same(
    "Adjust spacing while preserving readable targets and focus.",
    "調整間距，同時保持可讀嘅點擊範圍同焦點。",
  ),
  "setting.accent.title": same("Accent colour", "強調色"),
  "setting.accent.body": same(
    "Choose the primary colour used for active navigation and controls.",
    "揀作用中導覽同控制項嘅主要顏色。",
  ),
  "setting.fontScale.title": same("Font scale", "字型比例"),
  "setting.fontScale.body": same(
    "Scale site typography without changing the layout rules.",
    "調整網站字型比例，唔會改變版面規則。",
  ),
  "setting.motion.title": same("Motion", "動態效果"),
  "setting.motion.body": same(
    "Follow the system preference, reduce motion, or allow full site motion.",
    "跟系統設定、減少動態效果，或者容許完整動態效果。",
  ),
  "setting.language.title": same("Language mode", "語言模式"),
  "setting.language.body": same(
    "Choose English, playful Hong Kong-style Cantonese, or a compact bilingual mode.",
    "揀英文、輕鬆嘅香港式廣東話，或者精簡雙語模式。",
  ),
  "setting.funny.title": same("Humour levels", "幽默程度"),
  "setting.funny.body": same(
    "Voice changes around the facts. Product limits, official names, dates, amounts, and action labels never change.",
    "只係語氣有變，事實唔變。產品限制、官方名稱、日期、金額同操作名稱都唔會改。",
  ),
  "setting.emoji.title": same("Decorative dialog emoji", "對話框裝飾表情符號"),
  "setting.emoji.body": same(
    "Show a decorative emoji in toast, notification and command-palette headings. It is hidden from assistive technology and never carries meaning.",
    "喺通知、通知紀錄同指令面板標題顯示裝飾表情符號。輔助技術會略過佢，佢亦都唔帶任何意思。",
  ),
  "setting.vocabulary.title": same("Local personal vocabulary", "本機個人詞彙"),
  "setting.vocabulary.body": same(
    "Load a private JSON file without sending it anywhere. No mappings, examples, or private defaults are built into this site.",
    "載入你自己嘅 JSON 檔案，唔會傳去任何地方。本網站唔會內建任何對照、例子或者私人預設。",
  ),
  "setting.identity.title": same("Display name and mark", "顯示名稱同標誌"),
  "setting.identity.body": same(
    "Change the name and mark shown in this browser. The shared page title is not changed, so a personalized name never travels in a link.",
    "改變呢個瀏覽器顯示嘅名稱同標誌。共用嘅頁面標題唔會改，所以個人化名稱唔會經連結流出去。",
  ),
  "setting.narration.title": same("Read aloud", "朗讀"),
  "setting.narration.body": same(
    "Use the voices this browser reports. Narration starts only when you press a read control, never on load.",
    "使用呢個瀏覽器報告嘅語音。只有你㩒朗讀掣先會開始，載入時唔會自動讀。",
  ),
  "setting.schedule.title": same("Scheduled presentation", "定時外觀"),
  "setting.schedule.body": same(
    "Change presentation settings during a time window. A rule is an overlay: turning it off restores the stored value exactly.",
    "喺指定時段改變外觀設定。規則只係覆蓋層：關咗之後會原樣還原已儲存嘅設定。",
  ),
  "setting.external.title": same("External presentation settings", "外部外觀設定"),
  "setting.external.body": same(
    "Off by default. When enabled, one allowlisted https address may supply presentation values only.",
    "預設關閉。啟用之後，只可以由一個允許清單內嘅 https 位址提供外觀數值。",
  ),

  // ------------------------------------------------------- notifications --
  "notifications.title": same("Notifications", "通知"),
  "notifications.open": same("Open notifications", "開啟通知"),
  "notifications.emptyTitle": same("No notifications yet", "暫時未有通知"),
  "notifications.emptyBody": same(
    "Local confirmations, progress notices and errors appear here.",
    "本機確認、進度提示同錯誤會喺呢度出現。",
  ),
  "notifications.searchLabel": same("Search notifications", "搜尋通知"),

  // ------------------------------------------------------------- history --
  "history.title": same("Local history", "本機紀錄"),
  "history.lede": same(
    "Every personalization change is recorded in this browser. Restoring a recorded state writes a new entry and never rewrites an earlier one.",
    "每次個人化改動都會記錄喺呢個瀏覽器。還原某個狀態會寫入一條新紀錄，唔會改寫舊紀錄。",
  ),
  "history.searchLabel": same("Search history entries", "搜尋紀錄項目"),

  // ----------------------------------------------------------- changelog --
  "changelog.title": same("Changelog", "更新紀錄"),
  "changelog.lede": same(
    "Parsed from the tracked changelog files at build time, so this view cannot drift from the repository.",
    "喺建置時由已追蹤嘅更新紀錄檔案解析而成，所以呢個檢視唔會同程式碼庫脫節。",
  ),
  "changelog.searchLabel": same("Search changelog entries", "搜尋更新紀錄"),

  // ----------------------------------------------------------- downloads --
  "downloads.title": same("Downloads", "下載"),
  "downloads.unavailableTitle": same("Download unavailable", "暫未提供下載"),
  "downloads.unavailableBody": same(
    "There is no shipped application, installer, tax engine, PDF generator, documentation release, or software release. A download action appears only after a verified release asset is published in the release manifest.",
    "現時未有已發佈嘅應用程式、安裝程式、稅務計算引擎、PDF 產生器、文件發行或軟件發行。只有發行清單內出現已核實嘅發行檔案，先會有下載操作。",
  ),
  "downloads.unsignedNotice": same(
    "Any future asset is unsigned. This site makes no signature-authenticity claim about a file you transfer.",
    "將來嘅檔案都係未簽署。本網站唔會對你傳輸嘅檔案作出任何簽署真確性聲明。",
  ),

  // ------------------------------------------------------------ features --
  "converter.title": same("File converter", "檔案轉換"),
  "converter.lede": same(
    "Convert this site's own records between the formats listed below. It never accepts tax slips or return data.",
    "喺以下格式之間轉換本網站自己嘅紀錄。佢唔會接受稅務單據或申報資料。",
  ),
  "appearance.title": same("Appearance editor", "外觀編輯器"),
  "appearance.lede": same(
    "Restyle one registered element at a time. Overrides are scoped custom properties and cannot remove focus visibility or reduced motion.",
    "逐個已註冊元素調整外觀。覆蓋值只係範圍內嘅自訂屬性，唔可以移除焦點顯示或者減少動態效果嘅設定。",
  ),
  "locks.title": same("Element locks", "元素鎖定"),
  "tickets.title": same("Support notes", "支援筆記"),
  "tickets.lede": same(
    "Notes stay in this browser and are never transmitted. Content that looks like an identifier, an amount or a file path is removed before a note is saved.",
    "筆記只留喺呢個瀏覽器，唔會傳送出去。似識別碼、金額或者檔案路徑嘅內容，儲存之前會被移除。",
  ),
  "authenticator.title": same("Authenticator utility", "驗證碼工具"),
  "authenticator.lede": same(
    "A standards utility for an authenticator application you already use. It is bound to no account here, it grants access to nothing, and it performs no network access.",
    "呢個係符合標準嘅工具，畀你已經喺用嘅驗證器應用程式。佢喺呢度唔綁定任何帳戶、唔會授予任何存取權，亦都唔會連網。",
  ),
  "assistant.title": same("Local model runtime", "本機模型執行環境"),
  "assistant.lede": same(
    "This page can only report what a browser probe observed about a loopback runtime on this computer. A page served over https is subject to browser private-network and cross-origin rules.",
    "呢一頁只可以報告瀏覽器探測到嘅本機 loopback 執行環境狀況。經 https 載入嘅頁面會受瀏覽器私有網絡同跨來源規則限制。",
  ),

  // -------------------------------------------------------------- palette --
  "palette.eyebrow": same("Keyboard command palette", "鍵盤指令面板"),
  "palette.title": same("Go to a destination or change a setting", "前往目的地或者改設定"),
  "palette.searchLabel": same("Search commands", "搜尋指令"),
  "palette.empty": same("No matching command.", "無相符指令。"),

  // --------------------------------------------------------------- shared --
  "action.close": same("Close", "關閉"),
  "action.cancel": same("Cancel", "取消"),
  "action.confirm": same("Confirm", "確認"),
  "action.export": same("Export", "匯出"),
  "action.selectAllVisible": same("Select all visible", "全選目前顯示"),
  "action.readSection": same("Read this section aloud", "朗讀呢一節"),
  "action.stopReading": same("Stop reading", "停止朗讀"),
  "footer.disclaimer": same(FOOTER_DISCLAIMER, FOOTER_DISCLAIMER),
  "footer.localOnly": same("Site preferences remain local to this browser.", "網站設定只留喺呢個瀏覽器。"),
};

/** Humour-level descriptions shown beside the two level controls. */
export const ENGLISH_TONE_NOTES: readonly string[] = [
  "Direct, factual wording.",
  "A little lighter, with every fact intact.",
  "Friendly wording, still precise.",
  "Playful around the edges; the rules stay exact.",
  "Paperwork can wear a party hat, but it still needs every signature.",
];

export const CANTONESE_TONE_NOTES: readonly string[] = [
  "直接、清楚、照足事實。",
  "輕鬆少少，資料照樣準確。",
  "親切啲，但每個步驟都講清楚。",
  "有少少玩味，重要資料一粒都唔會走。",
  "文件可以有啲氣氛，但簽名同覆核一樣唔少得。",
];

/** The seven planned workflow steps. Wording is factual and does not vary. */
export const WORKFLOW_STEPS: readonly { number: string; title: string; body: string }[] = [
  {
    number: "1",
    title: "Collect records locally",
    body: "Future inputs must stay local by default and clearly identify their source and tax year.",
  },
  {
    number: "2",
    title: "Prepare Canada and Ontario forms",
    body: "The planned scope is a federal T1 return with relevant Ontario forms, driven by cited official rules.",
  },
  {
    number: "3",
    title: "Build the paper package",
    body: "Any future output is limited to a CRA mail-in package as a PDF. It is not a submission.",
  },
  {
    number: "4",
    title: "Inspect every populated form",
    body: "Review each field against the source records and current official form instructions.",
  },
  {
    number: "5",
    title: "Verify calculations and attachments",
    body: "Check every calculation and confirm that every required attachment is present.",
  },
  {
    number: "6",
    title: "Confirm destination and signatures",
    body: "Use current official CRA guidance for the mailing destination and inspect every signature field.",
  },
  {
    number: "7",
    title: "Acknowledge review",
    body: "The future export or print action remains unavailable until the user explicitly acknowledges completing every review area.",
  },
];

export const REVIEW_AREAS: readonly string[] = [
  "Every populated form",
  "Every calculation",
  "Every attachment",
  "The current mailing destination",
  "Every signature field",
];
