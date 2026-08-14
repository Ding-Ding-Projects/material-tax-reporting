import type {
  AssistantContextItem,
  PromptPreview,
  PromptRedaction,
} from "./types.js";

const MAX_INSTRUCTION_LENGTH = 8_000;
const MAX_CONTEXT_ITEM_LENGTH = 24_000;
const MAX_CONTEXT_ITEMS = 20;

interface RedactionRule {
  readonly kind: PromptRedaction["kind"];
  readonly pattern: RegExp;
  readonly replacement: string;
}

const REDACTION_RULES: readonly RedactionRule[] = [
  { kind: "sin", pattern: /\b\d{3}[ -]?\d{3}[ -]?\d{3}\b/g, replacement: "[REDACTED SIN]" },
  { kind: "email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[REDACTED EMAIL]" },
  { kind: "phone", pattern: /\b(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/g, replacement: "[REDACTED PHONE]" },
  {
    kind: "credential",
    pattern: /\b(?:api[_ -]?key|access[_ -]?token|password|secret)\s*[:=]\s*[^\s,;]+/gi,
    replacement: "[REDACTED CREDENTIAL]",
  },
];

function replaceLiteral(value: string, needle: string): { readonly text: string; readonly count: number } {
  if (needle.length === 0) return { text: value, count: 0 };
  let count = 0;
  let cursor = 0;
  let output = "";
  while (cursor < value.length) {
    const index = value.indexOf(needle, cursor);
    if (index < 0) {
      output += value.slice(cursor);
      break;
    }
    output += `${value.slice(cursor, index)}[REDACTED SENSITIVE VALUE]`;
    count += 1;
    cursor = index + needle.length;
  }
  return { text: output, count };
}

function redact(
  input: string,
  explicitSensitiveValues: readonly string[],
): { readonly text: string; readonly redactions: readonly PromptRedaction[] } {
  let text = input;
  const counts = new Map<PromptRedaction["kind"], number>();
  for (const sensitiveValue of explicitSensitiveValues) {
    const result = replaceLiteral(text, sensitiveValue);
    text = result.text;
    if (result.count > 0) counts.set("explicit-sensitive-span", (counts.get("explicit-sensitive-span") ?? 0) + result.count);
  }
  for (const rule of REDACTION_RULES) {
    let count = 0;
    text = text.replace(rule.pattern, () => {
      count += 1;
      return rule.replacement;
    });
    if (count > 0) counts.set(rule.kind, (counts.get(rule.kind) ?? 0) + count);
  }
  return {
    text,
    redactions: [...counts].map(([kind, count]) => ({ kind, count })),
  };
}

function normalizeContextItem(item: AssistantContextItem): string {
  return item.content.trim().slice(0, MAX_CONTEXT_ITEM_LENGTH);
}

export function createPromptPreview(
  userInstruction: string,
  contextItems: readonly AssistantContextItem[],
  explicitSensitiveValues: readonly string[] = [],
): PromptPreview {
  const selected = contextItems.filter((item) => item.selected).slice(0, MAX_CONTEXT_ITEMS);
  const sections = selected.map((item) => [
    `Context: ${item.label}`,
    `Context type: ${item.kind}`,
    normalizeContextItem(item),
  ].join("\n"));
  const rawPrompt = [
    "Assist with local tax-report preparation work only.",
    "Do not submit, transmit, or electronically file any tax return. Do not claim that a return has been filed.",
    "Treat all calculations, form mappings, mailing information, attachments, and signature fields as requiring taxpayer review.",
    "Any generated PDF remains blocked on the application's complete manual PDF review and acknowledgement workflow.",
    "This coding assistant can help locally, but it does not replace taxpayer review, professional advice, or current official instructions.",
    "",
    `Requested assistance: ${userInstruction.trim().slice(0, MAX_INSTRUCTION_LENGTH)}`,
    ...(sections.length === 0 ? [] : ["", ...sections]),
  ].join("\n\n");
  const redacted = redact(rawPrompt, explicitSensitiveValues);
  const containsTaxpayerData = selected.some((item) =>
    item.containsTaxpayerData || item.kind === "tax-document-excerpt"
  );

  return {
    text: redacted.text,
    selectedContextIds: selected.map((item) => item.id),
    redactions: redacted.redactions,
    containsTaxpayerData,
    notices: [
      "Only the selected, redacted text shown in this preview will be handed to the chosen local CLI.",
      "The local CLI may contact its configured model provider. Review provider privacy and retention settings before continuing.",
      "Source tax documents are never attached automatically. A tax-document excerpt requires an explicit selection and source review.",
      "The coding assistant assists locally and never replaces taxpayer review.",
    ],
    deliveryBoundary: {
      electronicFilingSupported: false,
      automaticFilingSupported: false,
      taxpayerReviewRequired: true,
      manualPdfReviewRequired: true,
    },
  };
}
