import { writeFile } from "node:fs/promises";

const outputPath = process.argv[2];
const repository = process.env.GITHUB_REPOSITORY;
if (!outputPath || !repository) throw new Error("Usage: select-dim-sum.mjs <output-json> with GITHUB_REPOSITORY set.");

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "material-tax-reporting-release",
  "X-GitHub-Api-Version": "2022-11-28",
};
if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;

async function readJson(url, requestHeaders = {}) {
  const response = await fetch(url, { headers: { ...headers, ...requestHeaders }, redirect: "error" });
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

const catalogUrl = "https://raw.githubusercontent.com/Ding-Ding-Projects/dim-sum-photos/main/catalog/index.json";
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

  for (const dish of catalog.dishes) {
    const assetName = String(dish.image?.path ?? "").split("/").pop();
    const codeName = `${dish.name?.en ?? ""} · ${dish.name?.zhHant ?? ""}`;
    if (!assetName || !dish.name?.en || !dish.name?.zhHant || usedCodeNames.has(codeName)) continue;
    const photoUrl = publishedAssets.get(assetName);
    if (photoUrl) {
      selection = { available: true, codeName, assetName, photoUrl, catalogUrl };
      break;
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
  selection = {
    available: false,
    reason: "No unused catalog dish with a published catalog-v1 photo asset was available.",
    catalogUrl,
  };
}
await writeFile(outputPath, `${JSON.stringify(selection, null, 2)}\n`, "utf8");
process.stdout.write(`${selection.available ? selection.codeName : selection.reason}\n`);
