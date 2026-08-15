/**
 * A recording stand-in for the host's local PDF library.
 *
 * The package never touches a file itself: every read, fill, merge, export and
 * print is delegated across the `LocalPdfAdapter` boundary. So the way to prove
 * the engine actually assembled a package is to record what it asked this
 * adapter to do and assert on the recording, rather than trusting the engine's
 * own report of its own success.
 *
 * The fake is deliberately strict about the contract the engine relies on: an
 * artifact's declared digest and page count must match what a later inspection
 * of that same artifact reports, and a merge must report the summed page count.
 * A fake that was lax about those would let a real regression through.
 */

const HEX = "0123456789abcdef";

/** A syntactically valid but obviously fabricated digest, distinct per label. */
export const fakeDigest = (seed: number): string =>
  Array.from({ length: 64 }, (_, index) => HEX[(seed + index) % 16]).join("");

export interface FakeInspection {
  validPdf: boolean;
  pageCount: number;
  sha256: string;
  encrypted: boolean;
  activeContentDetected: boolean;
  embeddedFilesDetected: boolean;
  physicalFields: readonly string[];
}

export interface RecordedFill {
  readonly documentId: string;
  readonly assignments: readonly { physicalField: string; value: string | boolean }[];
}

export const LOCAL_ONLY_CAPABILITIES = {
  networkAccess: "disabled",
  storage: "local-only",
  atomicWrites: true,
  supportedOperations: ["inspect", "fill", "overlay", "merge", "preview", "export", "print"],
  prohibitedOperations: [
    "NETFILE",
    "EFILE",
    "electronic submission",
    "direct CRA transmission",
    "simulated filing",
    "automatic filing",
  ],
} as const;

export class FakePdfAdapter {
  capabilities: unknown = LOCAL_ONLY_CAPABILITIES;

  readonly inspections = new Map<string, FakeInspection>();
  readonly fills: RecordedFill[] = [];
  readonly overlays: RecordedFill[] = [];
  readonly merges: (readonly string[])[] = [];
  readonly previews: string[] = [];
  readonly exports: { handle: string; destination: string; authorization: unknown }[] = [];
  readonly prints: { handle: string; authorization: unknown }[] = [];

  /** Filled outputs, keyed by the template handle they were produced from. */
  readonly outputs = new Map<string, { localHandle: string; displayName: string; pageCount: number; sha256: string }>();

  mergedArtifact = { localHandle: "package.pdf", displayName: "Mail-in package", sha256: fakeDigest(9), pageCount: 0 };

  register(handle: string, inspection: Partial<FakeInspection> & { sha256: string; pageCount: number }): void {
    this.inspections.set(handle, {
      validPdf: true,
      encrypted: false,
      activeContentDetected: false,
      embeddedFilesDetected: false,
      physicalFields: [],
      ...inspection,
    });
  }

  async inspect(input: { localHandle: string }): Promise<FakeInspection> {
    const inspection = this.inspections.get(input.localHandle);
    if (inspection === undefined) throw new Error(`The fake adapter has no inspection for ${input.localHandle}.`);
    return inspection;
  }

  async fillOfficialTemplate(
    template: { localHandle: string; documentId: string },
    assignments: readonly { physicalField: string; value: string | boolean }[],
  ) {
    this.fills.push({ documentId: template.documentId, assignments });
    return this.#output(template.localHandle);
  }

  async overlayOfficialPrintTemplate(
    template: { localHandle: string; documentId: string },
    assignments: readonly { physicalField: string; value: string | boolean }[],
  ) {
    this.overlays.push({ documentId: template.documentId, assignments });
    return this.#output(template.localHandle);
  }

  async merge(inputs: readonly { localHandle: string; pageCount: number }[]) {
    this.merges.push(inputs.map((input) => input.localHandle));
    // The engine independently checks that the merged page count is the sum of
    // its inputs, so the fake must actually do the addition.
    const pageCount = inputs.reduce((total, input) => total + input.pageCount, 0);
    const artifact = { ...this.mergedArtifact, pageCount };
    this.register(artifact.localHandle, { sha256: artifact.sha256, pageCount });
    return artifact;
  }

  async preview(input: { localHandle: string }) {
    this.previews.push(input.localHandle);
    return { localHandle: `${input.localHandle}.preview`, displayName: "Preview" };
  }

  async exportAtomically(
    input: { localHandle: string },
    destinationLocalHandle: string,
    authorization: unknown,
  ): Promise<void> {
    this.exports.push({ handle: input.localHandle, destination: destinationLocalHandle, authorization });
  }

  async printLocally(input: { localHandle: string }, authorization: unknown): Promise<void> {
    this.prints.push({ handle: input.localHandle, authorization });
  }

  #output(templateHandle: string) {
    const output = this.outputs.get(templateHandle);
    if (output === undefined) throw new Error(`The fake adapter has no output for ${templateHandle}.`);
    return output;
  }
}
