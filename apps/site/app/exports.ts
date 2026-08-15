"use client";

/**
 * Export delivery.
 *
 * Serialization, the manifest and the CSV cell neutralization are kernel
 * functions. This module owns only delivery: writing to a folder the reader
 * chooses where the browser supports it, a plain download elsewhere, and a
 * copy-to-clipboard path.
 *
 * Converted files leave through the same delivery path. Their bodies are
 * already serialized by their adapter, so they are never handed back to
 * `serializeExport`; instead the same manifest is stamped onto the body in the
 * form the target format admits.
 *
 * Every file carries the exact filter that produced it, and every object URL is
 * revoked after use.
 */

import {
  type ExportColumn,
  type ExportFormat,
  type ExportManifest,
  type ExportRow,
  describeOmissions,
  serializeExport,
} from "@material-tax-reporting/surface-kernel";

/**
 * The honest statement about what a browser can and cannot do with a file.
 * It is rendered next to the export controls instead of offering an
 * "open in editor" action that cannot work from a page.
 */
export const EXPORT_SANDBOX_NOTE =
  "A page cannot open a file in another application. Where this browser supports it, an export can be written to a folder you choose; otherwise it is delivered as an ordinary download, or copied to the clipboard.";

/**
 * The same statement for a surface that writes files and offers no clipboard
 * action, so the sentence does not name a control the reader has not got.
 */
export const FILE_DELIVERY_NOTE =
  "A page cannot open a file in another application. Where this browser supports it, a result can be written to a folder you choose; otherwise it is delivered as an ordinary download.";

export const EXPORT_FORMATS: readonly ExportFormat[] = ["json", "csv", "markdown", "text"];

export type ExportRequest = {
  collection: string;
  filterDescription: string;
  columns: readonly ExportColumn[];
  rows: readonly ExportRow[];
  format: ExportFormat;
  omitted?: readonly string[];
  redacted?: readonly string[];
};

export type ExportOutcome = {
  method: "folder" | "download" | "clipboard";
  fileName: string;
  byteLength: number;
};

type FilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
  }>;
};

function buildBundle(request: ExportRequest) {
  const manifest: ExportManifest = {
    generatedAt: new Date().toISOString(),
    surface: "documentation site",
    collection: request.collection,
    filterDescription: request.filterDescription,
    rowCount: request.rows.length,
    omitted: [...(request.omitted ?? [])],
    redacted: [...(request.redacted ?? [])],
  };
  return serializeExport({
    rows: request.rows,
    columns: request.columns,
    manifest,
    format: request.format,
  });
}

/** Whether this browser offers the folder-choosing save path. */
export function folderSaveSupported(): boolean {
  return typeof window !== "undefined" && typeof (window as FilePickerWindow).showSaveFilePicker === "function";
}

/**
 * Writes one body out: a folder the reader chooses where the browser offers
 * that interface, an ordinary download otherwise. The object URL used by the
 * download fallback is revoked once the click has been dispatched.
 *
 * Both the row-oriented export path and the converted-file path go through
 * here, so a file written by either is written the same way.
 */
