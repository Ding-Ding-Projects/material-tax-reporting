import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
const appRoot = path.join(repositoryRoot, "apps", "desktop");
const outputRoot = path.join(repositoryRoot, "dist", "squirrel-windows");
const provenancePath = path.join(appRoot, "dist", "build-provenance.json");
const packagePath = path.join(appRoot, "package.json");
const generatedIcon = path.join(appRoot, "build", "icon.ico");
const releasedIcon = path.join(outputRoot, "material-tax-reporting.ico");
// Run the packaged JavaScript entry point through Node rather than the .cmd
// shim. Node refuses to spawn a .bat or .cmd without a shell, so the shim fails
// with EINVAL, and routing it through a shell instead would put generated paths
// back through command-line quoting for no benefit.
const electronBuilderCli = path.join(repositoryRoot, "node_modules", "electron-builder", "cli.js");
const offlineOcrStager = path.join(
  repositoryRoot,
  "packages",
  "slip-parser",
  "scripts",
  "stage-offline-ocr-assets.mjs",
);
const expectedDesktopOutputs = [
  "apps/desktop/dist/main/main.js",
  "apps/desktop/dist/preload/index.cjs",
  "apps/desktop/dist/renderer/index.html",
];

function fail(message) {
  throw new Error(`Windows packaging failed: ${message}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });
  if (result.error) fail(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} exited with code ${result.status}`);
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function requiredFile(filePath, label) {
  const details = await stat(filePath).catch(() => null);
  if (!details?.isFile() || details.size <= 0) fail(`${label} is missing or empty at ${filePath}`);
  return details;
}

// The staged OCR closure mirrors an installed dependency tree, which legitimately
// contains empty marker files such as .gitkeep. Their presence is still proven by
// the exact byte count and hash recorded in the manifest, so emptiness alone is
// not a defect here the way it would be for an installer artifact.
async function existingFile(filePath, label) {
  const details = await stat(filePath).catch(() => null);
  if (!details?.isFile()) fail(`${label} is missing at ${filePath}`);
  return details;
}

function normalizedPortablePath(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\\")) {
    fail(`${label} must be a non-empty portable path`);
  }
  const segments = value.split("/");
  if (path.isAbsolute(value) || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    fail(`${label} must stay within the staged OCR runtime`);
  }
  return segments;
}

async function verifyOfflineOcrRuntime(root, expectedManifestHash = null) {
  const manifestPath = path.join(root, "offline-ocr-assets.lock.json");
  await requiredFile(manifestPath, "the staged offline OCR asset manifest");
  const manifestBytes = await readFile(manifestPath);
  let evidence;
  try {
    evidence = JSON.parse(manifestBytes.toString("utf8"));
  } catch (error) {
    fail(`the staged offline OCR asset manifest is invalid JSON: ${error.message}`);
  }
  if (
    evidence.schemaVersion !== 2 ||
    evidence.target !== "win32-x64" ||
    evidence.platform !== "win32" ||
    evidence.architecture !== "x64" ||
    evidence.policy?.offline !== true ||
    evidence.policy?.pathLookup !== false ||
    evidence.policy?.runtimeDownload !== false ||
    evidence.policy?.cloudFallback !== false ||
    evidence.policy?.networkAccess !== "forbidden"
  ) {
    fail("the staged offline OCR manifest does not contain the required Windows x64 offline policy");
  }
  if (!Array.isArray(evidence.packages) || evidence.packages.length === 0 || !Array.isArray(evidence.files) || evidence.files.length === 0) {
    fail("the staged offline OCR manifest has no package closure or runtime files");
  }

  let totalBytes = 0;
  const seenPaths = new Set();
  const resolvedRoot = path.resolve(root) + path.sep;
  for (const file of evidence.files) {
    const segments = normalizedPortablePath(file.path, `offline OCR file ${file.path ?? "unknown"}`);
    if (seenPaths.has(file.path)) fail(`the offline OCR manifest repeats ${file.path}`);
    seenPaths.add(file.path);
    const filePath = path.resolve(root, ...segments);
    if (!filePath.startsWith(resolvedRoot)) fail(`offline OCR file escapes the staged runtime: ${file.path}`);
    const details = await existingFile(filePath, `offline OCR file ${file.path}`);
    const actualHash = await sha256(filePath);
    if (details.size !== file.bytes || actualHash !== file.sha256) {
      fail(`offline OCR file evidence does not match ${file.path}`);
    }
    totalBytes += details.size;
  }
  if (
    evidence.totals?.packages !== evidence.packages.length ||
    evidence.totals?.files !== evidence.files.length ||
    evidence.totals?.bytes !== totalBytes
  ) {
    fail("the staged offline OCR totals do not match the packaged closure");
  }

  const manifestHash = createHash("sha256").update(manifestBytes).digest("hex");
  if (expectedManifestHash && manifestHash !== expectedManifestHash) {
    fail("the packaged offline OCR manifest differs from the atomically staged manifest");
  }
  return { evidence, manifestHash };
}

