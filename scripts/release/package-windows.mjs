import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
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
const electronBuilder = path.join(repositoryRoot, "node_modules", ".bin", "electron-builder.cmd");

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
await requiredFile(electronBuilder, "the pinned electron-builder executable");

await rm(outputRoot, { recursive: true, force: true });
run(process.execPath, [path.join(scriptDirectory, "generate-windows-icon.mjs")]);
await requiredFile(generatedIcon, "the generated multi-resolution Windows icon");

const packageEnvironment = {
  ...process.env,
  CSC_IDENTITY_AUTO_DISCOVERY: "false",
  CSC_LINK: "",
  WIN_CSC_LINK: "",
  CSC_KEY_PASSWORD: "",
};
run(
  electronBuilder,
  ["--projectDir", "apps/desktop", "--config", "../../electron-builder.yml", "--win", "squirrel", "--publish", "never"],
  { env: packageEnvironment },
);

const expectedSetupName = `MaterialTaxReporting-${packageJson.version}-Setup.exe`;
const expectedFullName = `MaterialTaxReporting-${packageJson.version}-full.nupkg`;
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
const signature = spawnSync(
  "powershell.exe",
  ["-NoProfile", "-Command", `(Get-AuthenticodeSignature -LiteralPath '${escapedSetupPath}').Status.ToString()`],
  { encoding: "utf8", windowsHide: true },
);
if (signature.status !== 0 || signature.stdout.trim() !== "NotSigned") {
  fail(`code signing is prohibited; Setup.exe signature status was ${signature.stdout.trim() || "unavailable"}`);
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
  artifacts,
};
await writeFile(path.join(outputRoot, "release-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(`Packaged ${expectedSetupName} for source ${provenance.sourceCommit}; signing status NotSigned.\n`);
