import type {
  CodingAssistantId,
  DiscoveredExecutable,
  ExecutableCandidate,
  ExecutableDiscoveryHost,
} from "./types.js";

const VERSION_ARGUMENTS = ["--version"] as const;
const MAX_VERSION_OUTPUT = 512;

function cleanEnvironmentPath(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim().replace(/[\\/]+$/, "");
  if (trimmed.length === 0 || trimmed.includes("\0")) return null;
  return trimmed;
}

function joinWindows(root: string, ...parts: readonly string[]): string {
  return [root, ...parts]
    .map((part, index) => index === 0 ? part.replace(/[\\/]+$/, "") : part.replace(/^[\\/]+|[\\/]+$/g, ""))
    .join("\\");
}

function candidate(
  assistantId: CodingAssistantId,
  path: string,
  source: ExecutableCandidate["source"] = "known-install-location",
): ExecutableCandidate {
  return { assistantId, path, source };
}

export function getKnownWindowsExecutableCandidates(
  environment: Readonly<Record<string, string | undefined>>,
): readonly ExecutableCandidate[] {
  const appData = cleanEnvironmentPath(environment.APPDATA);
  const localAppData = cleanEnvironmentPath(environment.LOCALAPPDATA);
  const userProfile = cleanEnvironmentPath(environment.USERPROFILE);
  const chocolateyInstall = cleanEnvironmentPath(environment.ChocolateyInstall);
  const candidates: ExecutableCandidate[] = [];

  if (appData !== null) {
    candidates.push(candidate("codex", joinWindows(appData, "npm", "codex.exe")));
    candidates.push(candidate("codex", joinWindows(appData, "npm", "codex.cmd")));
    candidates.push(candidate("opencode", joinWindows(appData, "npm", "opencode.exe")));
    candidates.push(candidate("opencode", joinWindows(appData, "npm", "opencode.cmd")));
    candidates.push(candidate("opencode", joinWindows(appData, "npm", "node_modules", "opencode-ai", "bin", "opencode.exe")));
    candidates.push(candidate("opencode", joinWindows(appData, "npm", "node_modules", "opencode-ai", "node_modules", "opencode-windows-x64", "bin", "opencode.exe")));
    candidates.push(candidate("opencode", joinWindows(appData, "npm", "node_modules", "opencode-ai", "node_modules", "opencode-windows-x64-baseline", "bin", "opencode.exe")));
  }
  if (localAppData !== null) {
    candidates.push(candidate("codex", joinWindows(localAppData, "Programs", "OpenAI", "Codex", "bin", "codex.exe")));
    candidates.push(candidate("codex", joinWindows(localAppData, "Microsoft", "WinGet", "Links", "codex.exe")));
    candidates.push(candidate("codex", joinWindows(localAppData, "pnpm", "codex.exe")));
    candidates.push(candidate("codex", joinWindows(localAppData, "pnpm", "codex.cmd")));
    candidates.push(candidate("opencode", joinWindows(localAppData, "Microsoft", "WinGet", "Links", "opencode.exe")));
    candidates.push(candidate("opencode", joinWindows(localAppData, "pnpm", "opencode.exe")));
    candidates.push(candidate("opencode", joinWindows(localAppData, "pnpm", "opencode.cmd")));
  }
  if (userProfile !== null) {
    candidates.push(candidate("codex", joinWindows(userProfile, ".bun", "bin", "codex.exe")));
    candidates.push(candidate("codex", joinWindows(userProfile, "scoop", "shims", "codex.exe")));
    candidates.push(candidate("opencode", joinWindows(userProfile, ".opencode", "bin", "opencode.exe")));
    candidates.push(candidate("opencode", joinWindows(userProfile, ".bun", "bin", "opencode.exe")));
    candidates.push(candidate("opencode", joinWindows(userProfile, "scoop", "shims", "opencode.exe")));
  }
  if (chocolateyInstall !== null) {
    candidates.push(candidate("codex", joinWindows(chocolateyInstall, "bin", "codex.exe")));
    candidates.push(candidate("opencode", joinWindows(chocolateyInstall, "bin", "opencode.exe")));
  }
  return candidates;
}

function isAbsolutePath(path: string, platform: ExecutableDiscoveryHost["platform"]): boolean {
  if (platform === "win32") return /^[A-Za-z]:[\\/]/.test(path) || /^\\\\[^\\]+\\[^\\]+/.test(path);
  return path.startsWith("/");
}

function isNativeExecutable(path: string, platform: ExecutableDiscoveryHost["platform"]): boolean {
  if (platform !== "win32") return true;
  return path.toLowerCase().endsWith(".exe");
}

function parseVersion(result: { readonly stdout: string; readonly stderr: string }): string | null {
  const output = `${result.stdout}\n${result.stderr}`.trim().slice(0, MAX_VERSION_OUTPUT);
  const match = output.match(/\bv?\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?\b/);
  return match?.[0] ?? null;
}

export async function discoverCodingAssistantExecutables(
  host: ExecutableDiscoveryHost,
): Promise<readonly DiscoveredExecutable[]> {
  const candidates = host.platform === "win32"
    ? [...getKnownWindowsExecutableCandidates(host.environment)]
    : [];

  for (const assistantId of ["codex", "opencode"] as const) {
    const resolved = await host.resolveOnPath(assistantId);
    if (resolved !== null && isAbsolutePath(resolved, host.platform)) {
      candidates.push(candidate(assistantId, resolved, "path-lookup"));
    }
  }

  const unique = new Map<string, ExecutableCandidate>();
  for (const item of candidates) {
    unique.set(`${item.assistantId}:${item.path.toLowerCase()}`, item);
  }

  const discovered: DiscoveredExecutable[] = [];
  for (const item of unique.values()) {
    if (!isAbsolutePath(item.path, host.platform) || !(await host.isFile(item.path))) continue;
    const native = isNativeExecutable(item.path, host.platform);
    if (!native) {
      discovered.push({
        ...item,
        version: null,
        launchable: false,
        blocker: "This installation is a command wrapper. The guided launcher only starts native executables directly and never invokes a shell.",
      });
      continue;
    }
    const probe = await host.probeDirect(item.path, VERSION_ARGUMENTS, { timeoutMs: 5_000 });
    const version = probe.exitCode === 0 && !probe.timedOut ? parseVersion(probe) : null;
    discovered.push({
      ...item,
      version,
      launchable: version !== null,
      ...(version === null ? {
        blocker: "The executable did not return a bounded, recognizable version from the documented --version probe.",
      } : {}),
    });
  }
  return discovered;
}
