import type {
  CraDocumentDefinition,
  CraDocumentId,
  MailingDestination,
  OfficialSourceCitation,
} from "../types.ts";

const CRA_TAX_PACKAGE_ROOT =
  "https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package";
const ONTARIO_PACKAGE_ROOT = `${CRA_TAX_PACKAGE_ROOT}/ontario`;
const PDF_ROOT = "https://www.canada.ca/content/dam/cra-arc/formspubs/pbg";

export const OFFICIAL_SOURCES_2025 = [
  {
    id: "cra-ontario-package-2025",
    title: "Ontario - 2025 Income tax package",
    url: `${ONTARIO_PACKAGE_ROOT}.html`,
    publisher: "Canada Revenue Agency",
    retrievedOn: "2026-08-14",
    supports: [
      "The 2025 Ontario package contains the federal return, ON428, and the listed federal and Ontario schedules.",
      "The package is selected based on residence in Ontario on December 31, 2025.",
    ],
  },
  {
    id: "cra-federal-guide-2025",
    title: "Federal Income Tax and Benefit Information for 2025",
    url: `${CRA_TAX_PACKAGE_ROOT}/5000-g.html`,
    publisher: "Canada Revenue Agency",
    retrievedOn: "2026-08-14",
    supports: [
      "Paper returns require applicable supporting documents, completed forms, and schedules.",
      "Tax records and supporting documents should be retained for six years.",
      "The guide identifies specialized forms that may be required for particular tax lines.",
    ],
  },
  {
    id: "cra-paper-filing",
    title: "Filing a paper tax return",
    url: "https://www.canada.ca/en/services/taxes/income-tax/personal-income-tax/how-file/paper.html",
    publisher: "Canada Revenue Agency",
    retrievedOn: "2026-08-14",
    supports: [
      "A paper return is sent to the CRA by mail.",
      "A separate envelope is used for each person.",
      "The taxpayer must determine the applicable tax centre before mailing.",
    ],
  },
  {
    id: "cra-paper-mailing-addresses",
    title: "Where to mail your paper T1 return",
    url: "https://www.canada.ca/en/revenue-agency/corporate/contact-information/where-mail-your-paper-t1-return.html",
    publisher: "Canada Revenue Agency",
    retrievedOn: "2026-08-14",
    supports: [
      "Current tax-centre mailing addresses for resident Ontario paper returns.",
      "Ontario mailing destinations depend on the listed Ontario area.",
    ],
  },
  {
    id: "cra-ontario-information-2025",
    title: "Ontario tax information for 2025",
    url: `${ONTARIO_PACKAGE_ROOT}/5006-pc.html`,
    publisher: "Canada Revenue Agency",
    retrievedOn: "2026-08-14",
    supports: [
      "ON428 calculates Ontario tax and credits after federal return steps 1 through 5.",
      "ON-BEN is attached to a 2025 return when applying for listed 2026 Ontario benefits.",
    ],
  },
  {
    id: "cra-additional-forms",
    title: "Other forms and publications you may need to complete your return",
    url: `${CRA_TAX_PACKAGE_ROOT}/other-forms-publications.html`,
    publisher: "Canada Revenue Agency",
    retrievedOn: "2026-08-14",
    supports: [
      "Specialized deductions, credits, and income types can require forms outside the standard package.",
      "Schedule 8 is used for applicable CPP calculations and Schedule 7 for registered plan activity.",
    ],
  },
  {
    id: "cra-t1135",
    title: "T1135 Foreign Income Verification Statement",
    url: "https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t1135.html",
    publisher: "Canada Revenue Agency",
    retrievedOn: "2026-08-14",
    supports: [
      "T1135 is a separate foreign-information reporting form.",
      "The current CRA page provides fillable and print versions with special PDF download instructions.",
    ],
  },
  {
    id: "cra-pdf-forms",
    title: "About CRA forms and publications",
    url: "https://www.canada.ca/en/revenue-agency/services/forms-publications/about-forms-publications.html",
    publisher: "Canada Revenue Agency",
    retrievedOn: "2026-08-14",
    supports: [
      "CRA fillable PDFs should be downloaded and opened with supported PDF software.",
      "The taxpayer must check the applicable form instructions and complete required signatures after printing.",
    ],
  },
  {
    id: "cra-due-dates-2025",
    title: "Due dates and payment dates",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/important-dates-individuals.html",
    publisher: "Canada Revenue Agency",
    retrievedOn: "2026-08-14",
    supports: ["Official filing and balance-payment dates for 2025 individual returns."],
  },
  {
    id: "cra-payment-options",
    title: "Payment options for personal income tax",
    url: "https://www.canada.ca/en/revenue-agency/services/payments/payments-cra/individual-payments/make-payment/payment-options-type-payment-you-are-making.html",
    publisher: "Canada Revenue Agency",
    retrievedOn: "2026-08-14",
    supports: ["Payment is a separate taxpayer action through CRA-supported channels."],
  },
  {
    id: "cra-refunds",
    title: "Tax refunds",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/refunds.html",
    publisher: "Canada Revenue Agency",
    retrievedOn: "2026-08-14",
    supports: ["Refund handling is performed by the CRA after it processes the return."],
  },
] as const satisfies readonly OfficialSourceCitation[];

