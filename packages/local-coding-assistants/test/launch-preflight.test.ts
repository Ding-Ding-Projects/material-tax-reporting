/**
 * The guided launcher accepts only the fixed argument arrays its enumerated
 * profiles produce. A plan that reached the launcher with a mutated argument
 * list must be refused before any process is started, so that an accepted
 * preview cannot be edited into a different command afterwards.
 */

import assert from "node:assert/strict";
import test from "node:test";

const { preflightAssistantLaunch, launchCodingAssistant } = await import("../src/launch.ts");
type LaunchModule = typeof import("../src/launch.ts");
type LaunchPlan = Awaited<ReturnType<LaunchModule["preflightAssistantLaunch"]>> extends infer Result
  ? Result extends { state: "ready"; plan: infer Plan }
    ? Plan
    : never
  : never;

const WORKSPACE_ROOT = "/projects";
const WORKING_DIRECTORY = "/projects/example";
const EXECUTABLE_PATH = "/opt/example/bin/codex";

const DISCOVERED = [
  {
    assistantId: "codex" as const,
    path: EXECUTABLE_PATH,
    source: "known-install-location" as const,
    version: "1.0.0",
    launchable: true,
  },
];

class RecordingHost {
  calls: Array<{ executablePath: string; args: readonly string[]; shell: false }> = [];

  async spawnDirect(
    executablePath: string,
    args: readonly string[],
    options: Readonly<{ cwd: string; stdin: string | null; environment: Readonly<Record<string, string>>; shell: false }>,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    this.calls.push({ executablePath, args, shell: options.shell });
    return { exitCode: 0, stdout: "", stderr: "" };
  }
}

async function readyPlan(): Promise<LaunchPlan> {
  const result = await preflightAssistantLaunch(
    {
      profileId: "codex-read-only",
      executablePath: EXECUTABLE_PATH,
      workingDirectory: WORKING_DIRECTORY,
      userInstruction: "Summarise the local project layout.",
      contextItems: [],
      promptPreviewAccepted: true,
      providerNetworkDisclosureAccepted: true,
    },
    DISCOVERED,
    [WORKSPACE_ROOT],
    async () => true,
  );
  assert.equal(result.state, "ready", "the fixture selection must preflight cleanly");
  if (result.state !== "ready") throw new Error("unreachable");
  return result.plan;
}

test("an accepted plan launches directly, without a shell, using the profile's fixed arguments", async () => {
  const plan = await readyPlan();
  const host = new RecordingHost();

  await launchCodingAssistant(plan, DISCOVERED, [WORKSPACE_ROOT], host);

  assert.equal(host.calls.length, 1);
  assert.equal(host.calls[0]?.shell, false);
  assert.deepEqual(host.calls[0]?.args, [
    "exec",
    "--cd",
    WORKING_DIRECTORY,
    "--sandbox",
    "read-only",
    "--ask-for-approval",
    "on-request",
    "--ephemeral",
    "-",
  ]);
});

test("a mutated argument list is refused and never reaches the process launcher", async () => {
  const plan = await readyPlan();
  const host = new RecordingHost();
  const tampered = { ...plan, args: [...plan.args, "--dangerously-bypass-approvals-and-sandbox"] };

  await assert.rejects(
    launchCodingAssistant(tampered, DISCOVERED, [WORKSPACE_ROOT], host),
    /launch arguments are not one of the supported fixed profiles/,
  );
  assert.deepEqual(host.calls, []);
});

test("a replaced sandbox argument is refused even when the argument count is unchanged", async () => {
  const plan = await readyPlan();
  const host = new RecordingHost();
  const tampered = { ...plan, args: plan.args.map((arg) => (arg === "read-only" ? "danger-full-access" : arg)) };

  await assert.rejects(
    launchCodingAssistant(tampered, DISCOVERED, [WORKSPACE_ROOT], host),
    /launch arguments are not one of the supported fixed profiles/,
  );
  assert.deepEqual(host.calls, []);
});

test("an environment override is refused by the guided launcher", async () => {
  const plan = await readyPlan();
  const host = new RecordingHost();
  const tampered = { ...plan, environment: { INJECTED: "value" } };

  await assert.rejects(
    launchCodingAssistant(tampered, DISCOVERED, [WORKSPACE_ROOT], host),
    /Environment overrides are not accepted/,
  );
  assert.deepEqual(host.calls, []);
});

test("a working directory outside the allowed roots is refused at launch time", async () => {
  const plan = await readyPlan();
  const host = new RecordingHost();
  const tampered = { ...plan, workingDirectory: "/projects/../elsewhere" };

  await assert.rejects(
    launchCodingAssistant(tampered, DISCOVERED, [WORKSPACE_ROOT], host),
    /outside the current allowed workspace roots/,
  );
  assert.deepEqual(host.calls, []);
});

test("an executable that is no longer in the discovery results is refused at launch time", async () => {
  const plan = await readyPlan();
  const host = new RecordingHost();

  await assert.rejects(
    launchCodingAssistant(plan, [], [WORKSPACE_ROOT], host),
    /not in the current approved discovery results/,
  );
  assert.deepEqual(host.calls, []);
});
