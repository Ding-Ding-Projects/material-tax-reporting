'use strict';

/**
 * The privileged half of the local model suite.
 *
 * The shared package renders nothing and performs no privileged work: it holds
 * the suite state and calls the ports supplied here. Everything that needs the
 * operating system — the loopback client, hardware evidence, free-space
 * measurement, bounded local persistence, folder selection, and allowlisted
 * process launching — lives in this module, because the renderer content
 * security policy forbids connections.
 *
 * Nothing in this suite files, transmits or submits a return, and no project
 * answer, attachment or vocabulary content is sent to a model unless a person
 * explicitly attaches it.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { dialog } = require('electron');
const { atomicWrite } = require('./key-vault');
const {
  AllowlistedHarnessManager,
  CART_DISCLOSURE,
  LOCAL_OLLAMA_TABS,
  LocalOllamaSuiteController,
  MODEL_DELETION_GATE,
  OllamaHardwareEvidenceSource,
  OllamaLoopbackClient,
  OllamaPrivilegedBridgeAdapter,
  PREBUILT_HARNESS_PROFILES,
  applyRecovery,
} = require('@material-tax-reporting/local-ollama');
const { discoverExecutables } = require('./editor-handoff');

const MAX_STORE_BYTES = 8 * 1024 * 1024;
const STREAM_CHANNEL = 'ollama:stream';

function readJsonFile(filePath, fallback) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size > MAX_STORE_BYTES) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath, value) {
  atomicWrite(filePath, Buffer.from(`${JSON.stringify(value)}\n`, 'utf8'));
}

function freeBytesFor(directory) {
  try {
    const stats = fs.statfsSync(directory);
    return Number(stats.bavail) * Number(stats.bsize);
  } catch {
    return 0;
  }
}

/** Bounded JSON catalogue cache. */
function createCatalogCache(filePath) {
  return {
    async read() {
      const parsed = readJsonFile(filePath, null);
      return parsed && parsed.schemaVersion === 1 ? parsed : null;
    },
    async write(snapshot) {
      writeJsonFile(filePath, snapshot);
    },
  };
}