interface FormSpec {
  readonly id: CraDocumentId;
  readonly formNumber: string;
  readonly title: string;
  readonly slug: string;
  readonly pdfStem: string;
  readonly province: CraDocumentDefinition["province"];
  readonly inclusion: CraDocumentDefinition["inclusion"];
  readonly inclusionFlag?: NonNullable<CraDocumentDefinition["inclusionFlag"]>;
  readonly outputMode?: CraDocumentDefinition["outputMode"];
  readonly notes?: readonly string[];
}

function document(spec: FormSpec): CraDocumentDefinition {
  const landingRoot = spec.province === "ON" ? ONTARIO_PACKAGE_ROOT : CRA_TAX_PACKAGE_ROOT;
  return {
    id: spec.id,
    formNumber: spec.formNumber,
    title: spec.title,
    taxYear: 2025,
    province: spec.province,
    landingPageUrl: `${landingRoot}/${spec.slug}.html`,
    officialFillablePdfUrl: `${PDF_ROOT}/${spec.slug}/${spec.pdfStem}-fill-25e.pdf`,
    inclusion: spec.inclusion,
    ...(spec.inclusionFlag === undefined ? {} : { inclusionFlag: spec.inclusionFlag }),
    outputMode: spec.outputMode ?? "official-fillable",
    notes: spec.notes ?? [],
  };
}

