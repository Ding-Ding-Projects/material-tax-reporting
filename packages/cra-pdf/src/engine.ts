import {
  CRA_DOCUMENT_2025_BY_ID,
  OFFICIAL_SOURCES_2025,
  type OntarioTaxCentreSelection,
  createOntarioMailingDestination,
} from "./catalog/2025.ts";
import {
  assertLocalOnlyAdapter,
  assertSafePdf,
  mapSemanticFields,
  type LocalPdfAdapter,
  type LocalPdfReference,
  type LocalTemplateSelection,
  type PdfFieldProfile,
  type PreparedPdfArtifact,
} from "./adapter.ts";
import { createFillPlans2025 } from "./mapping/2025.ts";
import { assertPrintAuthorization } from "./review.ts";
import { assertCaseFileCanBePrepared } from "./validation.ts";
import type {
  AssemblyDocument,
  AssemblyManifest,
  CraDocumentId,
  CraPdfCaseFileV1,
  DocumentFillPlan,
  EligibilityAssessment,
  PrintAuthorization,
} from "./types.ts";

export const ELECTRONIC_FILING_CAPABILITIES = Object.freeze({
  NETFILE: false,
  EFILE: false,
  electronicSubmission: false,
  directCraTransmission: false,
  simulatedFiling: false,
  automaticFiling: false,
});

export interface PreparationRequest {
  readonly caseFile: CraPdfCaseFileV1;
  readonly templates: readonly LocalTemplateSelection[];
  readonly fieldProfiles: readonly PdfFieldProfile[];
  readonly mailingDestinationSelection: OntarioTaxCentreSelection;
  readonly packageId: string;
  readonly createdAt: string;
}

export interface PreparedMailInPackage {
  readonly artifact: PreparedPdfArtifact;
  readonly manifest: AssemblyManifest;
  readonly fillPlans: readonly DocumentFillPlan[];
  readonly eligibility: EligibilityAssessment;
  readonly officialSources: typeof OFFICIAL_SOURCES_2025;
}

function exactlyOneById<T extends { readonly documentId: CraDocumentId }>(items: readonly T[], documentId: CraDocumentId, label: string): T {
  const matches = items.filter((item) => item.documentId === documentId);
  if (matches.length !== 1) throw new Error(`Expected exactly one ${label} for ${documentId}; received ${matches.length}.`);
  const match = matches[0];
  if (match === undefined) throw new Error(`Missing ${label} for ${documentId}.`);
  return match;
}

async function prepareDocument(
  adapter: LocalPdfAdapter,
  plan: DocumentFillPlan,
  template: LocalTemplateSelection,
  profile: PdfFieldProfile,
): Promise<PreparedPdfArtifact> {
  if (template.taxYear !== plan.taxYear || template.documentId !== plan.documentId || template.officialSourceUrl !== plan.officialTemplateUrl) {
    throw new Error(`Local template metadata does not match the official ${plan.documentId} tax-year definition.`);
  }
  const templateInspection = await adapter.inspect(template);
  assertSafePdf(templateInspection, `${plan.documentId} template`);
  const artifact = plan.outputMode === "official-fillable"
    ? await adapter.fillOfficialTemplate(template, mapSemanticFields(plan, profile, templateInspection))
    : await adapter.overlayOfficialPrintTemplate(template, plan.fields);
  const outputInspection = await adapter.inspect(artifact);
  assertSafePdf(outputInspection, `${plan.documentId} prepared output`);
  if (outputInspection.sha256.toLowerCase() !== artifact.sha256.toLowerCase() || outputInspection.pageCount !== artifact.pageCount) {
    throw new Error(`Prepared ${plan.documentId} metadata does not match independent inspection.`);
  }
  return artifact;
}