async function deliverBody(
  fileName: string,
  mimeType: string,
  body: string,
  description: string,
): Promise<ExportOutcome> {
  const blob = new Blob([body], { type: `${mimeType};charset=utf-8` });

  const picker = (window as FilePickerWindow).showSaveFilePicker;
  if (typeof picker === "function") {
    const handle = await picker.call(window, {
      suggestedName: fileName,
      types: [{ description, accept: { [mimeType]: [`.${fileName.split(".").pop() ?? "txt"}`] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { method: "folder", fileName, byteLength: blob.size };
  }

  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
  return { method: "download", fileName, byteLength: blob.size };
}

/**
 * Delivers an export. The object URL used by the download fallback is revoked
 * once the click has been dispatched.
 */
export async function deliverExport(request: ExportRequest): Promise<ExportOutcome> {
  const bundle = buildBundle(request);
  return deliverBody(bundle.fileName, bundle.mimeType, bundle.body, request.collection);
}

/** Copies the same serialized body to the clipboard. */
export async function copyExport(request: ExportRequest): Promise<ExportOutcome> {
  const bundle = buildBundle(request);
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    throw new Error("This browser did not expose clipboard access.");
  }
  await navigator.clipboard.writeText(bundle.body);
  return { method: "clipboard", fileName: bundle.fileName, byteLength: bundle.body.length };
}

// --------------------------------------------------------- converted files --

/** A converted body, ready to be written, with the pair that produced it. */
export type ConvertedFileRequest = {
  /** The name of the file the reader chose. It is used to name the output. */
  sourceName: string;
  /** The adapter's source format, for example `vocabulary-json`. */
  sourceType: string;
  /** The adapter's target format. It chooses the extension and the stamp. */
  targetType: string;
  /** The already-converted body. It is written as it stands, never re-serialized. */
  body: string;
  omitted?: readonly string[];
  redacted?: readonly string[];
};

export type ConvertedFileOutcome = ExportOutcome & {
  /** Whether the written file carries the manifest. */
  manifestStamped: boolean;
  /** What the reader is told about the manifest on this file. */
  manifestNote: string;
};

/** How a target format carries the manifest, or why it cannot. */
type ConvertedTarget = {
  extension: string;
  mimeType: string;
  stamp: "comment" | "list" | "none";
  /** Stated on the outcome when `stamp` is `none`. Empty otherwise. */
  omissionReason: string;
};

const STAMPED_MANIFEST_NOTE =
  "The file carries the same manifest an export carries: the surface, the collection, the moment, the source it was converted from, the record count, and what was omitted or redacted.";

/**
 * The vocabulary schema in the shared kernel accepts only a `version` and a
 * `replacements` root field, so a manifest written into a vocabulary document
 * would be rejected by that same validator the next time the document is read.
 * The file is written unchanged and the reader is told why.
 */
const JSON_OMISSION_REASON =
  "A vocabulary JSON result carries no inline manifest: the vocabulary schema accepts only its version and replacements fields, so a stamped document would be refused the next time it is read back.";

const UNKNOWN_OMISSION_REASON =
  "This target's format is not one a manifest can be written into without changing what the file means, so the result is written unchanged.";

function targetShape(targetType: string): ConvertedTarget {
  switch (targetType.split("-").pop() ?? "") {
    case "csv":
      return { extension: "csv", mimeType: "text/csv", stamp: "comment", omissionReason: "" };
    case "tsv":
      return {
        extension: "tsv",
        mimeType: "text/tab-separated-values",
        stamp: "comment",
        omissionReason: "",
      };
    case "markdown":
      return { extension: "md", mimeType: "text/markdown", stamp: "list", omissionReason: "" };
    case "json":
      return {
        extension: "json",
        mimeType: "application/json",
        stamp: "none",
        omissionReason: JSON_OMISSION_REASON,
      };
    default:
      return {
        extension: "txt",
        mimeType: "text/plain",
        stamp: "none",
        omissionReason: UNKNOWN_OMISSION_REASON,
      };
  }
}

/** What the reader is told about the manifest before a target is written. */
export function convertedManifestNote(targetType: string): string {
  const target = targetShape(targetType);
  return target.stamp === "none" ? target.omissionReason : STAMPED_MANIFEST_NOTE;
}

/**
 * The manifest header lines.
 *
 * The kernel keeps its own copy of this list module-private, so the wording is
 * repeated here rather than imported. The two must stay identical, or a
 * converted file and an exported file would describe themselves differently.
 */
function manifestLines(manifest: ExportManifest): string[] {
  return [
    `Surface: ${manifest.surface}`,
    `Collection: ${manifest.collection}`,
    `Generated: ${manifest.generatedAt}`,
    `Filter: ${manifest.filterDescription}`,
    `Rows: ${manifest.rowCount}`,
    describeOmissions(manifest.omitted, manifest.redacted),
  ];
}

/**
 * One manifest line as a comment a delimited reader will drop.
 *
 * The converter's own reader discards a line beginning with `#`, so the line
 * has to still begin with `#` once it is written. A comma or a quotation mark
 * would make a comma-separated writer wrap the whole line in quotation marks,
 * the first character would become `"` rather than `#`, and the manifest would
 * be read back as a data row. Those characters are substituted, and tabs and
 * line breaks collapsed, for that reason; it is also why this line is not
 * passed through the kernel's cell neutralization, which is what would add the
 * quoting. A comma-separated and a tab-separated result are treated the same
 * way so the two read identically.
 */
function commentLine(text: string): string {
  return `# ${text.replace(/[\r\n\t]+/g, " ").replaceAll(",", ";").replaceAll('"', "'")}`;
}

/**
 * The records a converted body holds. Every delimited target the converter
 * registers writes a header row, and a Markdown target writes a header and a
 * divider, so those lines are not records. Blank and comment lines never count.
 */
function countConvertedRecords(body: string, stamp: "comment" | "list"): number {
  const lines = body
    .replaceAll("\r\n", "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0 && !line.startsWith("#"));
  return Math.max(0, lines.length - (stamp === "list" ? 2 : 1));
}

/** Drops the reader's own extension so the target's can be put in its place. */
function outputBase(sourceName: string): string {
  return sourceName.replace(/\.[^.]+$/, "") || "converted";
}

/**
 * Delivers a converted file through the same path an export takes, with the
 * same manifest stamped onto it wherever the target format admits one.
 *
 * The body is never re-serialized: it is already in its target format, and
 * handing it back to the row-oriented serializer would destroy that format.
 */
export async function deliverConvertedFile(request: ConvertedFileRequest): Promise<ConvertedFileOutcome> {
  const target = targetShape(request.targetType);
  const fileName = `${outputBase(request.sourceName)}.${target.extension}`;
  const description = `${request.sourceType} to ${request.targetType}`;

  if (target.stamp === "none") {
    const outcome = await deliverBody(fileName, target.mimeType, request.body, description);
    return { ...outcome, manifestStamped: false, manifestNote: target.omissionReason };
  }

  const manifest: ExportManifest = {
    generatedAt: new Date().toISOString(),
    surface: "documentation site",
    collection: `File converter: ${description}`,
    filterDescription: `Converted from ${request.sourceName}`,
    rowCount: countConvertedRecords(request.body, target.stamp),
    omitted: [...(request.omitted ?? [])],
    redacted: [...(request.redacted ?? [])],
  };

  let body: string;
  if (target.stamp === "comment") {
    // The manifest is written with the same line ending the adapter used, so
    // one file does not mix the two.
    const eol = request.body.includes("\r\n") ? "\r\n" : "\n";
    body = `${manifestLines(manifest).map(commentLine).join(eol)}${eol}${request.body}`;
  } else {
    const heading = [`# ${manifest.collection}`, "", ...manifestLines(manifest).map((line) => `- ${line}`)];
    body = `${heading.join("\n")}\n\n${request.body}`;
  }

  const outcome = await deliverBody(fileName, target.mimeType, body, description);
  return { ...outcome, manifestStamped: true, manifestNote: STAMPED_MANIFEST_NOTE };
}

/**
 * A shared selection layer for every list with bulk actions: per-row
 * checkboxes, select-all-visible and shift-range selection.
 */
export class RowSelection {
  readonly #ids: Set<string>;
  readonly #anchor: string | null;

  constructor(ids: Iterable<string> = [], anchor: string | null = null) {
    this.#ids = new Set(ids);
    this.#anchor = anchor;
  }

  get size(): number {
    return this.#ids.size;
  }

  get anchor(): string | null {
    return this.#anchor;
  }

  has(id: string): boolean {
    return this.#ids.has(id);
  }

  ids(): string[] {
    return [...this.#ids];
  }

  toggle(id: string): RowSelection {
    const next = new Set(this.#ids);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return new RowSelection(next, id);
  }

  /** Selects the inclusive range between the anchor and `id` in visible order. */
  range(id: string, visible: readonly string[]): RowSelection {
    if (this.#anchor === null) return this.toggle(id);
    const from = visible.indexOf(this.#anchor);
    const to = visible.indexOf(id);
    if (from === -1 || to === -1) return this.toggle(id);
    const [start, end] = from <= to ? [from, to] : [to, from];
    const next = new Set(this.#ids);
    for (const value of visible.slice(start, end + 1)) next.add(value);
    return new RowSelection(next, id);
  }

  selectAll(visible: readonly string[]): RowSelection {
    return new RowSelection([...this.#ids, ...visible], this.#anchor);
  }

  clearVisible(visible: readonly string[]): RowSelection {
    const next = new Set(this.#ids);
    for (const value of visible) next.delete(value);
    return new RowSelection(next, this.#anchor);
  }

  clear(): RowSelection {
    return new RowSelection();
  }

  /** Only the selected rows that are still visible. */
  intersect(visible: readonly string[]): string[] {
    return visible.filter((id) => this.#ids.has(id));
  }
}
