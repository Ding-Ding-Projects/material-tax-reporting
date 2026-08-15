import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateImageBytes } from "./validate-image.mjs";

const outputPath = process.argv[2];
const repository = process.env.GITHUB_REPOSITORY;
if (!outputPath || !repository) throw new Error("Usage: select-dim-sum.mjs <output-json> with GITHUB_REPOSITORY set.");

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
// `.tmp/` is already ignored by the repository, so the downloaded photo can
// never be committed by accident. It is a build input on its way to a release
// asset, never a tracked file: the catalog is the only source of these images.
const photoDirectoryName = ".tmp/dim-sum";
const photoDirectory = path.join(repositoryRoot, ...photoDirectoryName.split("/"));

const PHOTO_SOURCE_PREFIX = "https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download/";
const MAX_PHOTO_CANDIDATES = 5;
const MAX_PHOTO_BYTES = 32 * 1024 * 1024;
// Every request here is bounded. Node's fetch has no default timeout, so a
// connection that stalls rather than fails would hold the whole release job
// open until its own timeout hours later. That is the single failure mode this
// step must not have: the dish photo is decoration and must never be able to
// keep a built installer from reaching anyone. A timeout raises an ordinary
// error, which the surrounding handling already degrades to "no photo" with the
// reason stated in the release notes.
const REQUEST_TIMEOUT_MS = 120_000;

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "material-tax-reporting-release",
  "X-GitHub-Api-Version": "2022-11-28",
};
if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;

async function readJson(url, requestHeaders = {}) {
  const response = await fetch(url, {
    headers: { ...headers, ...requestHeaders },
    redirect: "error",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}.`);
  const contentLength = Number.parseInt(response.headers.get("content-length") ?? "0", 10);
  if (contentLength > 32 * 1024 * 1024) throw new Error(`${url} exceeded the 32 MiB response bound.`);
  return response.json();
}

async function readAllPages(baseUrl) {
  const records = [];
  for (let page = 1; page <= 100; page += 1) {
    const separator = baseUrl.includes("?") ? "&" : "?";
    const batch = await readJson(`${baseUrl}${separator}per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error(`${baseUrl} did not return an array.`);
    records.push(...batch);
    if (batch.length < 100) return records;
  }
  throw new Error(`${baseUrl} exceeded the 10,000-record pagination bound.`);
}

/**
 * Download one published catalog photo.
 *
 * A release-asset download URL answers 302 and hands off to a short-lived
 * signed storage host, so this request must follow redirects where every JSON
 * read above deliberately refuses them. The origin is pinned to the public
 * photo repository's own download path instead, and the credential is left off
 * entirely: these assets are public, and forwarding a token across a redirect
 * to a storage host is neither needed nor wanted.
 *
 * The storage host serves them as `application/octet-stream`, so the declared
 * content type proves nothing about the payload and is deliberately not used as
 * evidence. The bytes are what get checked.
 */