const outputResolved = path.resolve(outputRoot);
const expectedOutputResolved = path.resolve(repositoryRoot, "dist", "squirrel-windows");
if (outputResolved !== expectedOutputResolved) fail(`refusing to clear unexpected output directory ${outputResolved}`);

const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(packageJson.version ?? "")) {
  fail("apps/desktop/package.json does not contain a valid package version");
}
if (typeof packageJson.author !== "string" || packageJson.author.trim().length === 0) {
  fail("apps/desktop/package.json must declare a non-empty package author before Squirrel.Windows packaging");
}
if (packageJson.main !== "dist/main/main.js") {
  fail("apps/desktop/package.json must declare dist/main/main.js as its packaged main entry");
}
const provenance = JSON.parse(await readFile(provenancePath, "utf8").catch(() => "null"));
if (!provenance || provenance.schemaVersion !== 1 || !/^[0-9a-f]{40}$/.test(provenance.sourceCommit ?? "")) {
  fail("current desktop build provenance is missing or invalid");
}
const provenancePaths = (provenance.outputs ?? []).map((output) => String(output.path).replaceAll("\\", "/")).sort();
if (provenancePaths.join("\n") !== [...expectedDesktopOutputs].sort().join("\n")) {
  fail(`desktop build provenance must contain exactly: ${expectedDesktopOutputs.join(", ")}`);
}
for (const output of provenance.outputs ?? []) {
  const outputPath = path.resolve(repositoryRoot, output.path);
  if (!outputPath.startsWith(path.resolve(appRoot) + path.sep)) fail(`provenance path escapes the desktop workspace: ${output.path}`);
  await requiredFile(outputPath, output.path);
  if ((await sha256(outputPath)) !== output.sha256) fail(`provenance hash does not match ${output.path}`);
}

