"use client";

/**
 * The local model runtime surface.
 *
 * The shared package renders nothing; this module is the React binding. The
 * honest constraint this page has to respect is that a page served over https
 * is subject to the browser's private-network and cross-origin rules, so a
 * request to a loopback service on this computer may be blocked before it
 * reaches anything. Nothing here reports a connected or healthy runtime that
 * was not actually observed: every state shown comes from a probe this page
 * performed, and every failure is named with what the browser reported.
 *
 * The batch list is payment-free by construction: it schedules local transfers
 * only, and the package's own disclosure is rendered beside it.
 */

import {
  type HardwareFitAssessment,
  type OfficialCatalogCache,
  type OfficialCatalogSnapshot,
  type OfficialCatalogVariant,
  CART_DISCLOSURE,
  OllamaLoopbackClient,
  PULL_STORAGE_HEADROOM,
  RUNTIME_HEALTH_VALUES,
  assessHardwareFit,
  catalogVariantHaystack,
  filterCatalogVariants,
  formatBytes,
  refreshOfficialCatalog,
  requiredFreeBytesFor,
} from "@material-tax-reporting/local-ollama";
import { matchesSearch } from "@material-tax-reporting/surface-kernel";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { CompactSearchWithBuilder, type SearchBinding } from "./search-builder.tsx";

const CATALOG_CACHE_KEY = "material-tax-reporting.site.ollama-catalog.v1";
const PROBE_TIMEOUT_MS = 4_000;

type ObservedRuntime = {
  observed: boolean;
  health: (typeof RUNTIME_HEALTH_VALUES)[number] | null;
  version: string | null;
  checkedAt: string | null;
  failingChecks: string[];
  installed: { reference: string; sizeBytes: number | null; quantization: string | null }[];
  running: string[];
};

const UNOBSERVED: ObservedRuntime = {
  observed: false,
  health: null,
  version: null,
  checkedAt: null,
  failingChecks: [],
  installed: [],
  running: [],
};

/** The five branches, in the package's order. No branch text carries a link. */
const BRANCH_TEXT: Record<string, { title: string; summary: string; offlineNextStep: string }> = {
  missing: {
    title: "No runtime found",
    summary: "The local API did not answer and nothing identified itself as a runtime on this computer.",
    offlineNextStep: "Install the runtime on this computer, then check again.",
  },
  stopped: {
    title: "Runtime not running",
    summary: "The runtime appears to be present but is not answering on the loopback address.",
    offlineNextStep: "Start the runtime service on this computer, then check again.",
  },
  "missing-or-stopped": {
    title: "Absent or stopped, and the difference is not observable",
    summary:
      "Every request failed before a response arrived. The API alone cannot distinguish an installation that is absent from one that is stopped, and this page will not pick one. A browser rule may also have blocked the request before it left the page.",
    offlineNextStep:
      "Confirm on this computer whether the runtime is installed and running, then check again.",
  },
  unhealthy: {
    title: "Runtime answered, some checks failed",
    summary: "At least one check answered and at least one failed. The failing checks are listed below.",
    offlineNextStep: "Review the failing checks on this computer, then check again.",
  },
  healthy: {
    title: "Runtime answered every check",
    summary: "Every check answered in this probe. This describes the moment of the probe and nothing later.",
    offlineNextStep: "No action is required for this probe.",
  },
};

function catalogCache(): OfficialCatalogCache {
  return {
    async read(): Promise<OfficialCatalogSnapshot | null> {
      try {
        const raw = window.localStorage.getItem(CATALOG_CACHE_KEY);
        return raw === null ? null : (JSON.parse(raw) as OfficialCatalogSnapshot);
      } catch {
        return null;
      }
    },
    async write(snapshot: OfficialCatalogSnapshot): Promise<void> {
      try {
        window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(snapshot));
      } catch {
        /* A browser that refuses the write keeps the previous cache. */
      }
    },
  };
}

function unknownFit(reference: string, sizeBytes: number | null): HardwareFitAssessment {
  // Every hardware field is null because a page cannot measure this computer.
  // The package's own logic then reports Unknown with named reasons, which is
  // the honest answer; it is never softened into a positive verdict here.
  return assessHardwareFit(
    {
      collectedAt: new Date().toISOString(),
      architecture: null,
      systemRamBytes: null,
      availableRamBytes: null,
      gpuModel: null,
      usableVramBytes: null,
      driverBackend: null,
      driverSupported: null,
      destinationFreeBytes: null,
    },
    {
      reference,
      blobSizeBytes: sizeBytes,
      parameterCount: null,
      quantization: null,
      contextLength: null,
      contextBytesPerToken: null,
    },
  );
}

