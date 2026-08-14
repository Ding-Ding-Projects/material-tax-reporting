'use strict';

/**
 * The copy bundle.
 *
 * Every user-facing string lives here as five humour variants per language.
 * The English and Cantonese humour levels are independent, and a separate
 * non-semantic emoji toggle only ever decorates a dialog heading.
 *
 * The rule the product depends on is that humour changes tone and never
 * changes a fact. Strings that carry a field name, a numeric limit, a
 * validation rule or the mail-in-only boundary are declared with `fixed`, so
 * all five variants are literally the same text and no level can alter them.
 */

import { formatBilingual, resolveCopy } from '@material-tax-reporting/surface-kernel';

/** One string, identical at every humour level. */
function fixed(en, zh) {
  return { en: [en, en, en, en, en], zh: [zh, zh, zh, zh, zh] };
}

/** Five English and five Cantonese variants, plain first and playful last. */
function tone(en, zh) {
  return { en, zh };
}

export const COPY = {
  'app.name': fixed('Material Tax Reporting', 'Material Tax Reporting'),
  'app.tagline': tone(
    ['Private, local, and guided', 'Private, local, and guided', 'Private and local, one step at a time', 'Private, local, and friendly', 'Private, local, and happy to help'],
    ['私密、本機、一步步嚟', '私密、本機、一步步嚟', '私密本機，慢慢嚟', '私密本機，輕鬆啲', '私密本機，包你唔亂'],
  ),
  'welcome.heading': tone(
    ['Prepare one tax report without guessing what comes next',
      'Prepare one tax report without guessing what comes next',
      'Prepare one tax report, one clear question at a time',
      'Prepare one tax report without any guesswork',
      'Prepare one tax report, and let the app do the remembering'],
    ['一份報稅報告，唔使估下一步做乜',
      '一份報稅報告，唔使估下一步做乜',
      '一份報稅報告，一條題一條題咁行',
      '一份報稅報告，唔使亂估',
      '一份報稅報告，記嘢交畀我哋'],
  ),
  'welcome.boundary': fixed(
    'This desktop application asks one plain-language question at a time. It prepares information for a CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing.',
    '呢個桌面應用一次問一條淺白問題。佢只係為 CRA mail-in PDF 文件包準備資料。佢並冇提供 NETFILE、EFILE、電子提交、直接傳送去 CRA，或者自動報稅。',
  ),
  'review.boundary': fixed(
    'No electronic submission: this application does not offer NETFILE, EFILE, direct CRA transmission, or automatic filing.',
    '冇電子提交：呢個應用唔提供 NETFILE、EFILE、直接傳送去 CRA，或者自動報稅。',
  ),

  'nav.wizard': tone(
    ['Guided report', 'Guided report', 'Guided report', 'Guided report', 'Guided report, step by step'],
    ['引導報告', '引導報告', '引導報告', '引導報告', '一步步引導報告'],
  ),
  'nav.history': fixed('History', '歷史紀錄'),
  'nav.project': fixed('Project file', '專案檔案'),
  'nav.settings': fixed('Settings', '設定'),
  'nav.appearance': fixed('Appearance', '外觀'),
  'nav.documentation': fixed('Documentation', '說明文件'),
  'nav.changelog': fixed('Changelog', '更新紀錄'),
  'nav.notifications': fixed('Notifications', '通知'),
  'nav.converter': fixed('Converter', '檔案轉換'),
  'nav.models': fixed('Local models', '本機模型'),
  'nav.support': fixed('Support tickets', '支援記事'),

  'toast.saved': tone(
    ['Project saved', 'Project saved', 'Project saved', 'Project saved, nice one', 'Project saved, all tidy'],
    ['專案已儲存', '專案已儲存', '專案已儲存', '專案儲好咗，掂', '專案儲好晒，好整齊'],
  ),
  'toast.attachment': tone(
    ['Attachment encrypted', 'Attachment encrypted', 'Attachment encrypted', 'Attachment encrypted and tucked away', 'Attachment encrypted and safely tucked away'],
    ['附件已加密', '附件已加密', '附件已加密', '附件加密收好咗', '附件加密收好晒，安心'],
  ),
  'toast.reviewSaved': tone(
    ['Review acknowledgement saved', 'Review acknowledgement saved', 'Review acknowledgement saved', 'Review acknowledgement saved', 'Review acknowledgement saved, one less thing'],
    ['覆核確認已儲存', '覆核確認已儲存', '覆核確認已儲存', '覆核確認已儲存', '覆核確認儲咗，少件事'],
  ),
  'toast.settingsSaved': tone(
    ['Setting saved', 'Setting saved', 'Setting saved', 'Setting saved', 'Setting saved, looking good'],
    ['設定已儲存', '設定已儲存', '設定已儲存', '設定已儲存', '設定儲咗，靚仔'],
  ),
  'toast.nothingFiled': fixed(
    'Nothing was filed or transmitted.',
    '冇任何嘢被提交或者傳送出去。',
  ),

  'settings.heading': tone(
    ['Settings', 'Settings', 'Settings', 'Settings and personal touches', 'Settings, make it yours'],
    ['設定', '設定', '設定', '設定同個人化', '設定，整返個啱你嘅'],
  ),
  'settings.language': fixed('Language mode', '語言模式'),
  'settings.englishFunny': fixed('English humour level (1 to 5)', '英文玩味程度（1 至 5）'),
  'settings.cantoneseFunny': fixed('Cantonese humour level (1 to 5)', '廣東話玩味程度（1 至 5）'),
  'settings.dialogEmoji': fixed('Show a decorative emoji on dialog headings', '對話框標題顯示裝飾表情符號'),
  'settings.humourNote': fixed(
    'Humour changes tone only. Field names, validation rules, numeric limits and the mail-in-only boundary are identical at every level.',
    '玩味程度只係改語氣。欄位名稱、驗證規則、數字上限同 mail-in 專用界線，喺每個程度都完全一樣。',
  ),

  'wizard.progressLabel': fixed('Step {current} of {total}', '第 {current} 步，共 {total} 步'),
  'wizard.previous': fixed('Previous', '上一步'),
  'wizard.next': fixed('Save answer and continue', '儲存答案並繼續'),
  'wizard.finish': fixed('Confirm review and save', '確認覆核並儲存'),
  'wizard.what': fixed('What', '做乜'),
  'wizard.why': fixed('Why', '點解'),
  'wizard.where': fixed('Where to look', '去邊度搵'),
  'wizard.example': fixed('Example', '例子'),
  'wizard.validation': fixed('Validation', '驗證'),
  'wizard.nextStep': fixed('Next step', '下一步'),
  'wizard.readMore': fixed('Open the article for this step', '打開呢一步嘅說明文章'),
};

