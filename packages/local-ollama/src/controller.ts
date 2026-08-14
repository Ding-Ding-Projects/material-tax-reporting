import {
  filterCatalogVariants,
  refreshOfficialCatalog,
  type CatalogRefreshOptions,
  type OfficialCatalogCache,
  type OfficialCatalogSnapshot,
} from "./catalog.js";
import { LocalChatManager, type ChatHistoryStore, type ChatStreamChunk } from "./chat.js";
import { assessHardwareFit, type HardwareEvidence, type ModelFitEvidence } from "./hardware-fit.js";
import {
  AllowlistedHarnessManager,
  PREBUILT_HARNESS_PROFILES,
  type HarnessLaunchSelection,
} from "./harness.js";
import {
  PersistentPullQueue,
  type PullGateway,
  type PullProgress,
  type PullQueueStore,
  type StoragePreflight,
} from "./pull-queue.js";
import type {
  LocalOllamaSuiteActions,
  LocalOllamaSuiteState,
  LocalOllamaTab,
  LocalRuntimeModel,
  RuntimeHealth,
} from "./surface.js";

export interface RuntimeProbe {
  health: RuntimeHealth;
  version: string | null;
  message: string;
  nextAction: string;
}

export interface LocalOllamaBridge extends PullGateway {
  probe(): Promise<RuntimeProbe>;
  installedModels(): Promise<LocalRuntimeModel[]>;
  runningModels(): Promise<LocalRuntimeModel[]>;
  copyModel(source: string, destination: string): Promise<void>;
  deleteModel(reference: string): Promise<void>;
  chatStream(
    request: {
      model: string;
      messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string; images?: string[] }>;
      options: Record<string, string | number | boolean>;
    },
    signal: AbortSignal,
  ): AsyncIterable<ChatStreamChunk>;
}

export interface HardwareEvidenceSource {
  collect(): Promise<HardwareEvidence>;
  modelEvidence(reference: string): Promise<ModelFitEvidence>;
}

export interface FolderPicker {
  chooseFolder(): Promise<string | null>;
}

export interface ObservablePullQueueStore extends PullQueueStore {
  subscribe?(listener: () => void): () => void;
}

export interface LocalOllamaSuiteControllerOptions {
  catalogCache: OfficialCatalogCache;
  catalogRefresh?: CatalogRefreshOptions;
  bridge: LocalOllamaBridge;
  hardware: HardwareEvidenceSource;
  pullStore: ObservablePullQueueStore;
  storage: StoragePreflight;
  chatStore: ChatHistoryStore;
  harnesses: AllowlistedHarnessManager;
  folderPicker: FolderPicker;
  now?: () => Date;
}

function initialState(): LocalOllamaSuiteState {
  return {
    activeTab: "store",
    busy: false,
    runtime: {
      health: "missing",
      version: null,
      message: "The local runtime has not been checked.",
      nextAction: "Select Recheck local runtime.",
    },
    catalog: {
      snapshot: null,
      visibleVariants: [],
      query: "",
      regex: { enabled: false, pattern: "", flags: "i", error: null },
      refreshState: "idle",
      refreshMessage: null,
    },
    installed: [],
    running: [],
    fitByReference: {},
    queue: [],
    chat: {
      sessionId: null,
      model: "",
      systemPrompt: "",
      transcript: [],
      streamingText: "",
      sending: false,
      error: null,
    },
    harness: {
      profiles: PREBUILT_HARNESS_PROFILES,
      selectedProfileId: PREBUILT_HARNESS_PROFILES[0]?.id ?? null,
      selectedExecutableId: null,
      workingDirectory: "",
      preview: null,
      status: null,
    },
  };
}

export class LocalOllamaSuiteController implements LocalOllamaSuiteActions {
  readonly #options: LocalOllamaSuiteControllerOptions;
  readonly #queue: PersistentPullQueue;
  readonly #chat: LocalChatManager;
  readonly #listeners = new Set<(state: LocalOllamaSuiteState) => void>();
  readonly #now: () => Date;
  #state = initialState();
  #unsubscribeQueue: (() => void) | null = null;
  #pendingHarnessSelection: HarnessLaunchSelection | null = null;

