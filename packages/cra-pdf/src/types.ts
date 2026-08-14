export const SUPPORTED_TAX_YEARS = [2025] as const;

export type SupportedTaxYear = (typeof SUPPORTED_TAX_YEARS)[number];
export type ProvinceCode = "ON";
export type MoneyCents = number;

export type CraDocumentId =
  | "T1"
  | "S2"
  | "S3"
  | "S5"
  | "S6"
  | "S7"
  | "S8"
  | "S9"
  | "S11"
  | "S12"
  | "S13"
  | "S15"
  | "ON428"
  | "ON479"
  | "ON-BEN"
  | "ON428-A"
  | "ON479-A"
  | "ON(S2)"
  | "ON(S11)";

export type UnsupportedDocumentId =
  | "T1135"
  | "T2125"
  | "T776"
  | "T778"
  | "T1-M"
  | "T777"
  | "T2203"
  | "T2209"
  | "T2036"
  | "T691"
  | "T1206";

export interface OfficialSourceCitation {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly publisher: "Canada Revenue Agency" | "Government of Canada" | "Government of Ontario";
  readonly retrievedOn: string;
  readonly supports: readonly string[];
}

export interface CraDocumentDefinition {
  readonly id: CraDocumentId;
  readonly formNumber: string;
  readonly title: string;
  readonly taxYear: SupportedTaxYear;
  readonly province: ProvinceCode | "federal";
  readonly landingPageUrl: string;
  readonly officialFillablePdfUrl: string;
  readonly inclusion: "always" | "conditional";
  readonly inclusionFlag?: keyof FormInclusionFlags;
  readonly outputMode: "official-fillable" | "official-print-overlay";
  readonly notes: readonly string[];
}

export interface FormInclusionFlags {
  readonly spouseTransfers: boolean;
  readonly capitalGains: boolean;
  readonly dependantClaims: boolean;
  readonly canadaWorkersBenefit: boolean;
  readonly registeredPlanActivity: boolean;
  readonly cppScheduleRequired: boolean;
  readonly donations: boolean;
  readonly tuition: boolean;
  readonly multigenerationalHomeRenovation: boolean;
  readonly selfEmploymentEi: boolean;
  readonly fhsaActivity: boolean;
  readonly ontarioCredits: boolean;
  readonly ontarioBenefitsApplication: boolean;
  readonly liftCredit: boolean;
  readonly careCredit: boolean;
  readonly ontarioSpouseTransfers: boolean;
  readonly ontarioTuitionCarryForward: boolean;
}

export interface TaxpayerIdentity {
  readonly givenName: string;
  readonly familyName: string;
  readonly mailingAddress: Readonly<{
    line1: string;
    line2?: string;
    city: string;
    province: ProvinceCode;
    postalCode: string;
    country: "Canada";
  }>;
  readonly residenceCity: string;
  readonly dateOfBirth: string;
  readonly socialInsuranceNumber: string;
  readonly maritalStatus: "single" | "married" | "common-law" | "separated" | "divorced" | "widowed";
  readonly correspondenceLanguage: "English" | "French";
}

export interface CalculationSnapshot {
  readonly schemaVersion: "tax-calculation-snapshot.v1";
  readonly taxYear: SupportedTaxYear;
  readonly province: ProvinceCode;
  readonly calculationId: string;
  readonly createdAt: string;
  /** CRA line number to signed integer cents. */
  readonly federalLines: Readonly<Record<string, MoneyCents>>;
  /** Ontario form line number to signed integer cents. */
  readonly ontarioLines: Readonly<Record<string, MoneyCents>>;
  readonly inclusionFlags: FormInclusionFlags;
  readonly warnings: readonly string[];
}

export interface LocalAttachmentReference {
  readonly id: string;
  readonly kind:
    | "information-slip"
    | "receipt"
    | "completed-form"
    | "supporting-statement"
    | "explanatory-note";
  readonly displayName: string;
  readonly localHandle: string;
  readonly requiredForLine?: string;
  readonly pageCount?: number;
  readonly sha256?: string;
}

export interface CarryForwardAmount {
  readonly type:
    | "net-capital-loss"
    | "non-capital-loss"
    | "charitable-donation"
    | "federal-tuition"
    | "ontario-tuition"
    | "rrsp-unused-contribution"
    | "fhsa-unused-participation-room";
  readonly amountCents: MoneyCents;
  readonly originTaxYear: number;
  readonly source: "notice-of-assessment" | "prior-return" | "user-confirmed";
  readonly note?: string;
}

export interface UnsupportedSituationAnswers {
  readonly nonResidentOrDeemedResident: boolean;
  readonly enteredOrLeftCanadaDuringYear: boolean;
  readonly deceasedReturn: boolean;
  readonly bankruptcyReturn: boolean;
  readonly businessPermanentEstablishmentOutsideOntario: boolean;
  readonly farmingOrFishingIncome: boolean;
  readonly trustIncomeOrTrustReturn: boolean;
  readonly alternativeMinimumTax: boolean;
  readonly splitIncome: boolean;
  readonly foreignTaxCredit: boolean;
  readonly specifiedForeignPropertyOverThreshold: boolean;
  readonly complexCapitalTransaction: boolean;
}

