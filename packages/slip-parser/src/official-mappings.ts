import type { OfficialCitation, SlipDefinition } from "./types.js";

const retrievedOn = "2026-08-14" as const;

const citations = {
  t4: {
    title: "Line 10100 – Employment income",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/personal-income/line-10100-employment-income.html",
    retrievedOn,
  },
  t4Slip: {
    title: "T4 slip: Statement of Remuneration Paid",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t4-slips/t4-statement-remuneration-paid.html",
    retrievedOn,
  },
  taxDeducted: {
    title: "Line 43700 – Total income tax deducted",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-43700-total-income-tax-deducted.html",
    retrievedOn,
  },
  t4a: {
    title: "T4A slip: Statement of Pension, Retirement, Annuity, and Other Income",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t4-slips/t4a-slip.html",
    retrievedOn,
  },
  t4e: {
    title: "T4E slip: Statement of Employment Insurance and Other Benefits",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t4-slips/t4e-statement-employment-insurance-other-benefits.html",
    retrievedOn,
  },
  t5: {
    title: "T5 Statement of Investment Income – slip information for individuals",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t5-slips/t5-statement-investment-income-slip-information-individuals.html",
    retrievedOn,
  },
  t3: {
    title: "T3 Statement of Trust Income Allocations and Designations – slip information for individuals",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t3-statement-trust-income-allocations-designations-slip-information-individuals.html",
    retrievedOn,
  },
  t5008: {
    title: "T5008 Statement of Securities Transactions – slip information for individuals",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t5-slips/t5008-statement-securities-transactions-slip-information-individuals.html",
    retrievedOn,
  },
  t2202: {
    title: "T2202 Tuition and Enrolment Certificate",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/t2202-tuition-enrolment-certificate.html",
    retrievedOn,
  },
  schedule11: {
    title: "Completing Schedule 11",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-32300-your-tuition-education-textbook-amounts/completing-schedule-11.html",
    retrievedOn,
  },
  rrsp: {
    title: "RRSP contribution receipt – slip information for individuals",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/tax-slips/understand-your-tax-slips/rrsp-contribution-receipt-slip-information-individuals.html",
    retrievedOn,
  },
} satisfies Record<string, OfficialCitation>;

export const OFFICIAL_CITATIONS = Object.freeze(citations);

