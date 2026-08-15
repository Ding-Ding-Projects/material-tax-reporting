import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const agentName = "Claude Fable 5";
const agentTrailer = "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>";
const categoryOrder = [
  "Source",
  "Tests",
  "Styles and markup",
  "Generated",
  "Documentation and configuration",
  "Excluded: vendor and dependencies",
  "Excluded: build output",
  "Excluded: lockfiles",
  "Excluded: binary assets",
];

function git(args, options = {}) {
  return execFileSync("git", ["-C", repositoryRoot, ...args], {
    encoding: options.encoding ?? "utf8",
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
  });
}

function classify(file) {
  const normalized = file.replaceAll("\\", "/");
  const lower = normalized.toLowerCase();
  const segments = lower.split("/");
  const base = segments.at(-1);
  const extension = path.extname(lower);
  if (segments.some((segment) => ["vendor", "vendors", "third_party", "third-party", "node_modules"].includes(segment))) {
    return "Excluded: vendor and dependencies";
  }
  if (segments.some((segment) => ["dist", "build", "out", "coverage", "release", "artifacts"].includes(segment))) {
    return "Excluded: build output";
  }
  if (["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml"].includes(base)) {
    return "Excluded: lockfiles";
  }
  if (segments.includes("generated") || /(?:^|[._-])generated(?:[._-]|$)/.test(base)) return "Generated";
  if (
    segments.some((segment) => ["test", "tests", "spec", "specs", "__tests__"].includes(segment)) ||
    /\.(?:test|spec)\.[^.]+$/.test(lower)
  ) {
    return "Tests";
  }
  if ([".css", ".scss", ".sass", ".less", ".html", ".htm", ".svg", ".xml", ".xaml"].includes(extension)) {
    return "Styles and markup";
  }
  if ([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".go", ".rs", ".cs", ".cpp", ".cc", ".c", ".h", ".hpp", ".ps1", ".bat", ".sh"].includes(extension)) {
    return "Source";
  }
  return "Documentation and configuration";
}

const files = git(["ls-files", "-z"], { encoding: "buffer" })
  .toString("utf8")
  .split("\0")
  .filter(Boolean);
const rows = new Map(categoryOrder.map((category) => [category, { total: 0, nonblank: 0, agent: 0, people: 0, files: 0 }]));
const agentCommits = new Map();
const binaryFiles = [];

function commitIsAgent(commit) {
  if (agentCommits.has(commit)) return agentCommits.get(commit);
  const metadata = git(["show", "-s", "--format=%an%n%B", commit]);
  const [author, ...bodyLines] = metadata.split(/\r?\n/);
  const result = author === agentName || bodyLines.join("\n").includes(agentTrailer);
  agentCommits.set(commit, result);
  return result;
}

for (const file of files) {
  const blob = git(["show", `HEAD:${file}`], { encoding: "buffer" });
  if (blob.includes(0)) {
    binaryFiles.push(file);
    rows.get("Excluded: binary assets").files += 1;
    continue;
  }

  const category = classify(file);
  const row = rows.get(category);
  row.files += 1;
  const blame = git(["blame", "--root", "--line-porcelain", "HEAD", "--", file]);
  let currentCommit = null;
  for (const line of blame.split(/\r?\n/)) {
    const header = /^([0-9a-f]{40}) \d+ \d+(?: \d+)?$/.exec(line);
    if (header) {
      currentCommit = header[1];
      continue;
    }
    if (!line.startsWith("\t")) continue;
    if (!currentCommit) throw new Error(`Could not attribute a surviving line in ${file}.`);
    row.total += 1;
    if (line.slice(1).trim().length > 0) row.nonblank += 1;
    if (commitIsAgent(currentCommit)) row.agent += 1;
    else row.people += 1;
  }
}

for (const [category, row] of rows) {
  if (row.agent + row.people !== row.total) {
    throw new Error(`${category} attribution ${row.agent + row.people} does not equal its ${row.total} surviving lines.`);
  }
}

function sumRows(predicate) {
  const sum = { total: 0, nonblank: 0, agent: 0, people: 0, files: 0 };
  for (const [category, row] of rows) {
    if (!predicate(category)) continue;
    for (const key of Object.keys(sum)) sum[key] += row[key];
  }
  return sum;
}

const projectTotal = sumRows((category) => !category.startsWith("Excluded:"));
const grandTotal = sumRows(() => true);
if (projectTotal.agent + projectTotal.people !== projectTotal.total || grandTotal.agent + grandTotal.people !== grandTotal.total) {
  throw new Error("Line-count totals and surviving-line attribution do not agree.");
}

const commit = git(["rev-parse", "HEAD"]).trim();
const output = [
  "## Project line count",
  "",
  `Counted at commit \`${commit}\` with \`npm run count:lines\`.`,
  "",
  "| Category | Tracked text files | Total lines | Non-blank lines | Claude Fable 5 | People |",
  "| --- | ---: | ---: | ---: | ---: | ---: |",
];
for (const category of categoryOrder) {
  const row = rows.get(category);
  output.push(`| ${category} | ${row.files} | ${row.total} | ${row.nonblank} | ${row.agent} | ${row.people} |`);
}
output.push(
  `| **Project total** | **${projectTotal.files}** | **${projectTotal.total}** | **${projectTotal.nonblank}** | **${projectTotal.agent}** | **${projectTotal.people}** |`,
  `| **Grand total of tracked text** | **${grandTotal.files}** | **${grandTotal.total}** | **${grandTotal.nonblank}** | **${grandTotal.agent}** | **${grandTotal.people}** |`,
  "",
  "Project total excludes dependency/vendor trees, build output, lockfiles, and binary assets. Generated text is reported separately and remains inside the project total. Attribution counts surviving lines with `git blame`; a line is attributed to Claude Fable 5 when its commit author is Claude Fable 5 or its commit contains the required Claude Fable 5 co-author trailer. All other surviving lines are reported as people-authored.",
  "",
  binaryFiles.length > 0
    ? `Binary tracked assets excluded from line totals: ${binaryFiles.map((file) => `\`${file}\``).join(", ")}.`
    : "No tracked binary assets were found.",
);
process.stdout.write(`${output.join("\n")}\n`);