  constructor(options: LocalOllamaSuiteControllerOptions) {
    this.#options = options;
    this.#now = options.now ?? (() => new Date());
    this.#queue = new PersistentPullQueue(options.pullStore, options.bridge, options.storage);
    this.#chat = new LocalChatManager(options.chatStore, options.bridge);
    this.#unsubscribeQueue = options.pullStore.subscribe?.(() => void this.#loadQueuePage()) ?? null;
  }

  dispose(): void {
    this.#unsubscribeQueue?.();
    this.#unsubscribeQueue = null;
    this.#listeners.clear();
  }

  snapshot(): LocalOllamaSuiteState {
    return structuredClone(this.#state);
  }

  subscribe(listener: (state: LocalOllamaSuiteState) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async initialize(): Promise<void> {
    const cached = await this.#options.catalogCache.read();
    if (cached) {
      const refreshedAt = Date.parse(cached.refreshedAt);
      const stale = !Number.isFinite(refreshedAt) || this.#now().getTime() - refreshedAt > cached.staleAfterMs;
      this.#applyCatalog({ ...cached, stale }, stale ? "stale-cache" : "idle", stale ? "The verified official catalog cache is stale." : null);
    }
    await this.#queue.reconcile();
    await Promise.all([this.refreshRuntime(), this.#loadQueuePage()]);
  }

  selectTab(tab: LocalOllamaTab): void {
    this.#state.activeTab = tab;
    this.#emit();
  }

  async refreshRuntime(): Promise<void> {
    this.#state.busy = true;
    this.#emit();
    try {
      const probe = await this.#options.bridge.probe();
      this.#state.runtime = probe;
      if (probe.health === "healthy") {
        const [installed, running] = await Promise.all([
          this.#options.bridge.installedModels(),
          this.#options.bridge.runningModels(),
        ]);
        this.#state.installed = installed;
        this.#state.running = running;
        if (!this.#state.chat.model && installed[0]) this.#state.chat.model = installed[0].reference;
        await this.#refreshFitEvidence();
      } else {
        this.#state.installed = [];
        this.#state.running = [];
      }
    } catch (error) {
      this.#state.runtime = {
        health: "unhealthy",
        version: null,
        message: error instanceof Error ? error.message : String(error),
        nextAction: "Confirm the local Ollama service is running, then recheck. No cloud fallback is used.",
      };
    } finally {
      this.#state.busy = false;
      this.#emit();
    }
  }

  async refreshCatalog(): Promise<void> {
    this.#state.catalog.refreshState = "refreshing";
    this.#state.catalog.refreshMessage = "Refreshing every official model and tag page.";
    this.#emit();
    const result = await refreshOfficialCatalog(this.#options.catalogCache, this.#options.catalogRefresh);
    if (result.snapshot) this.#applyCatalog(result.snapshot, result.state, result.reason);
    else {
      this.#state.catalog.refreshState = result.state;
      this.#state.catalog.refreshMessage = result.reason;
      this.#emit();
    }
  }

  setCatalogSearch(input: { query: string; regexEnabled: boolean; pattern: string; flags: string }): void {
    this.#state.catalog.query = input.query;
    this.#state.catalog.regex.enabled = input.regexEnabled;
    this.#state.catalog.regex.pattern = input.pattern;
    this.#state.catalog.regex.flags = input.flags;
    this.#state.catalog.regex.error = null;
    if (input.regexEnabled) {
      try {
        if (input.pattern.length > 512) throw new Error("The pattern exceeds 512 characters.");
        if (!/^[dgimsuvy]*$/.test(input.flags)) throw new Error("Only JavaScript regular-expression flags are supported.");
        void new RegExp(input.pattern, input.flags);
      } catch (error) {
        this.#state.catalog.regex.error = error instanceof Error ? error.message : String(error);
      }
    }
    this.#filterVisibleVariants();
    this.#emit();
  }

  async enqueuePull(reference: string): Promise<void> {
    const variant = this.#state.catalog.snapshot?.variants.find((candidate) => candidate.reference === reference);
    if (!variant) throw new Error("Choose a variant from the verified official catalog.");
    if (variant.sizeBytes === null) throw new Error("The official source did not report a size, so storage preflight cannot approve this pull.");
    await this.#queue.enqueue(reference, variant.sizeBytes);
    await this.#loadQueuePage();
    void this.#queue.run().finally(() => void this.#loadQueuePage());
  }

  pauseQueue(): void {
    this.#queue.pause();
  }

  async resumeQueue(): Promise<void> {
    await this.#queue.resume();
    await this.#loadQueuePage();
    void this.#queue.run().finally(() => void this.#loadQueuePage());
  }

  async cancelPull(id: string): Promise<void> {
    await this.#queue.cancel(id);
    await this.#loadQueuePage();
  }

  async retryPull(id: string): Promise<void> {
    await this.#queue.retry(id);
    await this.#loadQueuePage();
    void this.#queue.run().finally(() => void this.#loadQueuePage());
  }

  async copyModel(source: string, destination: string): Promise<void> {
    const normalized = destination.trim();
    if (!normalized) throw new Error("Enter a destination model name.");
    await this.#options.bridge.copyModel(source, normalized);
    await this.refreshRuntime();
  }

  async deleteModel(reference: string): Promise<void> {
    await this.#options.bridge.deleteModel(reference);
    await this.refreshRuntime();
  }

  async sendChat(input: {
    model: string;
    systemPrompt: string;
    content: string;
    containsTaxData: boolean;
    reviewedTaxData: boolean;
  }): Promise<void> {
    const installed = this.#state.installed.find((candidate) => candidate.reference === input.model);
    if (!installed) throw new Error("Choose an installed local model.");
    this.#state.chat.sending = true;
    this.#state.chat.error = null;
    this.#state.chat.streamingText = "";
    this.#state.chat.model = input.model;
    this.#state.chat.systemPrompt = input.systemPrompt;
    this.#emit();
    try {
      if (!this.#state.chat.sessionId) {
        const session = await this.#chat.createSession({
          title: "Local model chat",
          model: input.model,
          systemPrompt: input.systemPrompt,
          capabilities: installed.capabilities,
        });
        this.#state.chat.sessionId = session.id;
      }
      const sessionId = this.#state.chat.sessionId;
      if (!sessionId) throw new Error("The local chat session could not be created.");
      for await (const chunk of this.#chat.send(sessionId, {
        content: input.content,
        containsTaxData: input.containsTaxData,
        ...(input.containsTaxData && input.reviewedTaxData ? { reviewedTaxDataAt: this.#now().toISOString() } : {}),
      })) {
        this.#state.chat.streamingText += chunk.content;
        this.#emit();
      }
      this.#state.chat.transcript.push(
        { role: "user", content: input.content },
        { role: "assistant", content: this.#state.chat.streamingText },
      );
      this.#state.chat.streamingText = "";
    } catch (error) {
      this.#state.chat.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.#state.chat.sending = false;
      this.#emit();
    }
  }

  stopChat(): void {
    if (this.#state.chat.sessionId) this.#chat.stop(this.#state.chat.sessionId);
  }

  selectHarnessProfile(profileId: string): void {
    if (!this.#state.harness.profiles.some((profile) => profile.id === profileId)) return;
    this.#state.harness.selectedProfileId = profileId;
    this.#state.harness.preview = null;
    this.#state.harness.status = null;
    this.#emit();
  }

  async chooseWorkingDirectory(): Promise<string | null> {
    const selected = await this.#options.folderPicker.chooseFolder();
    if (selected) {
      this.#state.harness.workingDirectory = selected;
      this.#state.harness.preview = null;
      this.#emit();
    }
    return selected;
  }

  async previewHarness(input: { profileId: string; executableId: string; workingDirectory: string; model: string }): Promise<void> {
    const selection: HarnessLaunchSelection = {
      profileId: input.profileId,
      executableId: input.executableId,
      workingDirectory: input.workingDirectory,
      model: input.model,
      environment: { OLLAMA_HOST: "http://127.0.0.1:11434", OLLAMA_MODEL: input.model },
    };
    this.#pendingHarnessSelection = selection;
    this.#state.harness.selectedExecutableId = input.executableId;
    this.#state.harness.workingDirectory = input.workingDirectory;
    this.#state.harness.preview = await this.#options.harnesses.preview(selection);
    this.#state.harness.status = this.#state.harness.preview.blockers.length
      ? "Resolve every listed blocker before launch."
      : "Preview ready. Launch will create a snapshot and roll back automatically if readiness fails.";
    this.#emit();
  }

  async launchHarness(): Promise<void> {
    if (!this.#pendingHarnessSelection || !this.#state.harness.preview) throw new Error("Review the harness launch first.");
    this.#state.harness.status = "Launching the reviewed allowlisted harness.";
    this.#emit();
    try {
      const result = await this.#options.harnesses.launch(this.#pendingHarnessSelection);
      this.#state.harness.status = `Harness process ${result.processId} is ready. Snapshot ${result.snapshotId} is available for restore.`;
    } catch (error) {
      this.#state.harness.status = error instanceof Error ? error.message : String(error);
    }
    this.#emit();
  }

  #applyCatalog(
    snapshot: OfficialCatalogSnapshot,
    refreshState: LocalOllamaSuiteState["catalog"]["refreshState"],
    message: string | null,
  ): void {
    this.#state.catalog.snapshot = snapshot;
    this.#state.catalog.refreshState = refreshState;
    this.#state.catalog.refreshMessage = message;
    this.#filterVisibleVariants();
    this.#emit();
    void this.#refreshFitEvidence();
  }

  #filterVisibleVariants(): void {
    const variants = this.#state.catalog.snapshot?.variants ?? [];
    if (this.#state.catalog.regex.error) {
      this.#state.catalog.visibleVariants = [];
      return;
    }
    this.#state.catalog.visibleVariants = filterCatalogVariants(variants, {
      query: this.#state.catalog.query,
      ...(this.#state.catalog.regex.enabled
        ? { regex: { pattern: this.#state.catalog.regex.pattern, flags: this.#state.catalog.regex.flags } }
        : {}),
    }).slice(0, 200);
  }

  async #refreshFitEvidence(): Promise<void> {
    const snapshot = this.#state.catalog.snapshot;
    if (!snapshot) return;
    const hardware = await this.#options.hardware.collect();
    const references = new Set([
      ...this.#state.catalog.visibleVariants.map((variant) => variant.reference),
      ...this.#state.installed.map((model) => model.reference),
    ]);
    const fits: Record<string, ReturnType<typeof assessHardwareFit>> = {};
    for (const reference of references) {
      const catalog = snapshot.variants.find((variant) => variant.reference === reference);
      const evidence = await this.#options.hardware.modelEvidence(reference);
      fits[reference] = assessHardwareFit(hardware, {
        ...evidence,
        reference,
        blobSizeBytes: evidence.blobSizeBytes ?? catalog?.sizeBytes ?? null,
      }, this.#now());
    }
    this.#state.fitByReference = fits;
    this.#emit();
  }

  async #loadQueuePage(): Promise<void> {
    this.#state.queue = await this.#options.pullStore.readBatch(
      ["queued", "preflighting", "pulling", "paused", "failed", "cancelled", "completed", "skipped"],
      null,
      100,
    );
    this.#emit();
  }

  #emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.#listeners) listener(snapshot);
  }
}
