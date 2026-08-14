import type {
  CodingAssistantProfile,
  CodingAssistantProfileId,
} from "./types.js";

const OPENAI_CLI_REFERENCE = {
  title: "OpenAI Codex CLI developer command reference",
  url: "https://developers.openai.com/codex/cli/reference",
  retrievedOn: "2026-08-14",
} as const;

const OPENCODE_CLI_REFERENCE = {
  title: "OpenCode CLI reference",
  url: "https://opencode.ai/docs/cli",
  retrievedOn: "2026-08-14",
} as const;

const OPENCODE_AGENT_REFERENCE = {
  title: "OpenCode agent reference",
  url: "https://opencode.ai/docs/agents",
  retrievedOn: "2026-08-14",
} as const;

const OPENCODE_PERMISSION_REFERENCE = {
  title: "OpenCode permission reference",
  url: "https://opencode.ai/docs/permissions",
  retrievedOn: "2026-08-14",
} as const;

export const CODING_ASSISTANT_PROFILES: readonly CodingAssistantProfile[] = Object.freeze([
  {
    id: "codex-read-only",
    assistantId: "codex",
    label: "Codex — inspect and explain",
    description: "Recommended. Uses non-interactive execution with a read-only sandbox and approval prompts.",
    recommended: true,
    access: "read-only",
    approvalBehaviour: "ask-before-actions",
    officialSources: [OPENAI_CLI_REFERENCE],
  },
  {
    id: "codex-workspace-write",
    assistantId: "codex",
    label: "Codex — edit this workspace",
    description: "Allows workspace writes while retaining approval prompts. Review all proposed changes before accepting them.",
    recommended: false,
    access: "workspace-write",
    approvalBehaviour: "ask-before-actions",
    officialSources: [OPENAI_CLI_REFERENCE],
  },
  {
    id: "opencode-plan",
    assistantId: "opencode",
    label: "OpenCode — plan and explain",
    description: "Recommended. Uses the built-in Plan agent, whose edits and shell actions ask for approval.",
    recommended: true,
    access: "read-only",
    approvalBehaviour: "ask-before-actions",
    officialSources: [
      OPENCODE_CLI_REFERENCE,
      OPENCODE_AGENT_REFERENCE,
      OPENCODE_PERMISSION_REFERENCE,
    ],
  },
  {
    id: "opencode-build",
    assistantId: "opencode",
    label: "OpenCode — edit this workspace",
    description: "Uses the built-in Build agent without auto-approval. Review each requested permission and every resulting change.",
    recommended: false,
    access: "workspace-write",
    approvalBehaviour: "ask-before-actions",
    officialSources: [
      OPENCODE_CLI_REFERENCE,
      OPENCODE_AGENT_REFERENCE,
      OPENCODE_PERMISSION_REFERENCE,
    ],
  },
]);

export function getCodingAssistantProfile(
  profileId: CodingAssistantProfileId,
): CodingAssistantProfile | undefined {
  return CODING_ASSISTANT_PROFILES.find((profile) => profile.id === profileId);
}
