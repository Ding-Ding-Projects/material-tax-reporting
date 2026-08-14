"use client";

/**
 * Export delivery.
 *
 * Serialization, the manifest and the CSV cell neutralization are kernel
 * functions. This module owns only delivery: writing to a folder the reader
 * chooses where the browser supports it, a plain download elsewhere, and a
 * copy-to-clipboard path.
 *
 * Every file carries the exact filter that produced it, and every object URL is
 * revoked after use.
 */

import {
  type ExportColumn,
  type ExportFormat,
  type ExportManifest,
  type ExportRow,
  serializeExport,
} from "@material-tax-reporting/surface-kernel";

/**
 * The honest statement about what a browser can and cannot do with a file.
 * It is rendered next to the export controls instead of offering an
 * "open in editor" action that cannot work from a page.
 */
export const EXPORT_SANDBOX_NOTE =
  "A page cannot open a file in another application. Where this browser supports it, an export can be written to a folder you choose; otherwise it is delivered as an ordinary download, or copied to the clipboard.";

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
 * Delivers an export. The object URL used by the download fallback is revoked
 * once the click has been dispatched.
 */
export async function deliverExport(request: ExportRequest): Promise<ExportOutcome> {
  const bundle = buildBundle(request);
  const blob = new Blob([bundle.body], { type: `${bundle.mimeType};charset=utf-8` });

  const picker = (window as FilePickerWindow).showSaveFilePicker;
  if (typeof picker === "function") {
    const handle = await picker.call(window, {
      suggestedName: bundle.fileName,
      types: [
        {
          description: request.collection,
          accept: { [bundle.mimeType]: [`.${bundle.fileName.split(".").pop() ?? "txt"}`] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { method: "folder", fileName: bundle.fileName, byteLength: blob.size };
  }

  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = bundle.fileName;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
  return { method: "download", fileName: bundle.fileName, byteLength: blob.size };
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
