"use client";

/**
 * The Start, Downloading and Complete decision surfaces.
 *
 * `app/data/releases.json` is the single source of truth. It ships with an
 * empty asset list, so the site renders its honest unavailable state and every
 * count shown elsewhere is derived from this file rather than written by hand.
 *
 * When an asset is published, the Downloading surface is driven by real byte
 * counts read from the response stream and the Complete surface reports the
 * measured size and the hash this browser computed. The kernel reducer refuses
 * to enter the complete phase without a measured byte count, so no surface can
 * announce a transfer it did not measure. Nothing here signs, verifies a
 * signature, installs, files or submits anything.
 */

import {
  type DownloadState,
  createDownloadState,
  describeDownload,
  downloadFraction,
  reduceDownloadState,
} from "@material-tax-reporting/surface-kernel";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import manifest from "./data/releases.json";

export type ReleaseAsset = {
  name: string;
  version: string;
  url: string;
  byteLength: number;
  sha256: string;
  publishedAt: string;
};

type ReleaseManifest = {
  schemaVersion: number;
  note: string;
  assets: ReleaseAsset[];
};

const RELEASE_MANIFEST = manifest as ReleaseManifest;

/** Derived from the manifest. Nothing on this site hard-codes this number. */
export const RELEASE_ASSET_COUNT = RELEASE_MANIFEST.assets.length;

/** Also derived: the number of assets carrying a published hash. */
export const RELEASE_HASHED_ASSET_COUNT = RELEASE_MANIFEST.assets.filter(
  (asset) => typeof asset.sha256 === "string" && asset.sha256.length > 0,
).length;

export const UNSIGNED_NOTICE =
  "Any published asset is unsigned. This site makes no signature-authenticity claim, and a completed transfer is a transfer only: nothing is installed, filed, submitted or transmitted to a tax authority.";

function formatBytes(value: number | null): string {
  if (value === null) return "Size unavailable";
  return `${value.toLocaleString()} bytes`;
}

async function digestHex(bytes: Uint8Array): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const buffer = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function AssetTransfer({
  asset,
  onNotify,
}: {
  asset: ReleaseAsset;
  onNotify: (kind: "success" | "error" | "progress", title: string, body: string) => void;
}): ReactNode {
  const [state, setState] = useState<DownloadState>(() =>
    createDownloadState({ assetName: asset.name, version: asset.version, publishedHash: asset.sha256 }),
  );
  const [acknowledged, setAcknowledged] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const start = useCallback(async () => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((current) => reduceDownloadState(current, { type: "begin", byteTotal: asset.byteLength }));
    try {
      const response = await fetch(asset.url, { signal: controller.signal, cache: "no-store" });
      if (!response.ok || !response.body) {
        throw new Error(`The address answered with status ${response.status}.`);
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.byteLength;
          setState((current) => reduceDownloadState(current, { type: "progress", byteCount: received }));
        }
      }
      const joined = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        joined.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const measuredHash = await digestHex(joined);
      setState((current) =>
        reduceDownloadState(current, { type: "finish", byteCount: received, measuredHash }),
      );
      onNotify("success", "Transfer finished", `${asset.name}: ${formatBytes(received)} measured in this browser.`);
    } catch (error) {
      const reason =
        error instanceof DOMException && error.name === "AbortError"
          ? "The transfer was cancelled."
          : error instanceof Error
            ? error.message
            : "The transfer failed.";
      setState((current) => reduceDownloadState(current, { type: "fail", reason }));
      onNotify("error", "Transfer failed", reason);
    } finally {
      controllerRef.current = null;
    }
  }, [asset, onNotify]);

  const fraction = downloadFraction(state);

  return (
    <article className="download-card">
      <h3>
        {asset.name} {asset.version}
      </h3>
      <dl className="download-facts">
        <dt>Published size</dt>
        <dd>{formatBytes(asset.byteLength)}</dd>
        <dt>Published SHA-256</dt>
        <dd>
          <code>{asset.sha256}</code>
        </dd>
        <dt>Published</dt>
        <dd>{asset.publishedAt}</dd>
        <dt>Signature</dt>
        <dd>Unsigned</dd>
      </dl>
      <p className="privacy-note">{UNSIGNED_NOTICE}</p>
      <p role="status">{describeDownload(state)}</p>

      {state.phase === "start" || state.phase === "failed" ? (
        <>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            I understand this asset is unsigned.
          </label>
          <button
            type="button"
            className="filled-button"
            disabled={!acknowledged}
            onClick={() => void start()}
          >
            Start the transfer
          </button>
        </>
      ) : null}

      {state.phase === "downloading" && (
        <div className="download-progress">
          <progress
            max={state.byteTotal ?? undefined}
            value={state.byteTotal === null ? undefined : state.byteCount}
            aria-label={`${asset.name} transfer progress`}
          />
          <p>
            {formatBytes(state.byteCount)} of {formatBytes(state.byteTotal)}
            {fraction === null ? "" : ` (${Math.round(fraction * 100)}%)`}
          </p>
          <button type="button" className="outlined-button" onClick={() => controllerRef.current?.abort()}>
            Cancel the transfer
          </button>
        </div>
      )}

      {state.phase === "complete" && (
        <div className="download-complete">
          <p>
            Measured {formatBytes(state.byteCount)}. Measured SHA-256 <code>{state.measuredHash ?? "not computed"}</code>
            {state.measuredHash === null
              ? ", because this browser did not expose the digest interface."
              : state.measuredHash === state.publishedHash
                ? ", which matches the published hash."
                : ", which does not match the published hash."}
          </p>
          <button
            type="button"
            className="text-button"
            onClick={() => setState((current) => reduceDownloadState(current, { type: "reset" }))}
          >
            Start over
          </button>
        </div>
      )}
    </article>
  );
}

export function DownloadSurfaces({
  onNotify,
}: {
  onNotify: (kind: "success" | "error" | "progress", title: string, body: string) => void;
}): ReactNode {
  const assets = useMemo(() => RELEASE_MANIFEST.assets, []);

  if (assets.length === 0) {
    return (
      <section className="installer-card" id="download-panel" tabIndex={-1} aria-labelledby="installer-title">
        <div>
          <p className="eyebrow">Release availability</p>
          <h2 id="installer-title">Download unavailable</h2>
          <p>
            The release manifest lists {RELEASE_ASSET_COUNT} assets, so there is nothing to transfer. There is
            no shipped application, installer, tax engine, PDF generator, documentation release, or software
            release. A transfer control appears here only after a verified asset is recorded in the manifest.
          </p>
          <p className="privacy-note">{UNSIGNED_NOTICE}</p>
        </div>
        <span className="unavailable-chip">Unavailable</span>
      </section>
    );
  }

  return (
    <section id="download-panel" tabIndex={-1} aria-labelledby="download-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Release manifest</p>
          <h2 id="download-title">Available assets</h2>
          <p>
            {RELEASE_ASSET_COUNT} asset{RELEASE_ASSET_COUNT === 1 ? "" : "s"} recorded, of which{" "}
            {RELEASE_HASHED_ASSET_COUNT} carr{RELEASE_HASHED_ASSET_COUNT === 1 ? "ies" : "y"} a published hash.
          </p>
        </div>
      </div>
      <div className="download-grid">
        {assets.map((asset) => (
          <AssetTransfer key={`${asset.name}-${asset.version}`} asset={asset} onNotify={onNotify} />
        ))}
      </div>
    </section>
  );
}
