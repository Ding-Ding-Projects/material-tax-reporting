import type {
  AssemblyManifest,
  DocumentFillPlan,
  ManualReviewItem,
  ManualReviewState,
  PrintAuthorization,
} from "./types.ts";

export const FINAL_REVIEW_ACKNOWLEDGEMENT =
  "I inspected every listed form, calculation, attachment, mailing destination, and signature field. I understand that I must sign and mail the package myself and that no return has been filed." as const;

function item(id: string, category: ManualReviewItem["category"], label: string, documentId?: ManualReviewItem["documentId"]): ManualReviewItem {
  return {
    id,
    category,
    label,
    ...(documentId === undefined ? {} : { documentId }),
    status: "pending",
  };
}

export function createManualReviewState(
  manifest: AssemblyManifest,
  fillPlans: readonly DocumentFillPlan[],
): ManualReviewState {
  const items: ManualReviewItem[] = [];

  for (const document of manifest.documents) {
    if (document.documentId === "ATTACHMENT") {
      items.push(item(`attachment:${document.sequence}`, "attachment", `Inspect supporting attachment: ${document.title}`, "ATTACHMENT"));
    } else {
      items.push(item(`form:${document.documentId}`, "populated-form", `Inspect every populated field and page of ${document.title}`, document.documentId));
    }
  }

  for (const plan of fillPlans) {
    for (const calculationLine of plan.calculationLines) {
      items.push(item(
        `calculation:${plan.documentId}:${calculationLine}`,
        "calculation",
        `Reconcile calculation ${calculationLine} with ${plan.documentId}`,
        plan.documentId,
      ));
    }
    for (let index = 0; index < plan.manualFields.length; index += 1) {
      const manualField = plan.manualFields[index];
      if (manualField !== undefined) {
        items.push(item(
          `signature:${plan.documentId}:${index}`,
          "signature-field",
          `Confirm the printed package leaves this field ready for manual completion: ${manualField}`,
          plan.documentId,
        ));
      }
    }
  }

  items.push(item(
    "mailing-destination",
    "mailing-destination",
    `Verify the current official destination: ${manifest.mailingDestination.taxCentreName}, ${manifest.mailingDestination.addressLines.join(", ")}`,
  ));

  return {
    schemaVersion: "cra-manual-review.v1",
    packageId: manifest.packageId,
    packageSha256: manifest.packageSha256,
    phase: "not-started",
    items,
  };
}

export function startManualReview(state: ManualReviewState): ManualReviewState {
  if (state.phase !== "not-started") throw new Error("Manual review can only be started once for this package digest.");
  return { ...state, phase: "in-progress" };
}

export function confirmManualReviewItem(
  state: ManualReviewState,
  itemId: string,
  observedPackageSha256: string,
  confirmedAt: string,
): ManualReviewState {
  if (state.phase !== "in-progress" && state.phase !== "items-complete") {
    throw new Error("Manual review must be in progress before an item can be confirmed.");
  }
  if (observedPackageSha256.toLowerCase() !== state.packageSha256.toLowerCase()) {
    throw new Error("The reviewed package digest changed; restart manual review for the new package.");
  }
  let matched = false;
  const items = state.items.map((candidate) => {
    if (candidate.id !== itemId) return candidate;
    matched = true;
    return { ...candidate, status: "confirmed" as const, confirmedAt };
  });
  if (!matched) throw new Error(`Unknown manual-review item: ${itemId}.`);
  return {
    ...state,
    items,
    phase: items.every((candidate) => candidate.status === "confirmed") ? "items-complete" : "in-progress",
  };
}

export function acknowledgeManualReview(
  state: ManualReviewState,
  acknowledgement: typeof FINAL_REVIEW_ACKNOWLEDGEMENT,
  acknowledgedAt: string,
): ManualReviewState {
  if (state.phase !== "items-complete" || state.items.some((candidate) => candidate.status !== "confirmed")) {
    throw new Error("Every manual-review item must be individually confirmed before final acknowledgement.");
  }
  if (acknowledgement !== FINAL_REVIEW_ACKNOWLEDGEMENT) {
    throw new Error("The exact mail-only final-review acknowledgement is required.");
  }
  return {
    ...state,
    phase: "acknowledged",
    finalAcknowledgement: {
      acknowledgedAt,
      statementVersion: "mail-review-2025.v1",
    },
  };
}

export function createPrintAuthorization(
  manifest: AssemblyManifest,
  state: ManualReviewState,
  issuedAt: string,
): PrintAuthorization {
  if (state.phase !== "acknowledged" || state.finalAcknowledgement === undefined) {
    throw new Error("Export and printing remain blocked until final manual-review acknowledgement.");
  }
  if (state.packageId !== manifest.packageId || state.packageSha256.toLowerCase() !== manifest.packageSha256.toLowerCase()) {
    throw new Error("Manual review does not match this package id and content digest.");
  }
  if (state.items.length === 0 || state.items.some((candidate) => candidate.status !== "confirmed")) {
    throw new Error("Manual review is incomplete.");
  }
  return {
    kind: "cra-mail-package-print-authorization",
    packageId: manifest.packageId,
    packageSha256: manifest.packageSha256,
    issuedAt,
    expiresOnContentChange: true,
    permits: ["export-local-pdf", "print-local-pdf"],
    prohibits: [
      "NETFILE",
      "EFILE",
      "electronic submission",
      "direct CRA transmission",
      "simulated filing",
      "automatic filing",
    ],
  };
}

export function assertPrintAuthorization(
  manifest: AssemblyManifest,
  authorization: PrintAuthorization,
): void {
  if (authorization.kind !== "cra-mail-package-print-authorization" ||
      authorization.packageId !== manifest.packageId ||
      authorization.packageSha256.toLowerCase() !== manifest.packageSha256.toLowerCase()) {
    throw new Error("Print authorization does not match the prepared package.");
  }
  if (authorization.permits.length !== 2 || !authorization.permits.includes("export-local-pdf") || !authorization.permits.includes("print-local-pdf")) {
    throw new Error("Print authorization has an invalid local-output scope.");
  }
}