const gitResult = spawnSync("git", ["-C", repositoryRoot, "rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true });
if (gitResult.status !== 0 || gitResult.stdout.trim() !== provenance.sourceCommit) {
  fail("desktop build provenance does not match the current source commit");
}
await requiredFile(electronBuilderCli, "the pinned electron-builder entry point");

await rm(outputRoot, { recursive: true, force: true });
run(process.execPath, [path.join(scriptDirectory, "generate-windows-icon.mjs")]);
await requiredFile(generatedIcon, "the generated multi-resolution Windows icon");
await requiredFile(offlineOcrStager, "the committed offline OCR staging script");

const packageEnvironment = {
  ...process.env,
  CSC_IDENTITY_AUTO_DISCOVERY: "false",
  CSC_LINK: "",
  WIN_CSC_LINK: "",
  CSC_KEY_PASSWORD: "",
};
// Resolve the temporary root to its canonical form before staging. On Windows
// the temporary directory is frequently reported as an 8.3 short path, and the
// stager rejects an output whose parent does not survive a realpath comparison
// unchanged. Short-path expansion is not symbolic-link traversal, but it looks
// identical to a string comparison, so canonicalize here rather than relaxing
// that check.
const offlineOcrTemporaryRoot = await mkdtemp(
  path.join(await realpath(tmpdir()), "material-tax-reporting-offline-ocr-"),
);
const stagedOfflineOcrRoot = path.join(offlineOcrTemporaryRoot, "runtime");
let packagedOfflineOcr;
try {
  run(process.execPath, [offlineOcrStager, "--output", stagedOfflineOcrRoot]);
  const stagedOfflineOcr = await verifyOfflineOcrRuntime(stagedOfflineOcrRoot);
  // Hand the staging root to electron-builder with forward slashes. It resolves
  // extraResources.from with glob semantics, where a Windows backslash is an
  // escape character rather than a separator, so a native absolute path stops
  // looking absolute and gets appended to the project directory instead. A
  // missing source is only a warning there, so the packaged runtime would then
  // be silently absent; the packaged verification below is what catches it.
  packageEnvironment.MTR_OFFLINE_OCR_STAGE = stagedOfflineOcrRoot.split(path.sep).join("/");
  run(
    process.execPath,
    [
      electronBuilderCli,
      "--projectDir",
      "apps/desktop",
      "--config",
      "../../electron-builder.yml",
      "--win",
      "squirrel",
      "--publish",
      "never",
    ],
    { env: packageEnvironment },
  );
  const packagedOfflineOcrRoot = path.join(
    outputRoot,
    "win-unpacked",
    "resources",
    "offline-ocr-runtime",
  );
  packagedOfflineOcr = await verifyOfflineOcrRuntime(
    packagedOfflineOcrRoot,
    stagedOfflineOcr.manifestHash,
  );
} finally {
  await rm(offlineOcrTemporaryRoot, { recursive: true, force: true });
}

const expectedSetupName = `MaterialTaxReporting-${packageJson.version}-Setup.exe`;
const expectedFullName = `MaterialTaxReporting-${packageJson.version}-full.nupkg`;

// The Squirrel target writes its own artifacts into a squirrel-windows folder
// inside the configured output directory, while win-unpacked stays at the root.
// The release manifest and the publishing step both read every asset from one
// directory, so lift the artifacts up. Accept either layout rather than assuming
// the nested one, so a packaging change cannot quietly strand the installer.
const nestedSquirrelRoot = path.join(outputRoot, "squirrel-windows");
const nestedSetup = await stat(path.join(nestedSquirrelRoot, expectedSetupName)).catch(() => null);
if (nestedSetup?.isFile()) {
  for (const entry of await readdir(nestedSquirrelRoot, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    await copyFile(path.join(nestedSquirrelRoot, entry.name), path.join(outputRoot, entry.name));
  }
}

const setupPath = path.join(outputRoot, expectedSetupName);
const releasesPath = path.join(outputRoot, "RELEASES");
const fullPackagePath = path.join(outputRoot, expectedFullName);
await requiredFile(setupPath, "Setup.exe");
await requiredFile(releasesPath, "RELEASES");
await requiredFile(fullPackagePath, "the full Squirrel package");

const outputNames = await readdir(outputRoot);
const deltaNames = outputNames.filter((name) => name.endsWith("-delta.nupkg")).sort();
const releaseIndex = await readFile(releasesPath, "utf8");
for (const packageName of [expectedFullName, ...deltaNames]) {
  if (!releaseIndex.includes(packageName)) fail(`RELEASES does not reference ${packageName}`);
  await requiredFile(path.join(outputRoot, packageName), packageName);
}

const escapedSetupPath = setupPath.replaceAll("'", "''");
// Windows PowerShell inherits PSModulePath from whichever process launches the
// build. When that is PowerShell 7 the inherited value points at PowerShell 7's
// module directories, and Windows PowerShell can then fail to autoload its own
// modules. Hand this child the Windows PowerShell module locations so the
// signature cmdlet resolves regardless of who invoked packaging.
const windowsPowerShellModulePath = [
  path.join(process.env.ProgramFiles ?? "C:\\Program Files", "WindowsPowerShell", "Modules"),
  path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "Modules"),
].join(path.delimiter);
const signature = spawnSync(
  "powershell.exe",
  ["-NoProfile", "-Command", `(Get-AuthenticodeSignature -LiteralPath '${escapedSetupPath}').Status.ToString()`],
  {
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, PSModulePath: windowsPowerShellModulePath },
  },
);
if (signature.status !== 0 || signature.stdout.trim() !== "NotSigned") {
  const reportedStatus = signature.stdout?.trim() || "unavailable";
  const reportedError = signature.stderr?.trim() || "no error output";
  fail(
    `code signing is prohibited; Setup.exe signature status was ${reportedStatus} ` +
      `(exit ${signature.status}: ${reportedError})`,
  );
}

await writeFile(releasedIcon, await readFile(generatedIcon));
const artifactSpecs = [
  [expectedSetupName, "setup"],
  ["RELEASES", "release-index"],
  [expectedFullName, "full-package"],
  ...deltaNames.map((name) => [name, "delta-package"]),
  ["material-tax-reporting.ico", "application-icon"],
];
const artifacts = [];
for (const [name, kind] of artifactSpecs) {
  const artifactPath = path.join(outputRoot, name);
  const details = await requiredFile(artifactPath, name);
  artifacts.push({ name, kind, bytes: details.size, sha256: await sha256(artifactPath) });
}

const rootPackage = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
const manifest = {
  schemaVersion: 1,
  sourceCommit: provenance.sourceCommit,
  packageVersion: packageJson.version,
  createdAtUtc: new Date().toISOString(),
  platform: "win32-x64",
  installer: "Squirrel.Windows",
  signatureStatus: "NotSigned",
  tools: {
    electron: rootPackage.devDependencies.electron,
    electronBuilder: rootPackage.devDependencies["electron-builder"],
    squirrelPlugin: rootPackage.devDependencies["electron-builder-squirrel-windows"],
  },
  offlineOcr: {
    target: packagedOfflineOcr.evidence.target,
    packages: packagedOfflineOcr.evidence.totals.packages,
    files: packagedOfflineOcr.evidence.totals.files,
    bytes: packagedOfflineOcr.evidence.totals.bytes,
    manifestSha256: packagedOfflineOcr.manifestHash,
    resourcePath: "resources/offline-ocr-runtime",
  },
  artifacts,
};
await writeFile(path.join(outputRoot, "release-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(`Packaged ${expectedSetupName} for source ${provenance.sourceCommit}; signing status NotSigned.\n`);