export function LocalModelRuntimePanel({
  installedSearch,
  catalogSearch,
  queueSearch,
  onNotify,
}: {
  installedSearch: SearchBinding;
  catalogSearch: SearchBinding;
  queueSearch: SearchBinding;
  onNotify: (kind: "success" | "error" | "progress", title: string, body: string) => void;
}): ReactNode {
  const [runtime, setRuntime] = useState<ObservedRuntime>(UNOBSERVED);
  const [probing, setProbing] = useState(false);
  const [probeMessage, setProbeMessage] = useState(
    "No probe has been performed in this browser session yet.",
  );
  const [snapshot, setSnapshot] = useState<OfficialCatalogSnapshot | null>(null);
  const [catalogState, setCatalogState] = useState<
    "idle" | "refreshing" | "fresh" | "stale-cache" | "incomplete" | "unavailable"
  >("idle");
  const [catalogMessage, setCatalogMessage] = useState<string | null>(
    "No verified official catalogue is cached in this browser yet.",
  );
  const [cart, setCart] = useState<string[]>([]);

  const probe = useCallback(async () => {
    setProbing(true);
    setProbeMessage("Checking the loopback address from this page.");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const client = new OllamaLoopbackClient({ requestTimeoutMs: PROBE_TIMEOUT_MS });
      const health = await client.health({ signal: controller.signal });
      const failing = Object.entries(health.checks)
        .filter(([, check]) => !check.ok)
        .map(([name, check]) => `${name}: ${check.error?.code ?? "unknown"} — ${check.error?.message ?? "no message reported"}`);
      setRuntime({
        observed: true,
        health: health.status,
        version: health.version?.version ?? null,
        checkedAt: health.checkedAt,
        failingChecks: failing,
        installed: (health.installedModels?.models ?? []).map((model) => ({
          reference: model.name,
          sizeBytes: typeof model.size === "number" ? model.size : null,
          quantization: model.details?.quantization_level ?? null,
        })),
        running: (health.runningModels?.models ?? []).map((model) => model.name),
      });
      setProbeMessage(`Probe finished at ${health.checkedAt}.`);
    } catch (error) {
      const reason =
        error instanceof DOMException && error.name === "AbortError"
          ? `The probe did not finish within ${PROBE_TIMEOUT_MS / 1000} seconds and was cancelled.`
          : error instanceof Error
            ? error.message
            : "The probe failed before a response arrived.";
      setRuntime({ ...UNOBSERVED, observed: true, health: "missing-or-stopped", checkedAt: new Date().toISOString(), failingChecks: [reason] });
      setProbeMessage(reason);
      onNotify("error", "Runtime probe failed", reason);
    } finally {
      window.clearTimeout(timeout);
      setProbing(false);
    }
  }, [onNotify]);

  const refreshCatalog = useCallback(async () => {
    setCatalogState("refreshing");
    setCatalogMessage("Reading the official catalogue.");
    const cache = catalogCache();
    try {
      const result = await refreshOfficialCatalog(cache);
      setSnapshot(result.snapshot);
      setCatalogState(result.state);
      setCatalogMessage(
        result.reason ??
          (result.snapshot === null
            ? "No verified official catalogue is cached in this browser yet."
            : `Catalogue refreshed at ${result.snapshot.refreshedAt}.`),
      );
    } catch (error) {
      setCatalogState("unavailable");
      setCatalogMessage(
        error instanceof Error
          ? `${error.message} No catalogue is cached, so no variants exist to show.`
          : "The catalogue could not be read. No catalogue is cached, so no variants exist to show.",
      );
    }
  }, []);

  const variants = useMemo<OfficialCatalogVariant[]>(() => snapshot?.variants ?? [], [snapshot]);
  const visibleVariants = useMemo(
    () => filterCatalogVariants(variants, { search: catalogSearch.state }).slice(0, 200),
    [variants, catalogSearch.state],
  );
  const visibleInstalled = useMemo(
    () =>
      runtime.installed.filter((model) =>
        matchesSearch(`${model.reference} ${model.quantization ?? ""}`, installedSearch.state),
      ),
    [runtime.installed, installedSearch.state],
  );
  const visibleCart = useMemo(
    () => cart.filter((reference) => matchesSearch(reference, queueSearch.state)),
    [cart, queueSearch.state],
  );

  const cartTotal = useMemo(() => {
    if (cart.length === 0) return null;
    let total = 0;
    for (const reference of cart) {
      const variant = variants.find((entry) => entry.reference === reference);
      if (!variant || variant.sizeBytes === null) return null;
      total += variant.sizeBytes;
    }
    return total;
  }, [cart, variants]);

  const cartBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (cart.length === 0) return blockers;
    if (cartTotal === null) {
      blockers.push("At least one entry has no reported size, so the storage answer is unknown and the batch cannot be committed.");
    }
    if (!runtime.observed || runtime.health !== "healthy") {
      blockers.push("No healthy runtime was observed from this page, so nothing can be scheduled.");
    }
    blockers.push("Free destination storage cannot be measured from a page, so the storage requirement cannot be checked here.");
    return blockers;
  }, [cart.length, cartTotal, runtime.health, runtime.observed]);

  const activeBranch = runtime.health ?? "missing-or-stopped";

  return (
    <section id="assistant-panel" tabIndex={-1} aria-labelledby="assistant-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Observed state only</p>
          <h2 id="assistant-title">Local model runtime</h2>
          <p>
            This page can report only what a browser probe observed. A page served over https is subject to the
            browser's private-network and cross-origin rules, so a request to a loopback service on this
            computer may be refused before it is sent. No connected or healthy state is shown that was not
            observed.
          </p>
        </div>
        <button type="button" className="filled-button" disabled={probing} onClick={() => void probe()}>
          {probing ? "Checking…" : "Check the local runtime"}
        </button>
      </div>

      <p role="status">{probeMessage}</p>

      <ul className="runtime-branches">
        {RUNTIME_HEALTH_VALUES.map((health) => {
          const branch = BRANCH_TEXT[health];
          const active = runtime.observed && health === activeBranch;
          return (
            <li key={health} className={active ? "runtime-branch active" : "runtime-branch"}>
              <h3>{branch?.title ?? health}</h3>
              <p>{branch?.summary ?? ""}</p>
              {active && runtime.failingChecks.length > 0 && (
                <ul>
                  {runtime.failingChecks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
              )}
              {active && (
                <>
                  <p>{branch?.offlineNextStep ?? ""}</p>
                  <button type="button" className="outlined-button" onClick={() => void probe()}>
                    Check again
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <p className="privacy-note">
        {runtime.observed
          ? `Reported version: ${runtime.version ?? "not reported"}. Checked at ${runtime.checkedAt ?? "an unrecorded time"}.`
          : "Installed and running lists stay empty until a probe observes a healthy runtime. An empty list here is not evidence that nothing is installed."}
      </p>

      <h3>Installed models</h3>
      <CompactSearchWithBuilder {...installedSearch} />
      {visibleInstalled.length === 0 ? (
        <p>
          No installed model has been observed from this page. Nothing on this page can install, remove or run
          a model; that happens on this computer.
        </p>
      ) : (
        <table className="data-table">
          <caption>Models the probe reported, with the package's evidence-based fit verdict</caption>
          <thead>
            <tr>
              <th scope="col">Reference</th>
              <th scope="col">Size</th>
              <th scope="col">Fit verdict</th>
              <th scope="col">Why</th>
            </tr>
          </thead>
          <tbody>
            {visibleInstalled.map((model) => {
              const fit = unknownFit(model.reference, model.sizeBytes);
              return (
                <tr key={model.reference}>
                  <th scope="row">{model.reference}</th>
                  <td>{formatBytes(model.sizeBytes)}</td>
                  <td>{fit.verdict}</td>
                  <td>{fit.reasons.join(" ")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h3>Official catalogue</h3>
      <p role="status">{catalogMessage}</p>
      <button type="button" className="outlined-button" onClick={() => void refreshCatalog()}>
        Refresh the catalogue
      </button>
      {catalogState === "stale-cache" && snapshot !== null && (
        <p>The entries below are the last verified cache and are marked stale by the snapshot.</p>
      )}
      {catalogState === "incomplete" && (
        <p>The refresh was incomplete and the cache was not replaced. The entries below are the older complete cache.</p>
      )}
      <CompactSearchWithBuilder {...catalogSearch} />
      {variants.length === 0 ? (
        <p>No catalogue is cached, so there is no inventory to show. An empty area here is not an empty catalogue.</p>
      ) : (
        <ul className="catalog-list">
          {visibleVariants.map((variant) => (
            <li key={variant.reference}>
              <div>
                <strong>{variant.displayLabel}</strong>
                <small>{catalogVariantHaystack(variant)}</small>
                <small>{formatBytes(variant.sizeBytes)}</small>
              </div>
              <button
                type="button"
                className="outlined-button"
                disabled={cart.includes(variant.reference)}
                onClick={() => setCart((current) => [...current, variant.reference].sort())}
              >
                Add to the batch
              </button>
            </li>
          ))}
          {visibleVariants.length === 0 && <li>No catalogue entry matches the filter.</li>}
        </ul>
      )}

      <h3>Batch</h3>
      <p className="privacy-note">{CART_DISCLOSURE}</p>
      <CompactSearchWithBuilder {...queueSearch} />
      <ul className="cart-list">
        {visibleCart.map((reference) => (
          <li key={reference}>
            <span>{reference}</span>
            <button
              type="button"
              className="text-button"
              onClick={() => setCart((current) => current.filter((entry) => entry !== reference))}
            >
              Remove
            </button>
          </li>
        ))}
        {visibleCart.length === 0 && <li>The batch is empty.</li>}
      </ul>
      <p>
        Total size: {formatBytes(cartTotal)}. Required free space at the package's{" "}
        {Math.round((PULL_STORAGE_HEADROOM - 1) * 100)}% headroom:{" "}
        {formatBytes(requiredFreeBytesFor(cartTotal))}.
      </p>
      {cartBlockers.length > 0 && (
        <ul className="blocker-list">
          {cartBlockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      )}
      <button type="button" className="filled-button" disabled>
        Commit the batch
      </button>
      <p className="privacy-note">
        Committing a batch requires a privileged local adapter that a page cannot provide, so the control stays
        disabled here. This page never runs a command, opens a shell or writes to this computer.
      </p>
    </section>
  );
}