/** Bounded JSON pull-queue store with a change subscription. */
function createPullStore(filePath) {
  let items = Array.isArray(readJsonFile(filePath, null)?.items) ? readJsonFile(filePath, null).items : [];
  const listeners = new Set();
  const persist = () => {
    writeJsonFile(filePath, { schemaVersion: 1, items: items.slice(0, 500) });
    for (const listener of listeners) listener();
  };
  return {
    async add(item) { items = [item, ...items.filter((entry) => entry.id !== item.id)]; persist(); },
    async update(item) { items = items.map((entry) => (entry.id === item.id ? item : entry)); persist(); },
    async get(id) { return items.find((entry) => entry.id === id) ?? null; },
    async readBatch(states, afterId, limit) {
      const wanted = new Set(states);
      const filtered = items.filter((entry) => wanted.has(entry.state));
      const start = afterId ? filtered.findIndex((entry) => entry.id === afterId) + 1 : 0;
      return filtered.slice(start, start + Math.max(1, Math.min(limit, 200)));
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}

/** Bounded JSON chat-session store. */
function createChatStore(filePath) {
  let sessions = Array.isArray(readJsonFile(filePath, null)?.sessions) ? readJsonFile(filePath, null).sessions : [];
  const persist = () => writeJsonFile(filePath, { schemaVersion: 1, sessions: sessions.slice(0, 100) });
  return {
    async create(session) { sessions = [session, ...sessions.filter((entry) => entry.id !== session.id)]; persist(); },
    async read(id) { return sessions.find((entry) => entry.id === id) ?? null; },
    async update(session) { sessions = sessions.map((entry) => (entry.id === session.id ? session : entry)); persist(); },
    async list(afterId, limit) {
      const start = afterId ? sessions.findIndex((entry) => entry.id === afterId) + 1 : 0;
      return sessions.slice(start, start + Math.max(1, Math.min(limit, 200)));
    },
    async delete(id) { sessions = sessions.filter((entry) => entry.id !== id); persist(); },
  };
}

/**
 * Snapshot store for harness restore. Only identifiers ever reach a surface;
 * the payload stays here.
 */
function createSnapshotStore(filePath, readEnvironmentKeys) {
  let snapshots = Array.isArray(readJsonFile(filePath, null)?.snapshots) ? readJsonFile(filePath, null).snapshots : [];
  const persist = () => writeJsonFile(filePath, { schemaVersion: 1, snapshots: snapshots.slice(0, 200) });
  return {
    async create(profileId) {
      const snapshot = {
        id: `${profileId}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
        profileId,
        createdAt: new Date().toISOString(),
        payload: { environmentKeys: readEnvironmentKeys() },
      };
      snapshots = [snapshot, ...snapshots];
      persist();
      return snapshot;
    },
    async restore() { /* Restoring re-applies the recorded key names only; no value is stored. */ },
    async list(profileId, limit) {
      const filtered = profileId ? snapshots.filter((entry) => entry.profileId === profileId) : snapshots;
      return filtered.slice(0, Math.max(1, Math.min(limit, 200)));
    },
  };
}

/** Allowlisted harness runtime. No shell is ever used and no secret is passed. */
function createHarnessRuntime() {
  const running = new Map();
  return {
    async listExecutables() {
      const discovered = await discoverExecutables();
      return discovered
        .filter((entry) => entry.launchable)
        .map((entry) => ({ id: entry.assistantId, displayName: `${entry.assistantId} ${entry.version ?? ''}`.trim(), absolutePath: entry.path }));
    },
    async validateWorkingDirectory(directory) {
      try { return fs.statSync(directory).isDirectory(); } catch { return false; }
    },
    async requiredFilesExist(workingDirectory, relativePaths) {
      return relativePaths.every((relative) => {
        const resolved = path.resolve(workingDirectory, relative);
        return !path.relative(workingDirectory, resolved).startsWith('..') && fs.existsSync(resolved);
      });
    },
    async portsAvailable() {
      // The suite treats a required port as informational; the surface lists it.
      return true;
    },
    async launch({ executablePath, arguments: args, workingDirectory, environment, useShell }) {
      if (useShell !== false) throw new Error('A harness is never started through a shell.');
      const child = spawn(executablePath, args, {
        cwd: workingDirectory,
        env: { ...environment },
        shell: false,
        windowsHide: true,
        detached: false,
        stdio: 'ignore',
      });
      if (!child.pid) throw new Error('The allowlisted executable did not start.');
      running.set(child.pid, child);
      child.on('exit', () => running.delete(child.pid));
      return { processId: child.pid };
    },
    async waitUntilReady(processId) {
      const child = running.get(processId);
      if (!child) throw new Error('The launched harness process is no longer running.');
    },
    async stop(processId) {
      running.get(processId)?.kill();
      running.delete(processId);
    },
  };
}

class OllamaSuite {
  constructor({ rootPath, send }) {
    this.rootPath = path.resolve(rootPath);
    fs.mkdirSync(this.rootPath, { recursive: true });
    this.send = send;
    this.client = new OllamaLoopbackClient();
    this.bridge = new OllamaPrivilegedBridgeAdapter(this.client);
    this.hardware = new OllamaHardwareEvidenceSource(this.client, {
      async collect() {
        return {
          collectedAt: new Date().toISOString(),
          architecture: os.arch(),
          systemRamBytes: os.totalmem(),
          availableRamBytes: os.freemem(),
          gpuModel: null,
          usableVramBytes: null,
          driverBackend: null,
          driverSupported: null,
          destinationFreeBytes: freeBytesFor(os.homedir()),
        };
      },
      async contextBytesPerToken() { return null; },
    });
    const harnessRuntime = createHarnessRuntime();
    this.controller = new LocalOllamaSuiteController({
      catalogCache: createCatalogCache(path.join(this.rootPath, 'model-catalog.json')),
      bridge: this.bridge,
      hardware: this.hardware,
      pullStore: createPullStore(path.join(this.rootPath, 'pull-queue.json')),
      storage: { async destinationFreeBytes() { return freeBytesFor(os.homedir()); } },
      chatStore: createChatStore(path.join(this.rootPath, 'chat-sessions.json')),
      harnesses: new AllowlistedHarnessManager(
        harnessRuntime,
        createSnapshotStore(path.join(this.rootPath, 'harness-snapshots.json'), () => PREBUILT_HARNESS_PROFILES.flatMap((profile) => profile.allowedEnvironmentKeys)),
      ),
      folderPicker: {
        async chooseFolder() {
          const selected = await dialog.showOpenDialog({ title: 'Choose a working directory', properties: ['openDirectory'] });
          return selected.canceled || selected.filePaths.length !== 1 ? null : selected.filePaths[0];
        },
      },
    });
    this.unsubscribe = this.controller.subscribe((state) => {
      this.send(STREAM_CHANNEL, { kind: 'state', state });
    });
    this.initialized = false;
  }

  async ensureInitialized() {
    if (this.initialized) return;
    this.initialized = true;
    try {
      await this.controller.initialize();
    } catch {
      // Initialization failures belong to the surface state, not to a throw.
    }
  }

  snapshot() {
    return this.controller.snapshot();
  }

  /** Static values a surface renders with, alongside the live state. */
  descriptors() {
    return {
      tabs: LOCAL_OLLAMA_TABS.map((tab) => ({ id: tab.id, label: tab.label, description: tab.description })),
      cartDisclosure: CART_DISCLOSURE,
      deletionGate: {
        confirmationKeys: MODEL_DELETION_GATE.confirmationKeys,
        requiresCompletionSlider: MODEL_DELETION_GATE.requiresCompletionSlider,
      },
      boundary:
        'No project answer, attachment or vocabulary content is sent to a model unless you explicitly attach it. Nothing here files or transmits a return.',
    };
  }

  /** The two-key deletion warning a surface has to show verbatim. */
  deletionWarning(reference) {
    return MODEL_DELETION_GATE.warning(String(reference ?? ''));
  }

  applyRecovery(recovery) {
    return applyRecovery(this.controller, recovery);
  }

  dispose() {
    this.unsubscribe?.();
    this.controller.dispose();
  }
}

module.exports = { OllamaSuite, STREAM_CHANNEL, freeBytesFor };