export interface CraPdfCaseFileV1 {
  readonly schemaVersion: "cra-pdf-case.v1";
  readonly taxYear: SupportedTaxYear;
  readonly province: ProvinceCode;
  readonly identity: TaxpayerIdentity;
  readonly calculation: CalculationSnapshot;
  readonly attachments: readonly LocalAttachmentReference[];
  readonly carryForwards: readonly CarryForwardAmount[];
  readonly unsupportedSituations: UnsupportedSituationAnswers;
  readonly consent: Readonly<{
    localProcessingOnly: true;
    understandsNotTaxAdvice: true;
    understandsNotCraCertified: true;
    understandsMailOnlyOutput: true;
  }>;
}

export interface PortableCarryForwardExportV1 {
  readonly schemaVersion: "cra-carry-forward.v1";
  readonly exportedAt: string;
  readonly sourceTaxYear: SupportedTaxYear;
  readonly province: ProvinceCode;
  readonly carryForwards: readonly CarryForwardAmount[];
  readonly exclusions: readonly [
    "taxpayer identity",
    "social insurance number",
    "addresses",
    "attachments",
    "signatures",
    "PDF content"
  ];
}

export interface EligibilityFinding {
  readonly code: string;
  readonly severity: "blocker" | "manual-review" | "information";
  readonly message: string;
  readonly sourceId: string;
  readonly relatedDocument?: UnsupportedDocumentId;
}

export interface EligibilityAssessment {
  readonly eligibleForAutomatedPreparation: boolean;
  readonly findings: readonly EligibilityFinding[];
}

export type SemanticFieldValue = string | boolean;

export interface SemanticFieldAssignment {
  readonly semanticField: string;
  readonly value: SemanticFieldValue;
  readonly source:
    | { readonly kind: "identity"; readonly path: string }
    | { readonly kind: "federal-line"; readonly line: string }
    | { readonly kind: "ontario-line"; readonly line: string }
    | { readonly kind: "constant"; readonly description: string };
}

export interface DocumentFillPlan {
  readonly documentId: CraDocumentId;
  readonly taxYear: SupportedTaxYear;
  readonly officialTemplateUrl: string;
  readonly outputMode: CraDocumentDefinition["outputMode"];
  readonly fields: readonly SemanticFieldAssignment[];
  readonly calculationLines: readonly string[];
  readonly manualFields: readonly string[];
}

export interface AssemblyDocument {
  readonly sequence: number;
  readonly documentId: CraDocumentId | "ATTACHMENT";
  readonly title: string;
  readonly localHandle: string;
  readonly sha256: string;
  readonly pageCount: number;
  readonly declaration:
    | "filled official CRA form"
    | "CRA form geometry overlay requiring visual review"
    | "user-supplied supporting attachment";
}

export interface MailingDestination {
  readonly taxCentreName: string;
  readonly addressLines: readonly string[];
  readonly basis: "official-current-address-page";
  readonly officialSourceUrl: string;
  readonly selectedForResidenceCity: string;
}

export interface AssemblyManifest {
  readonly schemaVersion: "cra-mail-package.v1";
  readonly packageId: string;
  readonly taxYear: SupportedTaxYear;
  readonly province: ProvinceCode;
  readonly calculationId: string;
  readonly documents: readonly AssemblyDocument[];
  readonly mailingDestination: MailingDestination;
  readonly packageSha256: string;
  readonly createdAt: string;
  readonly declarations: readonly [
    "mail-in PDF preparation only",
    "not CRA-certified tax software",
    "not an electronic filing or transmission",
    "not tax or legal advice",
    "manual inspection and signatures are required"
  ];
}

export type ReviewCategory =
  | "populated-form"
  | "calculation"
  | "attachment"
  | "mailing-destination"
  | "signature-field";

export interface ManualReviewItem {
  readonly id: string;
  readonly category: ReviewCategory;
  readonly label: string;
  readonly documentId?: CraDocumentId | "ATTACHMENT";
  readonly status: "pending" | "confirmed";
  readonly confirmedAt?: string;
}

export interface ManualReviewState {
  readonly schemaVersion: "cra-manual-review.v1";
  readonly packageId: string;
  readonly packageSha256: string;
  readonly phase: "not-started" | "in-progress" | "items-complete" | "acknowledged";
  readonly items: readonly ManualReviewItem[];
  readonly finalAcknowledgement?: Readonly<{
    acknowledgedAt: string;
    statementVersion: "mail-review-2025.v1";
  }>;
}

export interface PrintAuthorization {
  readonly kind: "cra-mail-package-print-authorization";
  readonly packageId: string;
  readonly packageSha256: string;
  readonly issuedAt: string;
  readonly expiresOnContentChange: true;
  readonly permits: readonly ["export-local-pdf", "print-local-pdf"];
  readonly prohibits: readonly [
    "NETFILE",
    "EFILE",
    "electronic submission",
    "direct CRA transmission",
    "simulated filing",
    "automatic filing"
  ];
}
