import type { OfficialCatalogSnapshot, OfficialCatalogVariant } from "./catalog.js";
import type { HardwareFitAssessment } from "./hardware-fit.js";
import type { HarnessLaunchPreview, HarnessProfile } from "./harness.js";
import type { PullQueueItem } from "./pull-queue.js";

export type RuntimeHealth = "missing" | "stopped" | "missing-or-stopped" | "unhealthy" | "healthy";
export type LocalOllamaTab = "store" | "queue" | "chat" | "harness" | "troubleshooter";

export interface LocalRuntimeModel {
  reference: string;
  sizeBytes: number | null;
  digest: string | null;
  parameterSize: string | null;
  quantization: string | null;
  capabilities: string[];
}

export interface LocalOllamaSuiteState {
  activeTab: LocalOllamaTab;
  busy: boolean;
  runtime: {
    health: RuntimeHealth;
    version: string | null;
    message: string;
    nextAction: string;
  };
  catalog: {
    snapshot: OfficialCatalogSnapshot | null;
    visibleVariants: OfficialCatalogVariant[];
    query: string;
    regex: { enabled: boolean; pattern: string; flags: string; error: string | null };
    refreshState: "idle" | "refreshing" | "fresh" | "stale-cache" | "incomplete" | "unavailable";
    refreshMessage: string | null;
  };
  installed: LocalRuntimeModel[];
  running: LocalRuntimeModel[];
  fitByReference: Record<string, HardwareFitAssessment>;
  queue: PullQueueItem[];
  chat: {
    sessionId: string | null;
    model: string;
    systemPrompt: string;
    transcript: Array<{ role: string; content: string }>;
    streamingText: string;
    sending: boolean;
    error: string | null;
  };
  harness: {
    profiles: readonly HarnessProfile[];
    selectedProfileId: string | null;
    selectedExecutableId: string | null;
    workingDirectory: string;
    preview: HarnessLaunchPreview | null;
    status: string | null;
  };
}

export interface LocalOllamaSuiteActions {
  subscribe(listener: (state: LocalOllamaSuiteState) => void): () => void;
  snapshot(): LocalOllamaSuiteState;
  selectTab(tab: LocalOllamaTab): void;
  refreshRuntime(): Promise<void>;
  refreshCatalog(): Promise<void>;
  setCatalogSearch(input: { query: string; regexEnabled: boolean; pattern: string; flags: string }): void;
  enqueuePull(reference: string): Promise<void>;
  pauseQueue(): void;
  resumeQueue(): Promise<void>;
  cancelPull(id: string): Promise<void>;
  retryPull(id: string): Promise<void>;
  copyModel(source: string, destination: string): Promise<void>;
  deleteModel(reference: string): Promise<void>;
  sendChat(input: {
    model: string;
    systemPrompt: string;
    content: string;
    containsTaxData: boolean;
    reviewedTaxData: boolean;
  }): Promise<void>;
  stopChat(): void;
  selectHarnessProfile(profileId: string): void;
  chooseWorkingDirectory(): Promise<string | null>;
  previewHarness(input: { profileId: string; executableId: string; workingDirectory: string; model: string }): Promise<void>;
  launchHarness(): Promise<void>;
}

const TAB_LABELS: ReadonlyArray<{ id: LocalOllamaTab; label: string }> = [
  { id: "store", label: "Model Store" },
  { id: "queue", label: "Pull queue" },
  { id: "chat", label: "Local chat" },
  { id: "harness", label: "Harnesses" },
  { id: "troubleshooter", label: "Troubleshooter" },
];

function element<K extends keyof HTMLElementTagNameMap>(name: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(name);
  if (className) node.className = className;
  return node;
}

function button(label: string, action: () => void, disabled = false): HTMLButtonElement {
  const node = element("button", "ollama-button");
  node.type = "button";
  node.textContent = label;
  node.disabled = disabled;
  node.addEventListener("click", action);
  return node;
}