export const SLIP_DEFINITIONS: readonly SlipDefinition[] = Object.freeze([
  {
    slipType: "T4A",
    title: "Statement of Pension, Retirement, Annuity, and Other Income",
    classificationTerms: ["T4A", "STATEMENT OF PENSION", "PENSION, RETIREMENT, ANNUITY"],
    citation: citations.t4a,
    boxes: [
      {
        box: "016",
        label: "Pension or superannuation",
        aliases: ["PENSION OR SUPERANNUATION", "PENSION OU RETRAITE"],
        valueKind: "money",
        requiredForReview: false,
        mappings: [{ kind: "direct", target: "T1.11500", explanation: "Enter box 016 on line 11500, subject to the CRA instructions and manual review.", citation: citations.t4a }],
      },
      {
        box: "018",
        label: "Lump-sum payments",
        aliases: ["LUMP-SUM PAYMENTS", "PAIEMENTS FORFAITAIRES"],
        valueKind: "money",
        requiredForReview: false,
        mappings: [{ kind: "direct", target: "T1.13000", explanation: "Enter box 018 on line 13000, subject to transfer rules and manual review.", citation: citations.t4a }],
      },
      {
        box: "020",
        label: "Self-employed commissions",
        aliases: ["SELF-EMPLOYED COMMISSIONS", "COMMISSIONS D'UN TRAVAIL INDÉPENDANT"],
        valueKind: "money",
        requiredForReview: false,
        mappings: [{ kind: "direct", target: "T1.13899", explanation: "Box 020 is gross commissions income for line 13899; net income on line 13900 requires separate calculations.", citation: citations.t4a }],
      },
      {
        box: "022",
        label: "Income tax deducted",
        aliases: ["INCOME TAX DEDUCTED", "IMPÔT SUR LE REVENU RETENU"],
        valueKind: "money",
        requiredForReview: false,
        mappings: [{ kind: "direct", target: "T1.43700", explanation: "Include box 022 in total income tax deducted on line 43700.", citation: citations.t4a }],
      },
    ],
  },
  {
    slipType: "T4E",
    title: "Statement of Employment Insurance and Other Benefits",
    classificationTerms: ["T4E", "EMPLOYMENT INSURANCE AND OTHER BENEFITS", "ASSURANCE-EMPLOI ET AUTRES PRESTATIONS"],
    citation: citations.t4e,
    boxes: [
      {
        box: "14",
        label: "Total benefits paid",
        aliases: ["TOTAL BENEFITS PAID", "PRESTATIONS TOTALES VERSÉES"],
        valueKind: "money",
        requiredForReview: true,
        mappings: [{ kind: "formula", target: "T1.11900", formula: "box14 - box18", explanation: "Line 11900 is box 14 minus box 18; both values and the subtraction require manual confirmation.", citation: citations.t4e }],
      },
      {
        box: "18",
        label: "Tax exempt benefits",
        aliases: ["TAX EXEMPT BENEFITS", "PRESTATIONS EXONÉRÉES D'IMPÔT"],
        valueKind: "money",
        requiredForReview: false,
        mappings: [{ kind: "formula", target: "T1.11900", formula: "box14 - box18", explanation: "Box 18 is subtracted from box 14 when calculating line 11900.", citation: citations.t4e }],
      },
      {
        box: "22",
        label: "Income tax deducted",
        aliases: ["INCOME TAX DEDUCTED", "IMPÔT SUR LE REVENU RETENU"],
        valueKind: "money",
        requiredForReview: false,
        mappings: [{ kind: "direct", target: "T1.43700", explanation: "Enter box 22 on line 43700.", citation: citations.t4e }],
      },
      {
        box: "30",
        label: "Total repayment",
        aliases: ["TOTAL REPAYMENT", "REMBOURSEMENT TOTAL"],
        valueKind: "money",
        requiredForReview: false,
        mappings: [{ kind: "direct", target: "T1.23200", explanation: "Enter box 30 on line 23200.", citation: citations.t4e }],
      },
    ],
  },
  {
    slipType: "T5008",
    title: "Statement of Securities Transactions",
    classificationTerms: ["T5008", "STATEMENT OF SECURITIES TRANSACTIONS", "ÉTAT DES OPÉRATIONS SUR TITRES"],
    citation: citations.t5008,
    boxes: [
      {
        box: "20",
        label: "Cost or book value",
        aliases: ["COST OR BOOK VALUE", "COÛT OU VALEUR COMPTABLE"],
        valueKind: "money",
        requiredForReview: true,
        mappings: [{ kind: "review-only", target: null, explanation: "Adjusted cost base and expenses may differ from box 20 and require taxpayer records; no universal direct return-line mapping is applied.", citation: citations.t5008 }],
      },
      {
        box: "21",
        label: "Proceeds of disposition",
        aliases: ["PROCEEDS OF DISPOSITION", "PRODUIT DE DISPOSITION"],
        valueKind: "money",
        requiredForReview: true,
        mappings: [{ kind: "review-only", target: "Schedule3.column2", explanation: "Box 21 is proceeds of disposition for Schedule 3; property category, adjusted cost base, and expenses require manual review.", citation: citations.t5008 }],
      },
    ],
  },
  {
    slipType: "T2202",
    title: "Tuition and Enrolment Certificate",
    classificationTerms: ["T2202", "TUITION AND ENROLMENT CERTIFICATE", "CERTIFICAT POUR FRAIS DE SCOLARITÉ"],
    citation: citations.t2202,
    boxes: [
      { box: "24", label: "Total number of months part-time", aliases: ["TOTAL NUMBER OF MONTHS PART-TIME", "TOTAL DES MOIS À TEMPS PARTIEL"], valueKind: "integer", requiredForReview: false, mappings: [{ kind: "direct", target: "Schedule11.32010", explanation: "Part-time months are reported on Schedule 11 line 32010 when applicable.", citation: citations.schedule11 }] },
      { box: "25", label: "Total number of months full-time", aliases: ["TOTAL NUMBER OF MONTHS FULL-TIME", "TOTAL DES MOIS À TEMPS PLEIN"], valueKind: "integer", requiredForReview: false, mappings: [{ kind: "direct", target: "Schedule11.32020", explanation: "Full-time months are reported on Schedule 11 line 32020 when applicable.", citation: citations.schedule11 }] },
      { box: "26", label: "Total eligible tuition fees", aliases: ["TOTAL ELIGIBLE TUITION FEES", "TOTAL DES FRAIS DE SCOLARITÉ ADMISSIBLES"], valueKind: "money", requiredForReview: true, mappings: [{ kind: "direct", target: "Schedule11.32000", explanation: "Eligible tuition fees flow through Schedule 11 line 32000; Schedule 11 determines any T1 amount.", citation: citations.schedule11 }] },
    ],
  },
  {
    slipType: "RRSP_RECEIPT",
    title: "RRSP contribution receipt",
    classificationTerms: ["RRSP CONTRIBUTION RECEIPT", "REÇU DE COTISATION REER", "REGISTERED RETIREMENT SAVINGS PLAN CONTRIBUTION"],
    citation: citations.rrsp,
    boxes: [
      {
        box: "CONTRIBUTION_AMOUNT",
        label: "Contribution amount",
        aliases: ["CONTRIBUTION AMOUNT", "AMOUNT OF CONTRIBUTION", "MONTANT DE LA COTISATION"],
        valueKind: "money",
        requiredForReview: true,
        mappings: [
          { kind: "direct", target: "Schedule7.24500", explanation: "Total RRSP contributions for both periods are entered on Schedule 7 line 24500 when the CRA instructions require Schedule 7.", citation: citations.rrsp },
          { kind: "review-only", target: "T1.20800", explanation: "Line 20800 is the deduction the taxpayer chooses to claim, not an automatic copy of the receipt amount.", citation: citations.rrsp },
        ],
      },
    ],
  },
  {
    slipType: "T4",
    title: "Statement of Remuneration Paid",
    classificationTerms: ["T4", "STATEMENT OF REMUNERATION PAID", "ÉTAT DE LA RÉMUNÉRATION PAYÉE"],
    citation: citations.t4,
    boxes: [
      { box: "14", label: "Employment income", aliases: ["EMPLOYMENT INCOME", "REVENUS D'EMPLOI"], valueKind: "money", requiredForReview: true, mappings: [{ kind: "direct", target: "T1.10100", explanation: "Report the total of T4 box 14 amounts on line 10100, subject to CRA exceptions and manual review.", citation: citations.t4 }] },
      { box: "16", label: "Employee's CPP contributions", aliases: ["EMPLOYEE'S CPP CONTRIBUTIONS", "COTISATIONS DE L'EMPLOYÉ AU RPC"], valueKind: "money", requiredForReview: false, mappings: [{ kind: "review-only", target: "Schedule8", explanation: "CPP contribution treatment requires Schedule 8 or Form RC381 calculations and is never copied directly to a final return line.", citation: citations.t4Slip }] },
      { box: "16A", label: "Second additional CPP contributions", aliases: ["SECOND ADDITIONAL CPP CONTRIBUTIONS", "DEUXIÈMES COTISATIONS SUPPLÉMENTAIRES AU RPC"], valueKind: "money", requiredForReview: false, mappings: [{ kind: "review-only", target: "Schedule8", explanation: "Second additional CPP contributions require Schedule 8 or Form RC381 calculations.", citation: citations.t4Slip }] },
      { box: "17", label: "Employee's QPP contributions", aliases: ["EMPLOYEE'S QPP CONTRIBUTIONS", "COTISATIONS DE L'EMPLOYÉ AU RRQ"], valueKind: "money", requiredForReview: false, mappings: [{ kind: "review-only", target: "FormRC381", explanation: "QPP contribution treatment requires Form RC381 calculations and residency context.", citation: citations.t4Slip }] },
      { box: "17A", label: "Second additional QPP contributions", aliases: ["SECOND ADDITIONAL QPP CONTRIBUTIONS", "DEUXIÈMES COTISATIONS SUPPLÉMENTAIRES AU RRQ"], valueKind: "money", requiredForReview: false, mappings: [{ kind: "review-only", target: "FormRC381", explanation: "Second additional QPP contributions require Form RC381 calculations.", citation: citations.t4Slip }] },
      { box: "18", label: "Employee's EI premiums", aliases: ["EMPLOYEE'S EI PREMIUMS", "COTISATIONS DE L'EMPLOYÉ À L'AE"], valueKind: "money", requiredForReview: false, mappings: [{ kind: "direct", target: "T1.31200", explanation: "Enter box 18 on line 31200, subject to the CRA overpayment calculation.", citation: citations.t4Slip }] },
      { box: "20", label: "RPP contributions", aliases: ["RPP CONTRIBUTIONS", "COTISATIONS À UN RPA"], valueKind: "money", requiredForReview: false, mappings: [{ kind: "direct", target: "T1.20700", explanation: "Enter box 20 on line 20700.", citation: citations.t4Slip }] },
      { box: "22", label: "Income tax deducted", aliases: ["INCOME TAX DEDUCTED", "IMPÔT SUR LE REVENU RETENU"], valueKind: "money", requiredForReview: false, mappings: [{ kind: "direct", target: "T1.43700", explanation: "Include box 22 in total income tax deducted on line 43700.", citation: citations.taxDeducted }] },
      { box: "44", label: "Union dues", aliases: ["UNION DUES", "COTISATIONS SYNDICALES"], valueKind: "money", requiredForReview: false, mappings: [{ kind: "direct", target: "T1.21200", explanation: "Enter box 44 on line 21200 when the CRA conditions are met.", citation: citations.t4Slip }] },
      { box: "52", label: "Pension adjustment", aliases: ["PENSION ADJUSTMENT", "FACTEUR D'ÉQUIVALENCE"], valueKind: "money", requiredForReview: false, mappings: [{ kind: "direct", target: "T1.20600", explanation: "Enter box 52 on line 20600 as a pension adjustment; it is neither income nor a deduction.", citation: citations.t4Slip }] },
    ],
  },
  {
    slipType: "T5",
    title: "Statement of Investment Income",
    classificationTerms: ["T5", "STATEMENT OF INVESTMENT INCOME", "ÉTAT DES REVENUS DE PLACEMENTS"],
    citation: citations.t5,
    boxes: [
      { box: "11", label: "Taxable amount of dividends other than eligible dividends", aliases: ["TAXABLE AMOUNT OF DIVIDENDS OTHER THAN ELIGIBLE DIVIDENDS"], valueKind: "money", requiredForReview: false, mappings: [{ kind: "direct", target: "T1.12010,T1.12000", explanation: "Report box 11 on lines 12010 and 12000.", citation: citations.t5 }] },
      { box: "12", label: "Dividend tax credit other than eligible dividends", aliases: ["DIVIDEND TAX CREDIT OTHER THAN ELIGIBLE DIVIDENDS"], valueKind: "money", requiredForReview: false, mappings: [{ kind: "direct", target: "T1.40425", explanation: "Claim box 12 on line 40425.", citation: citations.t5 }] },
      { box: "13", label: "Interest from Canadian sources", aliases: ["INTEREST FROM CANADIAN SOURCES", "INTÉRÊTS DE SOURCE CANADIENNE"], valueKind: "money", requiredForReview: true, mappings: [{ kind: "direct", target: "T1.12100", explanation: "Report box 13 through line 12100.", citation: citations.t5 }] },
      { box: "14", label: "Other income from Canadian sources", aliases: ["OTHER INCOME FROM CANADIAN SOURCES"], valueKind: "money", requiredForReview: false, mappings: [{ kind: "direct", target: "T1.12100", explanation: "Report box 14 through line 12100.", citation: citations.t5 }] },
      { box: "18", label: "Capital gains dividends", aliases: ["CAPITAL GAINS DIVIDENDS"], valueKind: "money", requiredForReview: false, mappings: [{ kind: "direct", target: "Schedule3.17400", explanation: "Enter box 18 on Schedule 3 line 17400.", citation: citations.t5 }] },
      { box: "25", label: "Taxable amount of eligible dividends", aliases: ["TAXABLE AMOUNT OF ELIGIBLE DIVIDENDS"], valueKind: "money", requiredForReview: false, mappings: [{ kind: "direct", target: "T1.12000", explanation: "Report box 25 on line 12000.", citation: citations.t5 }] },
      { box: "26", label: "Dividend tax credit for eligible dividends", aliases: ["DIVIDEND TAX CREDIT FOR ELIGIBLE DIVIDENDS"], valueKind: "money", requiredForReview: false, mappings: [{ kind: "direct", target: "T1.40425", explanation: "Claim box 26 on line 40425.", citation: citations.t5 }] },
    ],
  },
  {
    slipType: "T3",
    title: "Statement of Trust Income Allocations and Designations",
    classificationTerms: ["T3", "STATEMENT OF TRUST INCOME ALLOCATIONS", "ÉTAT DES REVENUS DE FIDUCIE"],
    citation: citations.t3,
    boxes: [
      { box: "21", label: "Capital gains", aliases: ["CAPITAL GAINS", "GAINS EN CAPITAL"], valueKind: "money", requiredForReview: true, mappings: [{ kind: "formula", target: "Schedule3.17600", formula: "box21 - box30", explanation: "Schedule 3 line 17600 is box 21 minus box 30; foreign-income footnotes may also apply.", citation: citations.t3 }] },
      { box: "22", label: "Lump-sum pension income", aliases: ["LUMP-SUM PENSION INCOME"], valueKind: "money", requiredForReview: false, mappings: [{ kind: "direct", target: "T1.13000", explanation: "Include box 22 on line 13000, subject to possible transfer treatment.", citation: citations.t3 }] },
      { box: "26", label: "Other income", aliases: ["OTHER INCOME", "AUTRES REVENUS"], valueKind: "money", requiredForReview: true, mappings: [{ kind: "formula", target: "T1.13000", formula: "box26 - box31", explanation: "Line 13000 is box 26 minus box 31.", citation: citations.t3 }] },
      { box: "32", label: "Taxable amount of dividends other than eligible dividends", aliases: ["TAXABLE AMOUNT OF DIVIDENDS OTHER THAN ELIGIBLE DIVIDENDS"], valueKind: "money", requiredForReview: false, mappings: [{ kind: "direct", target: "T1.12010,T1.12000", explanation: "Include box 32 on lines 12010 and 12000.", citation: citations.t3 }] },
      { box: "39", label: "Federal dividend tax credit other than eligible dividends", aliases: ["FEDERAL DIVIDEND TAX CREDIT"], valueKind: "money", requiredForReview: false, mappings: [{ kind: "direct", target: "T1.40425", explanation: "Include box 39 in the federal dividend tax credit on line 40425.", citation: citations.t3 }] },
      { box: "50", label: "Taxable amount of eligible dividends", aliases: ["TAXABLE AMOUNT OF ELIGIBLE DIVIDENDS"], valueKind: "money", requiredForReview: false, mappings: [{ kind: "direct", target: "T1.12000", explanation: "Include box 50 on line 12000.", citation: citations.t3 }] },
      { box: "51", label: "Federal dividend tax credit for eligible dividends", aliases: ["FEDERAL DIVIDEND TAX CREDIT FOR ELIGIBLE DIVIDENDS"], valueKind: "money", requiredForReview: false, mappings: [{ kind: "direct", target: "T1.40425", explanation: "Include box 51 in the federal dividend tax credit on line 40425.", citation: citations.t3 }] },
    ],
  },
]);

export function getSlipDefinition(slipType: SlipDefinition["slipType"]): SlipDefinition {
  const definition = SLIP_DEFINITIONS.find((candidate) => candidate.slipType === slipType);
  if (!definition) {
    throw new Error(`No slip definition is registered for ${slipType}.`);
  }
  return definition;
}
