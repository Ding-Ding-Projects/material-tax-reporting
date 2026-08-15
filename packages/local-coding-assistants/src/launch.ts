import { getCodingAssistantProfile } from "./profiles.ts";
import { createPromptPreview } from "./prompt.ts";
import type {
  CodingAssistantProfile,
  DirectLaunchHost,
  DiscoveredExecutable,
  LaunchBlocker,
  LaunchPlan,
  LaunchPreflightResult,
  LaunchProcessResult,
  LaunchSelection,
} from "./types.ts";

const ABSOLUTE_WINDOWS_PATH = /^(?:[A-Za-z]:[\\/]|\\\\[^\\]+\\[^\\]+)/;
const ABSOLUTE_POSIX_PATH = /^\//;

function isAbsolute(path: string): boolean {
  return ABSOLUTE_WINDOWS_PATH.test(path) || ABSOLUTE_POSIX_PATH.test(path);
}

function comparablePath(path: string): string {
  const slashed = path.replace(/\\/g, "/");
  const rootMatch = slashed.match(/^(?:([A-Za-z]:)|\/\/([^/]+\/[^/]+)|(\/))/);
  const root = rootMatch?.[0] ?? "";
  const remainder = slashed.slice(root.length);
  const segments: string[] = [];
  for (const segment of remainder.split("/")) {
    if (segment.length === 0 || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return `${root}${segments.join("/")}`.replace(/\/+$/, "").toLowerCase();
}

function isPathWithin(path: string, root: string): boolean {
  const candidate = comparablePath(path);
  const boundary = comparablePath(root);
  return candidate === boundary || candidate.startsWith(`${boundary}/`);
}

function buildArgs(profile: CodingAssistantProfile, workingDirectory: string): {
  readonly args: readonly string[];
  readonly promptTransport: LaunchPlan["promptTransport"];
} {
  switch (profile.id) {
    case "codex-read-only":
      return {
        args: ["exec", "--cd", workingDirectory, "--sandbox", "read-only", "--ask-for-approval", "on-request", "--ephemeral", "-"],
        promptTransport: "stdin",
      };
    case "codex-workspace-write":
      return {
        args: ["exec", "--cd", workingDirectory, "--sandbox", "workspace-write", "--ask-for-approval", "on-request", "--ephemeral", "-"],
        promptTransport: "stdin",
      };
    case "opencode-plan":
      return {
        args: ["--pure", "run", "--agent", "plan", "--dir", workingDirectory],
        promptTransport: "single-argument",
      };
    case "opencode-build":
      return {
        args: ["--pure", "run", "--agent", "build", "--dir", workingDirectory],
        promptTransport: "single-argument",
      };
  }
}

export async function preflightAssistantLaunch(
  selection: LaunchSelection,
  discoveredExecutables: readonly DiscoveredExecutable[],
  allowedWorkspaceRoots: readonly string[],
  isDirectory: (path: string) => Promise<boolean>,
): Promise<LaunchPreflightResult> {
  const preview = createPromptPreview(
    selection.userInstruction,
    selection.contextItems,
    selection.explicitSensitiveValues ?? [],
  );
  const blockers: LaunchBlocker[] = [];
  const profile = getCodingAssistantProfile(selection.profileId);
  if (profile === undefined) {
    blockers.push({ code: "unknown-profile", message: `Unknown coding-assistant profile: ${selection.profileId}.` });
  }
  const executable = discoveredExecutables.find((item) => comparablePath(item.path) === comparablePath(selection.executablePath));
  if (executable === undefined) {
    blockers.push({ code: "executable-not-discovered", message: "Choose an executable from the current discovery results." });
  } else {
    if (profile !== undefined && executable.assistantId !== profile.assistantId) {
      blockers.push({ code: "assistant-mismatch", message: "The chosen executable does not match the selected profile." });
    }
    if (!executable.launchable || executable.version === null) {
      blockers.push({ code: "executable-not-launchable", message: executable.blocker ?? "The chosen executable is not launchable." });
    }
  }
  if (!isAbsolute(selection.workingDirectory)) {
    blockers.push({ code: "working-directory-not-absolute", message: "Choose an absolute local project directory." });
  } else if (!allowedWorkspaceRoots.some((root) => isPathWithin(selection.workingDirectory, root))) {
    blockers.push({ code: "working-directory-not-allowlisted", message: "Choose a project directory inside an explicitly allowed workspace root." });
  } else if (!(await isDirectory(selection.workingDirectory))) {
    blockers.push({ code: "working-directory-missing", message: "The selected project directory does not exist." });
  }
  if (selection.userInstruction.trim().length === 0) {
    blockers.push({ code: "empty-instruction", message: "Describe the exact local assistance needed." });
  }
  const unreviewed = selection.contextItems.some((item) => item.selected && !item.userReviewedSource);
  if (unreviewed) {
    blockers.push({ code: "context-not-reviewed", message: "Review every selected context item before including it." });
  }
  if (!selection.promptPreviewAccepted) {
    blockers.push({ code: "preview-not-accepted", message: "Review and accept the exact redacted prompt preview before launch." });
  }
  if (!selection.providerNetworkDisclosureAccepted) {
    blockers.push({
      code: "network-disclosure-not-accepted",
      message: "Acknowledge that the local CLI may send the reviewed prompt to its configured model provider.",
    });
  }

  if (profile === undefined || executable === undefined || executable.version === null || blockers.length > 0) {
    return { state: "blocked", blockers, preview };
  }
  const invocation = buildArgs(profile, selection.workingDirectory);
  const args = invocation.promptTransport === "single-argument"
    ? [...invocation.args, preview.text]
    : invocation.args;
  return {
    state: "ready",
    plan: {
      assistantId: profile.assistantId,
      profileId: profile.id,
      executablePath: executable.path,
      executableVersion: executable.version,
      workingDirectory: selection.workingDirectory,
      args,
      promptTransport: invocation.promptTransport,
      prompt: preview.text,
      preview,
      preflight: [
        `Executable: ${executable.path}`,
        `Version: ${executable.version}`,
        `Profile: ${profile.label}`,
        `Working directory: ${selection.workingDirectory}`,
        `Access: ${profile.access}`,
        "Approvals: ask before actions; automatic approval is not enabled",
        `Fixed arguments before prompt: ${invocation.args.join(" ")}`,
        `Prompt transport: ${invocation.promptTransport}`,
        `Selected context items: ${preview.selectedContextIds.length}`,
        `Detected redactions: ${preview.redactions.reduce((sum, item) => sum + item.count, 0)}`,
        "Electronic filing: unsupported",
        "Manual PDF and taxpayer review: required",
      ],
      environment: {},
    },
  };
}

function assertLaunchPlan(
  plan: LaunchPlan,
  approvedExecutables: readonly DiscoveredExecutable[],
  allowedWorkspaceRoots: readonly string[],
): void {
  const profile = getCodingAssistantProfile(plan.profileId);
  if (profile === undefined || profile.assistantId !== plan.assistantId) throw new Error("The launch plan profile is invalid.");
  if (!isAbsolute(plan.executablePath) || !isAbsolute(plan.workingDirectory)) throw new Error("The launch plan paths must be absolute.");
  const approvedExecutable = approvedExecutables.find((item) =>
    item.assistantId === plan.assistantId &&
    item.launchable &&
    item.version === plan.executableVersion &&
    comparablePath(item.path) === comparablePath(plan.executablePath)
  );
  if (approvedExecutable === undefined) throw new Error("The executable is not in the current approved discovery results.");
  if (!allowedWorkspaceRoots.some((root) => isPathWithin(plan.workingDirectory, root))) {
    throw new Error("The working directory is outside the current allowed workspace roots.");
  }
  if (!plan.executablePath.toLowerCase().endsWith(".exe") && /^[A-Za-z]:/.test(plan.executablePath)) {
    throw new Error("The guided Windows launcher accepts native executable files only.");
  }
  const expected = buildArgs(profile, plan.workingDirectory);
  const expectedArgs = expected.promptTransport === "single-argument" ? [...expected.args, plan.prompt] : expected.args;
  if (expected.promptTransport !== plan.promptTransport || expectedArgs.length !== plan.args.length || expectedArgs.some((arg, index) => arg !== plan.args[index])) {
    throw new Error("The launch arguments are not one of the supported fixed profiles.");
  }
  if (Object.keys(plan.environment).length > 0) throw new Error("Environment overrides are not accepted by the guided launcher.");
}

export async function launchCodingAssistant(
  plan: LaunchPlan,
  approvedExecutables: readonly DiscoveredExecutable[],
  allowedWorkspaceRoots: readonly string[],
  host: DirectLaunchHost,
): Promise<LaunchProcessResult> {
  assertLaunchPlan(plan, approvedExecutables, allowedWorkspaceRoots);
  return host.spawnDirect(plan.executablePath, plan.args, {
    cwd: plan.workingDirectory,
    stdin: plan.promptTransport === "stdin" ? plan.prompt : null,
    environment: {},
    shell: false,
  });
}