function statusText(state: LocalOllamaSuiteState): string {
  const version = state.runtime.version ? ` ${state.runtime.version}` : "";
  return `${state.runtime.health}${version}: ${state.runtime.message}`;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return "Size unavailable";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1000 && index < units.length - 1) {
    value /= 1000;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function renderStore(state: LocalOllamaSuiteState, actions: LocalOllamaSuiteActions): HTMLElement {
  const panel = element("section", "ollama-panel");
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", "ollama-tab-store");

  const heading = element("h2");
  heading.textContent = "Official model store";
  panel.append(heading);
  const disclosure = element("p", "ollama-supporting-text");
  disclosure.textContent = "The cart schedules local model pulls only. There is no purchase, price, account, or cloud entitlement.";
  panel.append(disclosure);

  const toolbar = element("div", "ollama-toolbar");
  const search = element("input", "ollama-field");
  search.type = "search";
  search.value = state.catalog.query;
  search.placeholder = "Filter model, tag, size, or quantization";
  search.setAttribute("aria-label", "Filter official model variants");
  const regexPanel = element("details", "ollama-regex-builder");
  const summary = element("summary");
  summary.textContent = "Regex builder";
  regexPanel.append(summary);
  const regexEnabled = element("input");
  regexEnabled.type = "checkbox";
  regexEnabled.checked = state.catalog.regex.enabled;
  regexEnabled.setAttribute("aria-label", "Use regular expression matching");
  const pattern = element("input", "ollama-field");
  pattern.value = state.catalog.regex.pattern;
  pattern.placeholder = "Pattern";
  pattern.setAttribute("aria-label", "Regular expression pattern");
  const flags = element("input", "ollama-field");
  flags.value = state.catalog.regex.flags;
  flags.placeholder = "Flags, for example i";
  flags.setAttribute("aria-label", "Regular expression flags");
  const syncSearch = (): void => actions.setCatalogSearch({
    query: search.value,
    regexEnabled: regexEnabled.checked,
    pattern: pattern.value,
    flags: flags.value,
  });
  search.addEventListener("input", syncSearch);
  regexEnabled.addEventListener("change", syncSearch);
  pattern.addEventListener("input", syncSearch);
  flags.addEventListener("input", syncSearch);
  regexPanel.append(regexEnabled, document.createTextNode(" Regex mode"), pattern, flags);
  if (state.catalog.regex.error) {
    const error = element("p", "ollama-error");
    error.setAttribute("role", "alert");
    error.textContent = state.catalog.regex.error;
    regexPanel.append(error);
  }
  toolbar.append(
    search,
    regexPanel,
    button("Refresh official catalog", () => void actions.refreshCatalog(), state.catalog.refreshState === "refreshing"),
  );
  panel.append(toolbar);

  const metadata = element("p", "ollama-supporting-text");
  const snapshot = state.catalog.snapshot;
  metadata.textContent = snapshot
    ? `${snapshot.modelCount} official models, ${snapshot.variantCount} variants, ${snapshot.complete ? "complete" : "incomplete"}; refreshed ${snapshot.refreshedAt}; source ${snapshot.sourceIdentity}.`
    : state.catalog.refreshMessage ?? "No verified official catalog is cached yet.";
  panel.append(metadata);

  const list = element("ul", "ollama-card-list");
  list.setAttribute("aria-label", "Official model variants");
  for (const variant of state.catalog.visibleVariants) {
    const item = element("li", "ollama-card");
    const title = element("h3");
    title.textContent = variant.reference;
    const details = element("p");
    details.textContent = [formatBytes(variant.sizeBytes), variant.parameterSize, variant.quantization]
      .filter(Boolean)
      .join(" · ");
    const fit = state.fitByReference[variant.reference];
    const fitText = element("p", "ollama-fit");
    fitText.textContent = fit
      ? `${fit.verdict}: ${fit.reasons.join(" ")}`
      : "Unknown: hardware or model evidence has not been collected.";
    item.append(title, details, fitText, button("Add to pull queue", () => void actions.enqueuePull(variant.reference), variant.sizeBytes === null));
    list.append(item);
  }
  if (state.catalog.visibleVariants.length === 0) {
    const empty = element("p", "ollama-empty");
    empty.textContent = "No verified variants match the current filter.";
    panel.append(empty);
  } else panel.append(list);

  const installedHeading = element("h2");
  installedHeading.textContent = "Installed local models";
  panel.append(installedHeading);
  const installedList = element("ul", "ollama-card-list");
  for (const installed of state.installed) {
    const item = element("li", "ollama-card");
    const title = element("h3");
    title.textContent = installed.reference;
    const facts = element("p");
    facts.textContent = [formatBytes(installed.sizeBytes), installed.parameterSize, installed.quantization, ...installed.capabilities]
      .filter(Boolean)
      .join(" · ");
    const copyDestination = element("input", "ollama-field");
    copyDestination.value = `${installed.reference}-copy`;
    copyDestination.setAttribute("aria-label", `Copy destination for ${installed.reference}`);
    const copyAction = button("Copy local model", () => void actions.copyModel(installed.reference, copyDestination.value));
    const deleteDetails = element("details", "ollama-delete-confirmation");
    const deleteSummary = element("summary");
    deleteSummary.textContent = `Delete ${installed.reference}…`;
    const warning = element("p");
    warning.textContent = `This removes the local model ${installed.reference}. Pull it again to restore it.`;
    const keyOne = element("input");
    keyOne.type = "checkbox";
    keyOne.setAttribute("aria-label", `First confirmation key for deleting ${installed.reference}`);
    const keyTwo = element("input");
    keyTwo.type = "checkbox";
    keyTwo.setAttribute("aria-label", `Second confirmation key for deleting ${installed.reference}`);
    const slider = element("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.value = "0";
    slider.disabled = true;
    slider.setAttribute("aria-label", `Final confirmation slider for deleting ${installed.reference}`);
    const deleteAction = button("Delete local model", () => void actions.deleteModel(installed.reference), true);
    const updateDeleteState = (): void => {
      slider.disabled = !(keyOne.checked && keyTwo.checked);
      deleteAction.disabled = slider.disabled || slider.value !== "100";
    };
    keyOne.addEventListener("change", updateDeleteState);
    keyTwo.addEventListener("change", updateDeleteState);
    slider.addEventListener("input", updateDeleteState);
    deleteDetails.append(
      deleteSummary,
      warning,
      keyOne,
      document.createTextNode(" First key "),
      keyTwo,
      document.createTextNode(" Second key "),
      slider,
      deleteAction,
    );
    item.append(title, facts, copyDestination, copyAction, deleteDetails);
    installedList.append(item);
  }
  panel.append(state.installed.length ? installedList : Object.assign(element("p", "ollama-empty"), { textContent: "No local models are installed." }));
  return panel;
}

function renderQueue(state: LocalOllamaSuiteState, actions: LocalOllamaSuiteActions): HTMLElement {
  const panel = element("section", "ollama-panel");
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", "ollama-tab-queue");
  const heading = element("h2");
  heading.textContent = "Local pull queue";
  panel.append(heading);
  const note = element("p", "ollama-supporting-text");
  note.textContent = "Each item is storage-preflighted, persisted, cancellable, retryable, and reconciled against Ollama after restart.";
  const queueActions = element("div", "ollama-actions");
  queueActions.append(
    button("Pause queue", () => actions.pauseQueue()),
    button("Resume queue", () => void actions.resumeQueue()),
  );
  panel.append(note, queueActions);
  const list = element("ul", "ollama-card-list");
  for (const item of state.queue) {
    const row = element("li", "ollama-card");
    const title = element("h3");
    title.textContent = item.reference;
    const progress = element("progress");
    progress.max = item.totalBytes ?? 1;
    progress.value = item.totalBytes ? Math.min(item.completedBytes, item.totalBytes) : 0;
    progress.setAttribute("aria-label", `${item.reference} pull progress`);
    const status = element("p");
    status.textContent = `${item.state}: ${item.status}${item.error ? ` — ${item.error}` : ""}`;
    const actionsRow = element("div", "ollama-actions");
    actionsRow.append(
      button("Cancel", () => void actions.cancelPull(item.id), !["queued", "preflighting", "pulling", "paused"].includes(item.state)),
      button("Retry", () => void actions.retryPull(item.id), !["failed", "cancelled"].includes(item.state)),
    );
    row.append(title, progress, status, actionsRow);
    list.append(row);
  }
  panel.append(state.queue.length ? list : Object.assign(element("p", "ollama-empty"), { textContent: "The pull queue is empty." }));
  return panel;
}

function renderChat(state: LocalOllamaSuiteState, actions: LocalOllamaSuiteActions): HTMLElement {
  const panel = element("section", "ollama-panel");
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", "ollama-tab-chat");
  const heading = element("h2");
  heading.textContent = "Local chat";
  const form = element("form", "ollama-form");
  const model = element("input", "ollama-field");
  model.value = state.chat.model;
  model.setAttribute("aria-label", "Installed model reference");
  model.placeholder = "Choose an installed model";
  model.setAttribute("list", "ollama-installed-models");
  const dataList = element("datalist");
  dataList.id = "ollama-installed-models";
  for (const installed of state.installed) {
    const option = element("option");
    option.value = installed.reference;
    dataList.append(option);
  }
  const systemPrompt = element("textarea", "ollama-field");
  systemPrompt.value = state.chat.systemPrompt;
  systemPrompt.placeholder = "Optional system prompt";
  systemPrompt.setAttribute("aria-label", "System prompt");
  const message = element("textarea", "ollama-field");
  message.placeholder = "Message the selected local model";
  message.required = true;
  message.setAttribute("aria-label", "Chat message");
  const containsTaxData = element("input");
  containsTaxData.type = "checkbox";
  containsTaxData.setAttribute("aria-label", "This message contains tax data");
  const reviewed = element("input");
  reviewed.type = "checkbox";
  reviewed.setAttribute("aria-label", "I reviewed the exact tax data and approve local model processing");
  const submit = button("Send to local model", () => undefined, state.chat.sending || state.runtime.health !== "healthy");
  submit.type = "submit";
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void actions.sendChat({
      model: model.value,
      systemPrompt: systemPrompt.value,
      content: message.value,
      containsTaxData: containsTaxData.checked,
      reviewedTaxData: reviewed.checked,
    });
  });
  form.append(
    model,
    dataList,
    systemPrompt,
    message,
    containsTaxData,
    document.createTextNode(" This message contains tax data"),
    reviewed,
    document.createTextNode(" I reviewed the exact tax data and approve local processing"),
    submit,
    button("Stop", () => actions.stopChat(), !state.chat.sending),
  );
  panel.append(heading, form);
  const transcript = element("ol", "ollama-transcript");
  transcript.setAttribute("aria-label", "Local chat transcript");
  for (const entry of state.chat.transcript) {
    const item = element("li", "ollama-message");
    const role = element("strong");
    role.textContent = `${entry.role}: `;
    item.append(role, document.createTextNode(entry.content));
    transcript.append(item);
  }
  if (state.chat.streamingText) {
    const streaming = element("li", "ollama-message");
    streaming.setAttribute("aria-live", "polite");
    streaming.textContent = `assistant: ${state.chat.streamingText}`;
    transcript.append(streaming);
  }
  panel.append(transcript);
  if (state.chat.error) panel.append(Object.assign(element("p", "ollama-error"), { textContent: state.chat.error }));
  return panel;
}

