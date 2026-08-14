import { OllamaLoopbackClient } from "./client.js";
import type { LocalOllamaBridge, RuntimeProbe } from "./controller.js";
import type { ChatStreamChunk } from "./chat.js";
import type { HardwareEvidenceSource } from "./controller.js";
import type { HardwareEvidence, ModelFitEvidence } from "./hardware-fit.js";
import type { PullProgress } from "./pull-queue.js";
import type { LocalRuntimeModel } from "./surface.js";
import type { OllamaChatMessage, OllamaJsonObject, OllamaModelSummary, OllamaShowModelResponse } from "./types.js";

export interface OllamaInstallationProbe {
  isInstalled(): Promise<boolean>;
}

export class OllamaPrivilegedBridgeAdapter implements LocalOllamaBridge {
  readonly #client: OllamaLoopbackClient;
  readonly #installation: OllamaInstallationProbe | null;

  constructor(client: OllamaLoopbackClient, installation?: OllamaInstallationProbe) {
    this.#client = client;
    this.#installation = installation ?? null;
  }

  async probe(): Promise<RuntimeProbe> {
    const health = await this.#client.health();
    if (health.status === "healthy") {
      return {
        health: "healthy",
        version: health.version?.version ?? null,
        message: "The documented local API is healthy.",
        nextAction: "Browse installed models, refresh the official catalog, or start a local chat.",
      };
    }
    if (health.status === "unhealthy") {
      const failedChecks = Object.entries(health.checks)
        .filter(([, check]) => !check.ok)
        .map(([name, check]) => `${name}: ${check.error?.message ?? "unknown failure"}`)
        .join(" ");
      return {
        health: "unhealthy",
        version: health.version?.version ?? null,
        message: failedChecks || "The local API returned an unhealthy response.",
        nextAction: "Use the bundled troubleshooter, correct the reported local API failure, then recheck.",
      };
    }
    if (!this.#installation) {
      return {
        health: "missing-or-stopped",
        version: null,
        message: "The local API is unreachable; the documented HTTP interface cannot distinguish an absent installation from a stopped service.",
        nextAction: "Use the bundled official installation/start guidance, then recheck. No cloud fallback is used.",
      };
    }
    const installed = await this.#installation.isInstalled();
    return installed
      ? {
          health: "stopped",
          version: null,
          message: "Ollama is installed, but its local API is not running.",
          nextAction: "Start the installed local Ollama service, then recheck.",
        }
      : {
          health: "missing",
          version: null,
          message: "Ollama is not installed and the local API is unavailable.",
          nextAction: "Use the bundled official installation guidance, then return and recheck.",
        };
  }

  async installedModels(): Promise<LocalRuntimeModel[]> {
    const response = await this.#client.listModels();
    return this.#enrich(response.models);
  }

  async runningModels(): Promise<LocalRuntimeModel[]> {
    const response = await this.#client.runningModels();
    const capabilitiesByReference = new Map(
      (await this.#enrich(response.models)).map((model) => [model.reference, model.capabilities]),
    );
    return response.models.map((model) => ({
      reference: model.model || model.name,
      sizeBytes: model.size,
      digest: model.digest,
      parameterSize: model.details.parameter_size,
      quantization: model.details.quantization_level,
      capabilities: capabilitiesByReference.get(model.model || model.name) ?? [],
    }));
  }

  async installedReferences(): Promise<Set<string>> {
    const response = await this.#client.listModels();
    return new Set(response.models.map((model) => model.model || model.name));
  }

  pull(reference: string, signal: AbortSignal): AsyncIterable<PullProgress> {
    return this.#client.pull({ model: reference }, { signal });
  }

  async copyModel(source: string, destination: string): Promise<void> {
    await this.#client.copyModel({ source, destination });
  }

  async deleteModel(reference: string): Promise<void> {
    await this.#client.deleteModel({ model: reference });
  }

  async *chatStream(
    request: {
      model: string;
      messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string; images?: string[] }>;
      options: Record<string, string | number | boolean>;
    },
    signal: AbortSignal,
  ): AsyncIterable<ChatStreamChunk> {
    const messages: OllamaChatMessage[] = request.messages.map((message) => ({ ...message }));
    const options: OllamaJsonObject = { ...request.options };
    for await (const response of this.#client.chatStream(
      { model: request.model, messages, options },
      { signal },
    )) {
      yield {
        content: response.message.content,
        ...(response.message.thinking ? { thinking: response.message.thinking } : {}),
        done: response.done,
        ...(response.done_reason ? { doneReason: response.done_reason } : {}),
      };
    }
  }

  async #enrich(models: OllamaModelSummary[]): Promise<LocalRuntimeModel[]> {
    const results: LocalRuntimeModel[] = [];
    for (let index = 0; index < models.length; index += 4) {
      const chunk = models.slice(index, index + 4);
      results.push(...await Promise.all(chunk.map(async (model) => {
        let shown: OllamaShowModelResponse | null = null;
        try {
          shown = await this.#client.show({ model: model.model || model.name });
        } catch {
          shown = null;
        }
        return {
          reference: model.model || model.name,
          sizeBytes: model.size,
          digest: model.digest,
          parameterSize: model.details.parameter_size,
          quantization: model.details.quantization_level,
          capabilities: shown?.capabilities ?? [],
        };
      })));
    }
    return results;
  }
}

export interface PlatformHardwareReader {
  collect(): Promise<HardwareEvidence>;
  contextBytesPerToken(reference: string): Promise<number | null>;
}

function parseParameterCount(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^(\d+(?:\.\d+)?)([KMBT])$/i.exec(value.trim());
  if (!match?.[1] || !match[2]) return null;
  const multipliers: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
  const multiplier = multipliers[match[2].toUpperCase()];
  return multiplier ? Number(match[1]) * multiplier : null;
}

function contextLengthFromShow(show: OllamaShowModelResponse): number | null {
  for (const [key, value] of Object.entries(show.model_info ?? {})) {
    if (key.endsWith(".context_length") && typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

export class OllamaHardwareEvidenceSource implements HardwareEvidenceSource {
  readonly #client: OllamaLoopbackClient;
  readonly #hardware: PlatformHardwareReader;

  constructor(client: OllamaLoopbackClient, hardware: PlatformHardwareReader) {
    this.#client = client;
    this.#hardware = hardware;
  }

  collect(): Promise<HardwareEvidence> {
    return this.#hardware.collect();
  }

  async modelEvidence(reference: string): Promise<ModelFitEvidence> {
    const [listed, shown, contextBytesPerToken] = await Promise.all([
      this.#client.listModels(),
      this.#client.show({ model: reference }).catch(() => null),
      this.#hardware.contextBytesPerToken(reference),
    ]);
    const model = listed.models.find((candidate) => candidate.model === reference || candidate.name === reference);
    return {
      reference,
      blobSizeBytes: model?.size ?? null,
      parameterCount: parseParameterCount(shown?.details?.parameter_size ?? model?.details.parameter_size),
      quantization: shown?.details?.quantization_level ?? model?.details.quantization_level ?? null,
      contextLength: shown ? contextLengthFromShow(shown) : null,
      contextBytesPerToken,
    };
  }
}