export async function prepareMailInPackage(
  adapter: LocalPdfAdapter,
  request: PreparationRequest,
): Promise<PreparedMailInPackage> {
  assertLocalOnlyAdapter(adapter);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/.test(request.packageId)) {
    throw new Error("Package id must contain 8 to 128 safe identifier characters.");
  }
  const eligibility = assertCaseFileCanBePrepared(request.caseFile);
  const fillPlans = createFillPlans2025(request.caseFile.identity, request.caseFile.calculation);
  const preparedForms: PreparedPdfArtifact[] = [];
  const manifestDocuments: AssemblyDocument[] = [];

  for (const plan of fillPlans) {
    const template = exactlyOneById(request.templates, plan.documentId, "local template");
    const profile = exactlyOneById(request.fieldProfiles, plan.documentId, "field profile");
    const artifact = await prepareDocument(adapter, plan, template, profile);
    preparedForms.push(artifact);
    const definition = CRA_DOCUMENT_2025_BY_ID.get(plan.documentId);
    if (definition === undefined) throw new Error(`Missing 2025 document definition for ${plan.documentId}.`);
    manifestDocuments.push({
      sequence: manifestDocuments.length + 1,
      documentId: plan.documentId,
      title: definition.title,
      localHandle: artifact.localHandle,
      sha256: artifact.sha256,
      pageCount: artifact.pageCount,
      declaration: plan.outputMode === "official-fillable"
        ? "filled official CRA form"
        : "CRA form geometry overlay requiring visual review",
    });
  }

  const preparedAttachments: PreparedPdfArtifact[] = [];
  for (const attachment of request.caseFile.attachments) {
    const reference: LocalPdfReference = { localHandle: attachment.localHandle, displayName: attachment.displayName };
    const inspection = await adapter.inspect(reference);
    assertSafePdf(inspection, `Attachment ${attachment.id}`);
    if (attachment.sha256 !== undefined && attachment.sha256.toLowerCase() !== inspection.sha256.toLowerCase()) {
      throw new Error(`Attachment ${attachment.id} changed after intake.`);
    }
    const artifact: PreparedPdfArtifact = {
      ...reference,
      pageCount: inspection.pageCount,
      sha256: inspection.sha256,
    };
    preparedAttachments.push(artifact);
    manifestDocuments.push({
      sequence: manifestDocuments.length + 1,
      documentId: "ATTACHMENT",
      title: attachment.displayName,
      localHandle: attachment.localHandle,
      sha256: inspection.sha256,
      pageCount: inspection.pageCount,
      declaration: "user-supplied supporting attachment",
    });
  }

  const mergeInputs = [...preparedForms, ...preparedAttachments];
  if (mergeInputs.length < 2) throw new Error("The Ontario mail package must include at least the T1 and ON428 documents.");
  const artifact = await adapter.merge(mergeInputs);
  const packageInspection = await adapter.inspect(artifact);
  assertSafePdf(packageInspection, "Assembled mail-in package");
  const expectedPages = mergeInputs.reduce((sum, input) => sum + input.pageCount, 0);
  if (packageInspection.pageCount !== expectedPages || packageInspection.sha256.toLowerCase() !== artifact.sha256.toLowerCase()) {
    throw new Error("Assembled package page count or digest does not match its inspected inputs.");
  }

  const mailingDestination = createOntarioMailingDestination(
    request.mailingDestinationSelection,
    request.caseFile.identity.residenceCity,
  );
  const manifest: AssemblyManifest = {
    schemaVersion: "cra-mail-package.v1",
    packageId: request.packageId,
    taxYear: 2025,
    province: "ON",
    calculationId: request.caseFile.calculation.calculationId,
    documents: manifestDocuments,
    mailingDestination,
    packageSha256: packageInspection.sha256,
    createdAt: request.createdAt,
    declarations: [
      "mail-in PDF preparation only",
      "not CRA-certified tax software",
      "not an electronic filing or transmission",
      "not tax or legal advice",
      "manual inspection and signatures are required",
    ],
  };

  return { artifact, manifest, fillPlans, eligibility, officialSources: OFFICIAL_SOURCES_2025 };
}

export async function createReviewPreview(
  adapter: LocalPdfAdapter,
  prepared: PreparedMailInPackage,
): Promise<LocalPdfReference> {
  assertLocalOnlyAdapter(adapter);
  return adapter.preview(prepared.artifact);
}

export async function exportReviewedMailInPackage(
  adapter: LocalPdfAdapter,
  prepared: PreparedMailInPackage,
  destinationLocalHandle: string,
  authorization: PrintAuthorization,
): Promise<void> {
  assertLocalOnlyAdapter(adapter);
  assertPrintAuthorization(prepared.manifest, authorization);
  if (destinationLocalHandle.length < 1 || destinationLocalHandle.length > 500) throw new Error("A bounded local destination handle is required.");
  await adapter.exportAtomically(prepared.artifact, destinationLocalHandle, authorization);
}

export async function printReviewedMailInPackage(
  adapter: LocalPdfAdapter,
  prepared: PreparedMailInPackage,
  authorization: PrintAuthorization,
): Promise<void> {
  assertLocalOnlyAdapter(adapter);
  assertPrintAuthorization(prepared.manifest, authorization);
  await adapter.printLocally(prepared.artifact, authorization);
}