/** The wizard question catalogue, moved out of the renderer's inline literals. */
export const STEP_COPY = [
  {
    id: 'profile-full-name',
    article: { area: 'desktop', slug: 'guided-report-wizard' },
    title: tone(
      ['What is your legal name for this return?', 'What is your legal name for this return?', 'What legal name belongs on this return?', 'What legal name should we put on this return?', 'Whose name goes on this return? Yours, in full'],
      ['呢份報稅表要用邊個法定姓名？', '呢份報稅表要用邊個法定姓名？', '報稅表上面應該用邊個法定姓名？', '我哋喺報稅表寫邊個法定姓名好？', '報稅表寫邊個名？寫返你個全名'],
    ),
    what: fixed('Enter the name that should appear on the tax forms.', '輸入應該印喺報稅表格上面嘅姓名。'),
    why: fixed('The paper return must match the identity information CRA uses for you.', '紙本報稅表必須同 CRA 手上嘅身份資料一致。'),
    where: fixed('Use the name on your CRA correspondence or identity records.', '用你 CRA 信件或者身份文件上面嘅姓名。'),
    example: fixed('Example format: given name, optional middle name, family name.', '格式例子：名、可選中間名、姓。'),
    validation: fixed('A name is required and is limited to 200 characters.', '必須填姓名，上限 200 個字元。'),
    next: fixed('Next, you will enter the Social Insurance Number used on the return.', '跟住你會輸入報稅表用嘅 Social Insurance Number。'),
  },
  {
    id: 'profile-sin',
    article: { area: 'desktop', slug: 'guided-report-wizard' },
    title: tone(
      ['What Social Insurance Number belongs on this return?', 'What Social Insurance Number belongs on this return?', 'Which Social Insurance Number belongs on this return?', 'Which Social Insurance Number should this return carry?', 'Which Social Insurance Number goes here? Nine digits, no peeking needed'],
      ['呢份報稅表要用邊個 Social Insurance Number？', '呢份報稅表要用邊個 Social Insurance Number？', '報稅表上面應該用邊個 Social Insurance Number？', '呢份報稅表要帶邊個 Social Insurance Number？', '呢度填邊個 Social Insurance Number？九個位，慢慢入'],
    ),
    what: fixed('Enter all 9 digits. Spaces and hyphens are accepted while typing.', '輸入全部 9 個數字。打字期間可以有空格或者連字號。'),
    why: fixed('CRA uses this identifier to associate the paper return with the taxpayer.', 'CRA 用呢個識別碼將紙本報稅表同納稅人配對。'),
    where: fixed('Use your own trusted records. Do not copy it into support messages or notes.', '用你自己可信嘅紀錄。唔好抄入支援訊息或者備註度。'),
    example: fixed('Example format: three groups of three digits. No example number is prefilled.', '格式例子：三組、每組三個數字。唔會預先填任何示例號碼。'),
    validation: fixed('The saved value must contain exactly 9 digits.', '儲存嘅數值必須啱啱好 9 個數字。'),
    next: fixed('Next, you will provide the date of birth used on the return.', '跟住你會提供報稅表用嘅出生日期。'),
  },
  {
    id: 'profile-date-of-birth',
    article: { area: 'desktop', slug: 'guided-report-wizard' },
    title: tone(
      ['What date of birth belongs on this return?', 'What date of birth belongs on this return?', 'Which date of birth belongs on this return?', 'Which date of birth should this return carry?', 'Which date of birth goes here? The real one, please'],
      ['呢份報稅表要用邊個出生日期？', '呢份報稅表要用邊個出生日期？', '報稅表上面應該用邊個出生日期？', '呢份報稅表要帶邊個出生日期？', '呢度填邊個出生日期？填返真嗰個'],
    ),
    what: fixed('Choose the taxpayer date of birth.', '揀納稅人嘅出生日期。'),
    why: fixed('The return identity section needs the same date CRA has on record.', '報稅表身份部分要同 CRA 紀錄嘅日期一致。'),
    where: fixed('Use a trusted identity record.', '用可信嘅身份文件。'),
    example: fixed('The control stores the complete date as YYYY-MM-DD.', '控制項會以 YYYY-MM-DD 儲存完整日期。'),
    validation: fixed('A complete date is required.', '必須填完整日期。'),
    next: fixed('Next, you will confirm the province used for this Ontario-focused report.', '跟住你會確認呢份以 Ontario 為主嘅報告所用嘅省份。'),
  },
  {
    id: 'residency-province',
    article: { area: 'desktop', slug: 'guided-report-wizard' },
    title: tone(
      ['Is Ontario the province used for this report?', 'Is Ontario the province used for this report?', 'Is Ontario the province for this report?', 'Are we using Ontario for this report?', 'Ontario for this report? Say the word'],
      ['呢份報告係咪用 Ontario 做省份？', '呢份報告係咪用 Ontario 做省份？', '呢份報告嘅省份係咪 Ontario？', '我哋係咪用緊 Ontario 做呢份報告？', '呢份報告用 Ontario？講聲我聽'],
    ),
    what: fixed('Confirm that this project is for an Ontario personal return.', '確認呢個專案係做 Ontario 個人報稅表。'),
    why: fixed('The current rule sources and calculation package are scoped to Canada and Ontario.', '目前嘅規則來源同計算套件只覆蓋 Canada 同 Ontario。'),
    where: fixed('Use the province of residence rule that applies on December 31 of the tax year.', '用課稅年度 12 月 31 日適用嘅居住省份規則。'),
    example: fixed('This release supports Ontario only and will not guess another province.', '呢個版本只支援 Ontario，唔會估其他省份。'),
    validation: fixed('Choose Ontario to continue. For another province, keep the project unchanged.', '揀 Ontario 先可以繼續。如果係其他省份，請保持專案唔變。'),
    next: fixed('Next, you will enter the address used for the paper return.', '跟住你會輸入紙本報稅表用嘅地址。'),
  },
  {
    id: 'residency-address',
    article: { area: 'desktop', slug: 'guided-report-wizard' },
    title: tone(
      ['What mailing address should appear on the return?', 'What mailing address should appear on the return?', 'Which mailing address belongs on the return?', 'Which mailing address should the return show?', 'Which mailing address goes on the return? The one that gets your post'],
      ['報稅表要顯示邊個郵寄地址？', '報稅表要顯示邊個郵寄地址？', '報稅表上面應該用邊個郵寄地址？', '報稅表要展示邊個郵寄地址？', '報稅表寫邊個郵寄地址？收到信嗰個'],
    ),
    what: fixed('Enter the complete address CRA should use for correspondence.', '輸入 CRA 用嚟通訊嘅完整地址。'),
    why: fixed('A paper return needs a reviewable mailing address and contact destination.', '紙本報稅表需要一個可覆核嘅郵寄地址同聯絡目的地。'),
    where: fixed('Use the address that applies under the tax-year return instructions.', '用課稅年度報稅表指引適用嘅地址。'),
    example: fixed('Include unit, street, city, province, and postal code as applicable.', '按需要包括單位、街道、城市、省份同郵政編碼。'),
    validation: fixed('An address is required and is limited to 500 characters.', '必須填地址，上限 500 個字元。'),
    next: fixed('Next, you will confirm that you gathered the income documents for this report.', '跟住你會確認已經收齊呢份報告嘅收入文件。'),
  },
  {
    id: 'income-reviewed',
    article: { area: 'desktop', slug: 'guided-report-wizard' },
    title: tone(
      ['Have you gathered and reviewed the income documents for this report?', 'Have you gathered and reviewed the income documents for this report?', 'Have you collected and checked the income documents for this report?', 'Have you gathered and checked every income document for this report?', 'Got every income document for this report, and had a proper look?'],
      ['你係咪已經收齊同睇過呢份報告嘅收入文件？', '你係咪已經收齊同睇過呢份報告嘅收入文件？', '呢份報告嘅收入文件，你收齊同核對咗未？', '呢份報告嘅收入文件，你係咪逐份收齊同睇咗？', '呢份報告嘅收入文件收齊晒，又睇真咗未？'],
    ),
    what: fixed('Confirm only after checking the slips, statements, and other income records you expect.', '睇齊你預期嘅單據、結單同其他收入紀錄之後先確認。'),
    why: fixed('Missing income documents can make a prepared paper return incomplete.', '欠收入文件會令準備好嘅紙本報稅表唔完整。'),
    where: fixed('Check the original documents and your own records; this application does not contact CRA.', '核對原始文件同你自己嘅紀錄；呢個應用唔會聯絡 CRA。'),
    example: fixed('If a document is still expected, leave this unchecked and return later.', '如果仲等緊文件，唔好剔，遲啲再返嚟。'),
    validation: fixed('The confirmation must be checked before moving forward.', '要剔咗呢個確認先可以繼續。'),
    next: fixed('Next, you can attach local documents for encrypted storage and manual parser confirmation.', '跟住你可以附加本機文件，做加密儲存同人手解析確認。'),
  },
  {
    id: 'attachments',
    article: { area: 'desktop', slug: 'encrypted-project-files' },
    title: tone(
      ['Which local documents belong with this project?', 'Which local documents belong with this project?', 'Which local documents should sit with this project?', 'Which local documents should travel with this project?', 'Which local documents come along for the ride?'],
      ['邊啲本機文件應該跟住呢個專案？', '邊啲本機文件應該跟住呢個專案？', '邊啲本機文件要放埋喺呢個專案度？', '邊啲本機文件要同呢個專案一齊行？', '邊啲本機文件一齊上路？'],
    ),
    what: fixed('Add only the documents needed for this report. Each file is encrypted before it enters app-private storage.', '只加呢份報告需要嘅文件。每個檔案入應用私有儲存之前都會加密。'),
    why: fixed('Keeping source documents with the report makes later review and correction traceable.', '將原始文件同報告放埋一齊，之後覆核同更正會有跡可尋。'),
    where: fixed('Choose files from your computer. Nothing is uploaded or transmitted.', '喺你部電腦揀檔案。冇任何嘢會上傳或者傳送出去。'),
    example: fixed('Add a slip or receipt, then confirm parsed values only after comparing them with the source.', '加一張單據或者收據，同原件對比之後先確認解析出嚟嘅數值。'),
    validation: fixed('Every attached document must receive manual parser confirmation before continuing.', '每份附加文件都要人手解析確認先可以繼續。'),
    next: fixed('Next, you can record deduction notes without pretending the note is a calculated claim.', '跟住你可以記低扣減備註，唔會當呢啲備註係計算好嘅申報。'),
  },
  {
    id: 'deductions-notes',
    article: { area: 'desktop', slug: 'guided-report-wizard' },
    title: tone(
      ['Are there deduction or credit notes to preserve for manual review?', 'Are there deduction or credit notes to preserve for manual review?', 'Any deduction or credit notes worth keeping for manual review?', 'Any deduction or credit notes you want kept for manual review?', 'Any deduction or credit notes to keep for later? Write them here'],
      ['有冇扣減或者抵免嘅備註要留返做人手覆核？', '有冇扣減或者抵免嘅備註要留返做人手覆核？', '有冇扣減或者抵免備註值得留低做人手覆核？', '有冇扣減或者抵免備註想留低做人手覆核？', '有冇扣減或者抵免備註要留返？喺呢度寫低'],
    ),
    what: fixed('Record concise reminders about evidence or questions that still need review.', '簡短記低仲要覆核嘅證據或者問題。'),
    why: fixed('A note keeps uncertainty visible instead of turning it into a guessed tax value.', '備註令未確定嘅嘢保持可見，而唔係變成估出嚟嘅稅務數值。'),
    where: fixed('Use your own records and the official sources recorded with this tax year.', '用你自己嘅紀錄同今個課稅年度記錄嘅官方來源。'),
    example: fixed('Describe what needs checking; do not treat the note as a completed calculation.', '寫低要查乜；唔好當呢個備註係做好咗嘅計算。'),
    validation: fixed('This optional note is limited to 4,000 characters.', '呢個選填備註上限 4,000 個字元。'),
    next: fixed('Next, you will record the mailing destination that must be checked before printing.', '跟住你會記低列印之前要核對嘅郵寄目的地。'),
  },
  {
    id: 'delivery-mailing-destination',
    article: { area: 'desktop', slug: 'guided-report-wizard' },
    title: tone(
      ['Which CRA mailing destination will you verify for this paper return?', 'Which CRA mailing destination will you verify for this paper return?', 'Which CRA mailing destination will you check for this paper return?', 'Which CRA mailing destination are you going to verify for this paper return?', 'Which CRA mailing destination will you double-check before it goes in the post?'],
      ['呢份紙本報稅表，你會核實邊個 CRA 郵寄目的地？', '呢份紙本報稅表，你會核實邊個 CRA 郵寄目的地？', '呢份紙本報稅表，你會查邊個 CRA 郵寄目的地？', '你會為呢份紙本報稅表核實邊個 CRA 郵寄目的地？', '寄出之前，你會再三核對邊個 CRA 郵寄目的地？'],
    ),
    what: fixed('Record the destination you intend to check against the current official return instructions.', '記低你打算對照現行官方報稅指引核實嘅目的地。'),
    why: fixed('Mailing destinations can depend on location and can change. The app must not silently guess one.', '郵寄目的地會因地區而異，亦會變。應用唔可以靜靜雞估一個。'),
    where: fixed('Use the official CRA source recorded for this project and verify it again before mailing.', '用呢個專案記錄嘅官方 CRA 來源，寄之前再核實多次。'),
    example: fixed('Record the destination and the reason it applies; do not rely on an old envelope.', '記低目的地同適用原因；唔好靠一個舊信封。'),
    validation: fixed('A reviewable destination note is required and is limited to 500 characters.', '必須填一個可覆核嘅目的地備註，上限 500 個字元。'),
    next: fixed('Finally, you will complete the mandatory manual PDF review checklist.', '最後，你會完成必須嘅人手 PDF 覆核清單。'),
  },
  {
    id: 'manual-review',
    article: { area: 'pdf', slug: 'manual-review' },
    title: tone(
      ['Have you manually reviewed every part of the mail-in PDF package?', 'Have you manually reviewed every part of the mail-in PDF package?', 'Have you gone through every part of the mail-in PDF package by hand?', 'Have you checked every part of the mail-in PDF package yourself?', 'Been through every part of the mail-in PDF package with your own eyes?'],
      ['你係咪已經人手覆核咗 mail-in PDF 文件包嘅每一部分？', '你係咪已經人手覆核咗 mail-in PDF 文件包嘅每一部分？', 'mail-in PDF 文件包每一部分，你係咪逐項人手睇過？', 'mail-in PDF 文件包每一部分，你係咪自己核對過？', 'mail-in PDF 文件包每一部分，你親眼睇晒未？'],
    ),
    what: fixed('Review every populated form, calculation, attachment, mailing destination, and signature field.', '覆核每張已填表格、每項計算、每份附件、郵寄目的地同簽名欄。'),
    why: fixed('This explicit review is mandatory before a paper package can be treated as ready to print.', '紙本文件包當作可以列印之前，呢個明確覆核係必須嘅。'),
    where: fixed('Compare the generated PDF with the source records and current official instructions.', '將產生嘅 PDF 同原始紀錄以及現行官方指引比對。'),
    example: fixed('Check each item separately. A single unchecked item means review is incomplete.', '每項分開核對。得一項冇剔，覆核就未完成。'),
    validation: fixed('All five acknowledgements are required. This never submits or files the return.', '五項確認全部必須完成。呢個永遠唔會提交或者申報張報稅表。'),
    next: fixed('When complete, save the project and use the separately provided mail-in PDF preparation path.', '完成之後，儲存專案，再用另外提供嘅 mail-in PDF 準備流程。'),
  },
];

