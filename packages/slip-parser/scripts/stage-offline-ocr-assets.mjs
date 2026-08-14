import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  rmdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, "..");
const manifestPath = join(packageRoot, "assets", "offline-ocr-runtime.json");

function readOutputArgument(argv) {
  const index = argv.indexOf("--output");
  if (index < 0 || !argv[index + 1]) {
    throw new Error("Required argument: --output <fresh-empty-directory>");
  }
  if (argv.indexOf("--output", index + 1) >= 0) {
    throw new Error("The --output argument may be supplied only once.");
  }
  return resolve(argv[index + 1]);
}

function isSameOrWithin(root, candidate) {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

function portablePath(path) {
  return path.split(sep).join("/");
}

function normalizedInstallPath(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\\")) {
    throw new Error(`${label} must be a non-empty portable path.`);
  }
  const segments = value.split("/");
  if (
    isAbsolute(value) ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..") ||
    segments[0] !== "node_modules"
  ) {
    throw new Error(`${label} must be a normalized path below node_modules.`);
  }
  return segments.join("/");
}

async function readJson(path, label) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`${label} is missing or invalid JSON: ${path}`, { cause: error });
  }
  return parsed;
}

async function findRepositoryRoot(start) {
  let cursor = start;
  while (true) {
    const lockPath = join(cursor, "package-lock.json");
    const lockInformation = await stat(lockPath).catch(() => null);
    if (lockInformation?.isFile()) return cursor;
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  throw new Error("Cannot locate the repository package-lock.json from the slip-parser package.");
}

function selectTarget(manifest) {
  const targetId = `${process.platform}-${process.arch}`;
  const target = manifest.supportedTargets?.find((entry) => entry.id === targetId);
  if (!target || target.platform !== process.platform || target.architecture !== process.arch) {
    throw new Error("Offline OCR installer assets are supported only for Windows x64 or arm64.");
  }
  return target;
}

function assertOfflinePolicy(manifest) {
  const environment = manifest.environment ?? {};
  if (
    manifest.schemaVersion !== 2 ||
    environment.offline !== true ||
    environment.pathLookup !== false ||
    environment.runtimeDownload !== false ||
    environment.cloudFallback !== false ||
    environment.networkAccess !== "forbidden"
  ) {
    throw new Error("The offline OCR manifest does not contain the required fail-closed policy.");
  }
  if (!Array.isArray(manifest.productionRoots) || manifest.productionRoots.length === 0) {
    throw new Error("The offline OCR manifest must declare its production roots.");
  }
  if (!Array.isArray(manifest.packages) || manifest.packages.length === 0) {
    throw new Error("The offline OCR manifest must declare exact package metadata.");
  }
  if (!Array.isArray(manifest.requiredFiles) || manifest.requiredFiles.length === 0) {
    throw new Error("The offline OCR manifest must declare required runtime files.");
  }
}

function selectPackageMetadata(manifest, target) {
  const selected = manifest.packages.filter(
    (entry) => !entry.targets || entry.targets.includes(target.id),
  );
  const byPath = new Map();
  for (const entry of selected) {
    const installPath = normalizedInstallPath(
      entry.installPath,
      `installPath for ${entry.name ?? "unknown package"}`,
    );
    if (
      typeof entry.name !== "string" ||
      typeof entry.version !== "string" ||
      typeof entry.resolved !== "string" ||
      !entry.resolved.startsWith("https://registry.npmjs.org/") ||
      typeof entry.integrity !== "string" ||
      !entry.integrity.startsWith("sha512-") ||
      typeof entry.license !== "string"
    ) {
      throw new Error(`Package metadata is incomplete for ${entry.name ?? installPath}.`);
    }
    if (byPath.has(installPath)) {
      throw new Error(`Duplicate package installPath in offline OCR manifest: ${installPath}`);
    }
    byPath.set(installPath, { ...entry, installPath });
  }
  const nativeEntries = selected.filter((entry) => entry.name === target.nativePackage);
  if (nativeEntries.length !== 1) {
    throw new Error(`The target must select exactly one native package: ${target.nativePackage}`);
  }
  return byPath;
}

function packageMetadataByName(metadataByPath, packageName) {
  return [...metadataByPath.values()].filter((entry) => entry.name === packageName);
}

async function validateLockMetadata(repositoryRoot, lock, metadataByPath) {
  if (!lock.packages || typeof lock.packages !== "object") {
    throw new Error("package-lock.json does not contain package installation metadata.");
  }
  for (const metadata of metadataByPath.values()) {
    const locked = lock.packages[metadata.installPath];
    for (const field of ["version", "resolved", "integrity", "license"]) {
      if (!locked || locked[field] !== metadata[field]) {
        throw new Error(
          `Lockfile metadata mismatch for ${metadata.name} at ${metadata.installPath}: ${field}.`,
        );
      }
    }
    const sourceRoot = resolve(repositoryRoot, ...metadata.installPath.split("/"));
    if (!isSameOrWithin(repositoryRoot, sourceRoot)) {
      throw new Error(`Package install path escapes the repository: ${metadata.installPath}`);
    }
  }
}

async function loadInstalledPackage(repositoryRoot, metadata) {
  const root = resolve(repositoryRoot, ...metadata.installPath.split("/"));
  const rootInformation = await lstat(root).catch(() => null);
  if (!rootInformation?.isDirectory() || rootInformation.isSymbolicLink()) {
    throw new Error(`Required installed package directory is missing or linked: ${metadata.installPath}`);
  }
  const packageJsonPath = join(root, "package.json");
  const packageJsonInformation = await lstat(packageJsonPath).catch(() => null);
  if (!packageJsonInformation?.isFile() || packageJsonInformation.isSymbolicLink()) {
    throw new Error(`Required installed package metadata is missing or linked: ${metadata.installPath}`);
  }
  const packageJson = await readJson(packageJsonPath, `Installed package ${metadata.name}`);
  if (packageJson.name !== metadata.name || packageJson.version !== metadata.version) {
    throw new Error(
      `Installed package identity mismatch at ${metadata.installPath}: expected ${metadata.name}@${metadata.version}.`,
    );
  }
  return { metadata, packageJson, root };
}

async function resolveInstalledDependency(repositoryRoot, parentRoot, dependencyName) {
  let cursor = parentRoot;
  while (isSameOrWithin(repositoryRoot, cursor)) {
    const candidate = join(cursor, "node_modules", ...dependencyName.split("/"));
    const information = await lstat(candidate).catch(() => null);
    if (information?.isDirectory() && !information.isSymbolicLink()) {
      return portablePath(relative(repositoryRoot, candidate));
    }
    if (cursor === repositoryRoot) break;
    cursor = dirname(cursor);
  }
  return null;
}

function requiredDependencyNames(packageJson) {
  const names = new Set(Object.keys(packageJson.dependencies ?? {}));
  for (const name of packageJson.bundledDependencies ?? packageJson.bundleDependencies ?? []) {
    names.add(name);
  }
  for (const name of Object.keys(packageJson.peerDependencies ?? {})) {
    if (packageJson.peerDependenciesMeta?.[name]?.optional !== true) names.add(name);
  }
  return [...names];
}

function optionalDependencyNames(packageJson) {
  const names = new Set(Object.keys(packageJson.optionalDependencies ?? {}));
  for (const name of Object.keys(packageJson.peerDependencies ?? {})) {
    if (packageJson.peerDependenciesMeta?.[name]?.optional === true) names.add(name);
  }
  return [...names];
}

async function collectProductionClosure(repositoryRoot, manifest, metadataByPath) {
  const queue = [];
  for (const rootName of manifest.productionRoots) {
    const candidates = packageMetadataByName(metadataByPath, rootName);
    if (candidates.length !== 1) {
      throw new Error(`Production root must identify exactly one package: ${rootName}`);
    }
    queue.push(candidates[0].installPath);
  }

  const visited = new Map();
  while (queue.length > 0) {
    const installPath = queue.shift();
    if (visited.has(installPath)) continue;
    const metadata = metadataByPath.get(installPath);
    if (!metadata) {
      throw new Error(`Installed production dependency is not pinned in the manifest: ${installPath}`);
    }
    const installed = await loadInstalledPackage(repositoryRoot, metadata);
    visited.set(installPath, installed);

    for (const dependencyName of requiredDependencyNames(installed.packageJson)) {
      const resolvedPath = await resolveInstalledDependency(
        repositoryRoot,
        installed.root,
        dependencyName,
      );
      if (!resolvedPath) {
        throw new Error(`Required production dependency is not installed: ${metadata.name} -> ${dependencyName}`);
      }
      if (!metadataByPath.has(resolvedPath)) {
        throw new Error(`Production dependency lacks exact manifest metadata: ${resolvedPath}`);
      }
      queue.push(resolvedPath);
    }

    for (const dependencyName of optionalDependencyNames(installed.packageJson)) {
      const resolvedPath = await resolveInstalledDependency(
        repositoryRoot,
        installed.root,
        dependencyName,
      );
      if (resolvedPath) {
        if (!metadataByPath.has(resolvedPath)) {
          throw new Error(`Installed optional production dependency is not pinned: ${resolvedPath}`);
        }
        queue.push(resolvedPath);
      } else if (packageMetadataByName(metadataByPath, dependencyName).length > 0) {
        throw new Error(
          `Selected optional production dependency is not installed: ${metadata.name} -> ${dependencyName}`,
        );
      }
    }
  }

  const unvisited = [...metadataByPath.keys()].filter((path) => !visited.has(path));
  if (unvisited.length > 0) {
    throw new Error(`Manifest packages are outside the installed production closure: ${unvisited.join(", ")}`);
  }
  return visited;
}

async function assertFreshOutput(repositoryRoot, output) {
  const driveRoot = parse(output).root;
  if (
    output === driveRoot ||
    isSameOrWithin(output, repositoryRoot) ||
    isSameOrWithin(repositoryRoot, output) ||
    isSameOrWithin(join(repositoryRoot, "node_modules"), output)
  ) {
    throw new Error("The output must be a dedicated fresh directory outside the source repository.");
  }

  const parent = dirname(output);
  await mkdir(parent, { recursive: true });
  const parentInformation = await lstat(parent);
  if (!parentInformation.isDirectory() || parentInformation.isSymbolicLink()) {
    throw new Error("The output parent must be a real directory, not a symbolic link.");
  }
  const resolvedParent = await realpath(parent);
  if (resolve(resolvedParent).toLowerCase() !== resolve(parent).toLowerCase()) {
    throw new Error("The output parent may not traverse a symbolic link or junction.");
  }

  const information = await lstat(output).catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (information) {
    if (!information.isDirectory() || information.isSymbolicLink()) {
      throw new Error("The output must be absent or an empty real directory.");
    }
    if ((await readdir(output)).length > 0) {
      throw new Error("The output directory must be empty; existing files are never overwritten or deleted.");
    }
  }
  return { existed: Boolean(information), information, parent };
}

async function copyPackage(source, destination) {
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, {
    recursive: true,
    force: false,
    errorOnExist: true,
    filter: (candidate) => {
      const path = relative(source, candidate);
      return path === "" || !path.split(sep).includes("node_modules");
    },
  });
}