async function downloadPhoto(photoUrl) {
  if (!photoUrl.startsWith(PHOTO_SOURCE_PREFIX)) {
    throw new Error("the photo URL is not a published asset of the public dim-sum photo repository");
  }
  const response = await fetch(photoUrl, {
    headers: { "User-Agent": "material-tax-reporting-release" },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`the download returned HTTP ${response.status}`);
  const declaredLength = Number.parseInt(response.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PHOTO_BYTES) {
    throw new Error(`the download declares ${declaredLength} bytes, above the ${MAX_PHOTO_BYTES}-byte bound`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_PHOTO_BYTES) {
    throw new Error(`the download delivered ${bytes.byteLength} bytes, above the ${MAX_PHOTO_BYTES}-byte bound`);
  }
  if (Number.isFinite(declaredLength) && declaredLength > 0 && bytes.byteLength !== declaredLength) {
    throw new Error(`the download delivered ${bytes.byteLength} of ${declaredLength} declared bytes, so it is truncated`);
  }
  return bytes;
}

const catalogUrl = "https://raw.githubusercontent.com/Ding-Ding-Projects/dim-sum-photos/main/catalog/index.json";
const photoFailures = [];
let selection = null;

try {
  const catalog = await readJson(catalogUrl);
  if (catalog.schemaVersion !== "1.0.0" || !Array.isArray(catalog.dishes)) throw new Error("The public dim-sum catalog schema is unsupported.");

  const photoReleases = await readAllPages("https://api.github.com/repos/Ding-Ding-Projects/dim-sum-photos/releases");
  const publishedAssets = new Map();
  for (const release of photoReleases) {
    if (release.draft || !String(release.tag_name).startsWith("catalog-v1")) continue;
    const releaseAssets = await readAllPages(`https://api.github.com/repos/Ding-Ding-Projects/dim-sum-photos/releases/${release.id}/assets`);
    for (const asset of releaseAssets) {
      if (asset.name && asset.browser_download_url && asset.size > 0) publishedAssets.set(asset.name, asset.browser_download_url);
    }
  }

  const projectReleases = await readAllPages(`https://api.github.com/repos/${repository}/releases`);
  const usedCodeNames = new Set();
  for (const release of projectReleases) {
    const body = String(release.body ?? "");
    for (const match of body.matchAll(/^(?:-\s*)?Dim sum code name:\s*(.+)$/gim)) usedCodeNames.add(match[1].trim());
  }

  await rm(photoDirectory, { recursive: true, force: true });
  await mkdir(photoDirectory, { recursive: true });

  let attempts = 0;
  for (const dish of catalog.dishes) {
    const assetName = String(dish.image?.path ?? "").split("/").pop();
    const codeName = `${dish.name?.en ?? ""} · ${dish.name?.zhHant ?? ""}`;
    if (!assetName || !dish.name?.en || !dish.name?.zhHant || usedCodeNames.has(codeName)) continue;
    const photoUrl = publishedAssets.get(assetName);
    if (!photoUrl) continue;

    // The catalog is remote data, so its asset name is never trusted as a path.
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(assetName) || assetName.includes("..")) {
      photoFailures.push(`${assetName}: the catalog asset name is not a safe file name`);
      continue;
    }

    attempts += 1;
    if (attempts > MAX_PHOTO_CANDIDATES) {
      photoFailures.push(`no candidate passed validation within the ${MAX_PHOTO_CANDIDATES}-download bound`);
      break;
    }

    try {
      const bytes = await downloadPhoto(photoUrl);
      const image = validateImageBytes(bytes, assetName);
      const releaseAssetName = `dim-sum-${assetName}`;
      await writeFile(path.join(photoDirectory, releaseAssetName), bytes);
      selection = {
        available: true,
        codeName,
        assetName,
        photoUrl,
        catalogUrl,
        photo: {
          releaseAssetName,
          repositoryPath: `${photoDirectoryName}/${releaseAssetName}`,
          format: image.format,
          mediaType: image.mediaType,
          width: image.width,
          height: image.height,
          bytes: image.bytes,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      };
      break;
    } catch (error) {
      // A rejected payload never becomes a release asset and never burns the
      // dish's code name. The next candidate is tried, and if none passes the
      // release still ships with its version alone.
      photoFailures.push(`${assetName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} catch (error) {
  selection = {
    available: false,
    reason: `Catalog lookup was unavailable: ${error instanceof Error ? error.message : String(error)}`,
    catalogUrl,
  };
}

if (!selection) {
  const detail = photoFailures.length
    ? ` Rejected candidates: ${photoFailures.join("; ")}.`
    : "";
  selection = {
    available: false,
    reason: `No unused catalog dish with a validated published catalog-v1 photo asset was available.${detail}`,
    catalogUrl,
  };
}
if (selection.available && photoFailures.length) selection.rejectedCandidates = photoFailures;

await writeFile(outputPath, `${JSON.stringify(selection, null, 2)}\n`, "utf8");
process.stdout.write(
  selection.available
    ? `${selection.codeName}\nValidated photo: ${selection.photo.releaseAssetName} (${selection.photo.format.toUpperCase()}, ${selection.photo.width}x${selection.photo.height}, ${selection.photo.bytes} bytes)\n`
    : `${selection.reason}\n`,
);
