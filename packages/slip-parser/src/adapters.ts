import type {
  AdmittedDocument,
  ParserIssue,
  TextExtractionAdapter,
} from "./types.js";

function validateAdapter(adapter: TextExtractionAdapter): ParserIssue | null {
  const proof = adapter.proof;
  if (
    proof.bundled !== true ||
    proof.declared !== true ||
    proof.offline !== true ||
    proof.networkAccess !== "forbidden" ||
    proof.telemetry !== "none" ||
    !proof.declaredInPackage.startsWith("packages/slip-parser/") ||
    proof.artifactId.trim().length === 0 ||
    proof.artifactVersion.trim().length === 0 ||
    proof.runtimeId.trim().length === 0
  ) {
    return {
      id: `adapter:${adapter.id}:runtime-unproven`,
      code: "adapter-runtime-unproven",
      severity: "error",
      message: `Adapter ${adapter.id} is disabled because its bundled offline runtime and exact artifact declaration are incomplete.`,
    };
  }
  if (!/^[a-z0-9][a-z0-9._:-]{2,127}$/i.test(adapter.id)) {
    return {
      id: "adapter:invalid-id",
      code: "adapter-runtime-unproven",
      severity: "error",
      message: "An adapter is disabled because its identifier is invalid.",
    };
  }
  return null;
}

export class AdapterRegistry {
  readonly #adapters: readonly TextExtractionAdapter[];
  readonly #registrationIssues: readonly ParserIssue[];

  constructor(adapters: readonly TextExtractionAdapter[]) {
    const enabled: TextExtractionAdapter[] = [];
    const issues: ParserIssue[] = [];
    const ids = new Set<string>();
    for (const adapter of adapters) {
      const validationIssue = validateAdapter(adapter);
      if (validationIssue) {
        issues.push(validationIssue);
        continue;
      }
      if (ids.has(adapter.id)) {
        issues.push({
          id: `adapter:${adapter.id}:duplicate`,
          code: "adapter-runtime-unproven",
          severity: "error",
          message: `Adapter ${adapter.id} is disabled because its identifier is duplicated.`,
        });
        continue;
      }
      ids.add(adapter.id);
      enabled.push(adapter);
    }
    this.#adapters = Object.freeze(enabled.slice());
    this.#registrationIssues = Object.freeze(issues.slice());
  }

  get registrationIssues(): readonly ParserIssue[] {
    return this.#registrationIssues;
  }

  select(document: AdmittedDocument): TextExtractionAdapter | null {
    return (
      this.#adapters.find(
        (adapter) => adapter.supportedKinds.includes(document.kind) && adapter.canExtract(document),
      ) ?? null
    );
  }

  listEnabled(): readonly {
    readonly id: string;
    readonly supportedKinds: TextExtractionAdapter["supportedKinds"];
    readonly artifactId: string;
    readonly artifactVersion: string;
    readonly runtimeId: string;
  }[] {
    return this.#adapters.map((adapter) => ({
      id: adapter.id,
      supportedKinds: adapter.supportedKinds,
      artifactId: adapter.proof.artifactId,
      artifactVersion: adapter.proof.artifactVersion,
      runtimeId: adapter.proof.runtimeId,
    }));
  }
}