async function assertRequiredRuntimeFiles(stagingRoot, manifest, target) {
  const requiredFiles = [...manifest.requiredFiles, ...(target.requiredFiles ?? [])];
  for (const requiredPath of requiredFiles) {
    const normalized = normalizedInstallPath(requiredPath, `Required runtime file ${requiredPath}`);
    const targetPath = resolve(stagingRoot, ...normalized.split("/"));
    if (!isSameOrWithin(stagingRoot, targetPath)) {
      throw new Error(`Required runtime path escapes staging: ${requiredPath}`);
    }
    const information = await stat(targetPath).catch(() => null);
    if (!information?.isFile() || information.size === 0) {
      throw new Error(`Required OCR runtime file is missing or empty: ${normalized}`);
    }
  }
}

async function inventoryFiles(root, directory = root) {
  const records = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Symbolic links are not permitted in staged OCR assets: ${relative(root, path)}`);
    }
    if (entry.isDirectory()) {
      records.push(...(await inventoryFiles(root, path)));
      continue;
    }
    if (!entry.isFile()) continue;
    const bytes = await readFile(path);
    records.push({
      path: portablePath(relative(root, path)),
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  return records;
}

async function fileEvidence(path, repositoryRoot) {
  const bytes = await readFile(path);
  return {
    path: portablePath(relative(repositoryRoot, path)),
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

async function commitStagingDirectory(stagingRoot, output, outputState) {
  if (outputState.existed) {
    const current = await lstat(output);
    if (
      !current.isDirectory() ||
      current.isSymbolicLink() ||
      current.dev !== outputState.information.dev ||
      current.ino !== outputState.information.ino ||
      (await readdir(output)).length !== 0
    ) {
      throw new Error("The output directory changed while offline OCR assets were staged.");
    }
    await rmdir(output);
    try {
      await rename(stagingRoot, output);
    } catch (error) {
      await mkdir(output).catch(() => undefined);
      throw error;
    }
    return;
  }
  await rename(stagingRoot, output);
}

async function main() {
  const output = readOutputArgument(process.argv.slice(2));
  const repositoryRoot = await findRepositoryRoot(packageRoot);
  const packageLockPath = join(repositoryRoot, "package-lock.json");
  const manifest = await readJson(manifestPath, "Offline OCR runtime manifest");
  const lock = await readJson(packageLockPath, "Repository package lock");

  assertOfflinePolicy(manifest);
  const target = selectTarget(manifest);
  const metadataByPath = selectPackageMetadata(manifest, target);
  await validateLockMetadata(repositoryRoot, lock, metadataByPath);
  const closure = await collectProductionClosure(repositoryRoot, manifest, metadataByPath);
  const outputState = await assertFreshOutput(repositoryRoot, output);
  const stagingRoot = await mkdtemp(
    join(outputState.parent, `.${basename(output)}.offline-ocr-staging-`),
  );
  let committed = false;

  try {
    for (const installed of [...closure.values()].sort((left, right) =>
      left.metadata.installPath.localeCompare(right.metadata.installPath),
    )) {
      await copyPackage(
        installed.root,
        resolve(stagingRoot, ...installed.metadata.installPath.split("/")),
      );
    }
    await assertRequiredRuntimeFiles(stagingRoot, manifest, target);

    const files = await inventoryFiles(stagingRoot);
    const packages = [...closure.values()]
      .map(({ metadata }) => ({
        name: metadata.name,
        version: metadata.version,
        installPath: metadata.installPath,
        resolved: metadata.resolved,
        integrity: metadata.integrity,
        license: metadata.license,
      }))
      .sort((left, right) => left.installPath.localeCompare(right.installPath));
    const evidence = {
      schemaVersion: 2,
      adapterId: manifest.adapterId,
      target: target.id,
      platform: process.platform,
      architecture: process.arch,
      policy: {
        offline: true,
        pathLookup: false,
        runtimeDownload: false,
        cloudFallback: false,
        networkAccess: "forbidden",
      },
      sources: {
        manifest: await fileEvidence(manifestPath, repositoryRoot),
        packageLock: {
          ...(await fileEvidence(packageLockPath, repositoryRoot)),
          lockfileVersion: lock.lockfileVersion,
        },
      },
      packages,
      files,
      totals: {
        packages: packages.length,
        files: files.length,
        bytes: files.reduce((total, file) => total + file.bytes, 0),
      },
    };
    await writeFile(
      join(stagingRoot, "offline-ocr-assets.lock.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    await commitStagingDirectory(stagingRoot, output, outputState);
    committed = true;
    process.stdout.write(
      `Staged ${evidence.totals.packages} packages and ${evidence.totals.files} offline OCR files (${evidence.totals.bytes} bytes) for ${target.id} in ${output}\n`,
    );
  } finally {
    if (!committed) {
      await rm(stagingRoot, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
    }
  }
}

await main();