function renderHarness(state: LocalOllamaSuiteState, actions: LocalOllamaSuiteActions): HTMLElement {
  const panel = element("section", "ollama-panel");
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", "ollama-tab-harness");
  const heading = element("h2");
  heading.textContent = "Allowlisted local harnesses";
  const warning = element("p", "ollama-supporting-text");
  warning.textContent = "Harness launch is application-owned orchestration. Ollama does not launch programs. Arbitrary shell commands are not accepted.";
  panel.append(heading, warning);
  const profileList = element("div", "ollama-card-list");
  for (const profile of state.harness.profiles) {
    const profileButton = button(profile.name, () => actions.selectHarnessProfile(profile.id));
    profileButton.dataset.profileId = profile.id;
    profileButton.setAttribute("aria-pressed", String(state.harness.selectedProfileId === profile.id));
    profileList.append(profileButton);
  }
  const executable = element("input", "ollama-field");
  executable.placeholder = "Detected executable identifier";
  executable.setAttribute("aria-label", "Detected harness executable");
  executable.value = state.harness.selectedExecutableId ?? "";
  const workingDirectory = element("input", "ollama-field");
  workingDirectory.value = state.harness.workingDirectory;
  workingDirectory.setAttribute("aria-label", "Harness working directory");
  const model = element("input", "ollama-field");
  model.setAttribute("aria-label", "Harness model");
  model.placeholder = "Installed model reference";
  const chooseFolder = button("Browse for folder", async () => {
    const selected = await actions.chooseWorkingDirectory();
    if (selected) workingDirectory.value = selected;
  });
  const preview = button("Review launch", () => {
    const profileId = state.harness.selectedProfileId;
    if (profileId) void actions.previewHarness({
      profileId,
      executableId: executable.value,
      workingDirectory: workingDirectory.value,
      model: model.value,
    });
  }, !state.harness.selectedProfileId);
  panel.append(profileList, executable, workingDirectory, chooseFolder, model, preview);
  if (state.harness.preview) {
    const card = element("section", "ollama-card");
    const title = element("h3");
    title.textContent = "Launch preview";
    const facts = element("pre");
    facts.textContent = JSON.stringify({
      profile: state.harness.preview.profile.name,
      model: state.harness.preview.model,
      executable: state.harness.preview.executable.displayName,
      arguments: state.harness.preview.arguments,
      workingDirectory: state.harness.preview.workingDirectory,
      environmentKeys: state.harness.preview.environmentKeys,
      blockers: state.harness.preview.blockers,
    }, null, 2);
    card.append(title, facts, button("Launch with snapshot and rollback", () => void actions.launchHarness(), state.harness.preview.blockers.length > 0));
    panel.append(card);
  }
  if (state.harness.status) panel.append(Object.assign(element("p"), { textContent: state.harness.status }));
  return panel;
}

