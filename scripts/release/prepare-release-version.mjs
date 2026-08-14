import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
const runNumber = Number.parseInt(process.argv[2] ?? "", 10);
const runAttempt = Number.parseInt(process.argv[3] ?? "", 10);
if (!Number.isSafeInteger(runNumber) || runNumber <= 0 || !Number.isSafeInteger(runAttempt) || runAttempt <= 0 || runAttempt >= 1000) {
  throw new Error("Release version preparation requires a positive run number and a run attempt from 1 through 999.");
}

const version = `0.1.${runNumber * 1000 + runAttempt}`;
const tag = `v${version}`;
const rootPackagePath = path.join(repositoryRoot, "package.json");
const desktopPackagePath = path.join(repositoryRoot, "apps", "desktop", "package.json");
const lockPath = path.join(repositoryRoot, "package-lock.json");
const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));
const desktopPackage = JSON.parse(await readFile(desktopPackagePath, "utf8"));
const lock = JSON.parse(await readFile(lockPath, "utf8"));

rootPackage.version = version;
desktopPackage.version = version;
lock.version = version;
if (!lock.packages?.[""] || !lock.packages?.["apps/desktop"]) {
  throw new Error("package-lock.json is missing the root or desktop workspace record.");
}
lock.packages[""].version = version;
lock.packages["apps/desktop"].version = version;

await writeFile(rootPackagePath, `${JSON.stringify(rootPackage, null, 2)}\n`, "utf8");
await writeFile(desktopPackagePath, `${JSON.stringify(desktopPackage, null, 2)}\n`, "utf8");
await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ version, tag })}\n`);

