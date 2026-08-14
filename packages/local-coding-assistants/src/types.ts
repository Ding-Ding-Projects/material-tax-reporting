export type CodingAssistantId = "codex" | "opencode";

export type CodingAssistantProfileId =
  | "codex-read-only"
  | "codex-workspace-write"
  | "opencode-plan"
  | "opencode-build";

export interface OfficialDocumentationSource {
  readonly title: string;
  readonly url: `https://${string}`;
  readonly retrievedOn: "2026-08-14";
}

export interface CodingAssistantProfile {
  readonly id: CodingAssistantProfileId;
  readonly assistantId: CodingAssistantId;
  readonly label: string;
  readonly description: string;
  readonly recommended: boolean;
  readonly access: "read-only" | "workspace-write";
  readonly approvalBehaviour: "ask-before-actions";
  readonly officialSources: readonly OfficialDocumentationSource[];
}

export interface ExecutableCandidate {
  readonly assistantId: CodingAssistantId;
  readonly path: string;
  readonly source: "known-install-location" | "path-lookup";
}

export interface ExecutableProbeResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
}

export interface ExecutableDiscoveryHost {
  readonly platform: "win32" | "linux" | "darwin";
  readonly environment: Readonly<Record<string, string | undefined>>;
  isFile(path: string): Promise<boolean>;
  resolveOnPath(command: string): Promise<string | null>;
  probeDirect(
    executablePath: string,
    args: readonly string[],
    options: Readonly<{ timeoutMs: number }>,
  ): Promise<ExecutableProbeResult>;
}

export interface DiscoveredExecutable extends ExecutableCandidate {
  readonly version: string | null;
  readonly launchable: boolean;
  readonly blocker?: string;
}

export type ContextKind =
  | "project-summary"
  | "report-summary"
  | "tax-document-excerpt";

export interface AssistantContextItem {
  readonly id: string;
  readonly kind: ContextKind;
  readonly label: string;
  readonly content: string;
  readonly selected: boolean;
  readonly containsTaxpayerData: boolean;
  readonly userReviewedSource: boolean;
}

export interface PromptRedaction {
  readonly kind:
    | "sin"
    | "email"
    | "phone"
    | "credential"
    | "explicit-sensitive-span";
  readonly count: number;
}

export interface PromptPreview {
  readonly text: string;
  readonly selectedContextIds: readonly string[];
  readonly redactions: readonly PromptRedaction[];
  readonly containsTaxpayerData: boolean;
  readonly notices: readonly string[];
  readonly deliveryBoundary: {
    readonly electronicFilingSupported: false;
    readonly automaticFilingSupported: false;
    readonly taxpayerReviewRequired: true;
    readonly manualPdfReviewRequired: true;
  };
}

export interface LaunchSelection {
  readonly profileId: CodingAssistantProfileId;
  readonly executablePath: string;
  readonly workingDirectory: string;
  readonly userInstruction: string;
  readonly contextItems: readonly AssistantContextItem[];
  readonly explicitSensitiveValues?: readonly string[];
  readonly promptPreviewAccepted: boolean;
  readonly providerNetworkDisclosureAccepted: boolean;
}

export interface LaunchBlocker {
  readonly code:
    | "unknown-profile"
    | "assistant-mismatch"
    | "executable-not-discovered"
    | "executable-not-launchable"
    | "working-directory-not-absolute"
    | "working-directory-not-allowlisted"
    | "working-directory-missing"
    | "empty-instruction"
    | "context-not-reviewed"
    | "preview-not-accepted"
    | "network-disclosure-not-accepted";
  readonly message: string;
}

export interface LaunchPlan {
  readonly assistantId: CodingAssistantId;
  readonly profileId: CodingAssistantProfileId;
  readonly executablePath: string;
  readonly executableVersion: string;
  readonly workingDirectory: string;
  readonly args: readonly string[];
  readonly promptTransport: "stdin" | "single-argument";
  readonly prompt: string;
  readonly preview: PromptPreview;
  readonly preflight: readonly string[];
  readonly environment: Readonly<Record<string, string>>;
}

export type LaunchPreflightResult =
  | {
      readonly state: "ready";
      readonly plan: LaunchPlan;
    }
  | {
      readonly state: "blocked";
      readonly blockers: readonly LaunchBlocker[];
      readonly preview: PromptPreview;
    };

export interface LaunchProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface DirectLaunchHost {
  spawnDirect(
    executablePath: string,
    args: readonly string[],
    options: Readonly<{
      cwd: string;
      stdin: string | null;
      environment: Readonly<Record<string, string>>;
      shell: false;
    }>,
  ): Promise<LaunchProcessResult>;
}