function renderTroubleshooter(state: LocalOllamaSuiteState, actions: LocalOllamaSuiteActions): HTMLElement {
  const panel = element("section", "ollama-panel");
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", "ollama-tab-troubleshooter");
  const heading = element("h2");
  heading.textContent = "Local runtime troubleshooter";
  const status = element("p");
  status.textContent = statusText(state);
  const next = element("p", "ollama-supporting-text");
  next.textContent = state.runtime.nextAction;
  const docs = element("details", "ollama-offline-help");
  const summary = element("summary");
  summary.textContent = "Bundled offline recovery guide";
  const content = element("div");
  content.textContent = "Install or start Ollama using the platform's official installation, then return here and select Recheck local runtime. The suite connects only to 127.0.0.1:11434 and does not use a cloud fallback.";
  docs.append(summary, content);
  panel.append(heading, status, next, button("Recheck local runtime", () => void actions.refreshRuntime(), state.busy), docs);
  return panel;
}

export function mountLocalOllamaSuiteSurface(container: HTMLElement, actions: LocalOllamaSuiteActions): () => void {
  container.classList.add("local-ollama-suite");
  const render = (state: LocalOllamaSuiteState): void => {
    container.replaceChildren();
    const header = element("header", "ollama-header");
    const title = element("h1");
    title.textContent = "Local Ollama suite";
    const status = element("p", `ollama-runtime ollama-runtime--${state.runtime.health}`);
    status.setAttribute("role", "status");
    status.textContent = statusText(state);
    header.append(title, status);
    const shell = element("div", "ollama-shell");
    const tabs = element("nav", "ollama-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-orientation", "vertical");
    for (const tab of TAB_LABELS) {
      const tabButton = button(tab.label, () => actions.selectTab(tab.id));
      tabButton.id = `ollama-tab-${tab.id}`;
      tabButton.setAttribute("role", "tab");
      tabButton.setAttribute("aria-selected", String(state.activeTab === tab.id));
      tabButton.tabIndex = state.activeTab === tab.id ? 0 : -1;
      tabs.append(tabButton);
    }
    const content = element("main", "ollama-content");
    const panel = state.activeTab === "store"
      ? renderStore(state, actions)
      : state.activeTab === "queue"
        ? renderQueue(state, actions)
        : state.activeTab === "chat"
          ? renderChat(state, actions)
          : state.activeTab === "harness"
            ? renderHarness(state, actions)
            : renderTroubleshooter(state, actions);
    content.append(panel);
    shell.append(tabs, content);
    container.append(header, shell);
  };
  render(actions.snapshot());
  return actions.subscribe(render);
}