export const REVIEW_LABELS = [
  { key: 'forms', copy: fixed('Every populated form matches the intended report data.', '每張已填表格都同預期嘅報告資料一致。') },
  { key: 'calculations', copy: fixed('Every calculation was manually checked.', '每項計算都經人手核對。') },
  { key: 'attachments', copy: fixed('Every attachment belongs to this report and is legible.', '每份附件都屬於呢份報告，而且清晰可讀。') },
  { key: 'mailingDestination', copy: fixed('The mailing destination was checked against current official instructions.', '郵寄目的地已對照現行官方指引核對。') },
  { key: 'signatureFields', copy: fixed('Every required signature and date field was identified for signing.', '每個必須嘅簽名同日期欄都已標示出嚟等簽署。') },
];

const DIALOG_EMOJI = {
  confirm: '🙂',
  danger: '⚠️',
  info: 'ℹ️',
  success: '✅',
};

/**
 * Builds a resolver bound to the current preferences. Passing an inline bundle
 * lets a step or a review label be resolved with the same rules as the shared
 * bundle without registering a global key.
 */
export function createResolver(preferences) {
  const mode = preferences.language;
  const en = preferences.englishFunny;
  const zh = preferences.cantoneseFunny;
  const resolveVariants = (variants) => {
    if (!variants) return '';
    return resolveCopy({ value: variants }, 'value', mode, en, zh);
  };
  const resolveKey = (key, replacements) => {
    let text = resolveCopy(COPY, key, mode, en, zh);
    for (const [name, value] of Object.entries(replacements || {})) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
    return text;
  };
  return {
    mode,
    t: resolveKey,
    variants: resolveVariants,
    bilingual: formatBilingual,
    /** A decorative, non-semantic emoji for a dialog heading only. */
    dialogEmoji: (kind) => (preferences.dialogEmoji ? `${DIALOG_EMOJI[kind] || DIALOG_EMOJI.info} ` : ''),
  };
}