export const CRA_DOCUMENTS_2025 = [
  document({
    id: "T1",
    formNumber: "5006-R",
    title: "Income Tax and Benefit Return (Ontario)",
    slug: "5006-r",
    pdfStem: "5006-r",
    province: "ON",
    inclusion: "always",
    notes: ["The taxpayer signature and signature date remain manual fields."],
  }),
  document({ id: "ON428", formNumber: "5006-C", title: "ON428 - Ontario Tax", slug: "5006-c", pdfStem: "5006-c", province: "ON", inclusion: "always" }),
  document({ id: "S2", formNumber: "5000-S2", title: "Federal Amounts Transferred from your Spouse or Common-Law Partner", slug: "5000-s2", pdfStem: "5000-s2", province: "federal", inclusion: "conditional", inclusionFlag: "spouseTransfers" }),
  document({ id: "S3", formNumber: "5000-S3", title: "Capital Gains or Losses", slug: "5000-s3", pdfStem: "5000-s3", province: "federal", inclusion: "conditional", inclusionFlag: "capitalGains" }),
  document({ id: "S5", formNumber: "5000-S5", title: "Amounts for Spouse or Common-Law Partner and Dependants", slug: "5000-s5", pdfStem: "5000-s5", province: "federal", inclusion: "conditional", inclusionFlag: "dependantClaims" }),
  document({ id: "S6", formNumber: "5000-S6", title: "Canada Workers Benefit", slug: "5000-s6", pdfStem: "5000-s6", province: "federal", inclusion: "conditional", inclusionFlag: "canadaWorkersBenefit" }),
  document({ id: "S7", formNumber: "5000-S7", title: "RRSP, PRPP, and SPP Contributions and Transfers, and HBP and LLP Activities", slug: "5000-s7", pdfStem: "5000-s7", province: "federal", inclusion: "conditional", inclusionFlag: "registeredPlanActivity" }),
  document({ id: "S8", formNumber: "5000-S8", title: "Canada Pension Plan Contributions and Overpayment", slug: "5000-s8", pdfStem: "5000-s8", province: "federal", inclusion: "conditional", inclusionFlag: "cppScheduleRequired" }),
  document({ id: "S9", formNumber: "5000-S9", title: "Donations and Gifts", slug: "5000-s9", pdfStem: "5000-s9", province: "federal", inclusion: "conditional", inclusionFlag: "donations" }),
  document({ id: "S11", formNumber: "5000-S11", title: "Federal Tuition Amount and Canada Training Credit", slug: "5000-s11", pdfStem: "5000-s11", province: "federal", inclusion: "conditional", inclusionFlag: "tuition" }),
  document({ id: "S12", formNumber: "5000-S12", title: "Multigenerational Home Renovation Tax Credit", slug: "5000-s12", pdfStem: "5000-s12", province: "federal", inclusion: "conditional", inclusionFlag: "multigenerationalHomeRenovation" }),
  document({ id: "S13", formNumber: "5000-S13", title: "Employment Insurance Premiums on Self-Employment and Other Eligible Earnings", slug: "5000-s13", pdfStem: "5000-s13", province: "federal", inclusion: "conditional", inclusionFlag: "selfEmploymentEi" }),
  document({ id: "S15", formNumber: "5000-S15", title: "FHSA Contributions, Transfers and Activities", slug: "5000-s15", pdfStem: "5000-s15", province: "federal", inclusion: "conditional", inclusionFlag: "fhsaActivity" }),
  document({ id: "ON479", formNumber: "5006-TC", title: "ON479 - Ontario Credits", slug: "5006-tc", pdfStem: "5006-tc", province: "ON", inclusion: "conditional", inclusionFlag: "ontarioCredits" }),
  document({ id: "ON-BEN", formNumber: "5006-TG", title: "Application for the 2026 Ontario Trillium Benefit and Ontario Senior Homeowners' Property Tax Grant", slug: "5006-tg", pdfStem: "5006-tg", province: "ON", inclusion: "conditional", inclusionFlag: "ontarioBenefitsApplication" }),
  document({ id: "ON428-A", formNumber: "5006-A", title: "Low-income Individuals and Families Tax Credit", slug: "5006-a", pdfStem: "5006-a", province: "ON", inclusion: "conditional", inclusionFlag: "liftCredit" }),
  document({ id: "ON479-A", formNumber: "5006-TCA", title: "Ontario Childcare Access and Relief from Expenses Tax Credit", slug: "5006-tca", pdfStem: "5006-tca", province: "ON", inclusion: "conditional", inclusionFlag: "careCredit" }),
  document({ id: "ON(S2)", formNumber: "5006-S2", title: "Provincial Amounts Transferred from your Spouse or Common-Law Partner", slug: "5006-s2", pdfStem: "5006-s2", province: "ON", inclusion: "conditional", inclusionFlag: "ontarioSpouseTransfers" }),
  document({ id: "ON(S11)", formNumber: "5006-S11", title: "Ontario Tuition and Education Amounts", slug: "5006-s11", pdfStem: "5006-s11", province: "ON", inclusion: "conditional", inclusionFlag: "ontarioTuitionCarryForward" }),
] as const satisfies readonly CraDocumentDefinition[];

export const CRA_DOCUMENT_2025_BY_ID: ReadonlyMap<CraDocumentId, CraDocumentDefinition> =
  new Map(CRA_DOCUMENTS_2025.map((entry) => [entry.id, entry]));

export type OntarioTaxCentreSelection = "winnipeg-listed-area" | "sudbury-listed-area";

export function createOntarioMailingDestination(
  selection: OntarioTaxCentreSelection,
  residenceCity: string,
): MailingDestination {
  if (selection === "winnipeg-listed-area") {
    return {
      taxCentreName: "Winnipeg Tax Centre",
      addressLines: ["Post Office Box 14001", "Station Main", "Winnipeg MB R3C 3M3", "Canada"],
      basis: "official-current-address-page",
      officialSourceUrl: "https://www.canada.ca/en/revenue-agency/corporate/contact-information/where-mail-your-paper-t1-return.html",
      selectedForResidenceCity: residenceCity,
    };
  }

  return {
    taxCentreName: "Sudbury Tax Centre",
    addressLines: ["1050 Notre Dame Avenue", "Sudbury ON P3A 5C2", "Canada"],
    basis: "official-current-address-page",
    officialSourceUrl: "https://www.canada.ca/en/revenue-agency/corporate/contact-information/where-mail-your-paper-t1-return.html",
    selectedForResidenceCity: residenceCity,
  };
}
