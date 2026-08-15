"use client";

/**
 * The file-converter panel.
 *
 * Each chosen file is validated, converted and previewed before anything is
 * written. A rejection names the exact reason for that file, and the other
 * files in the same batch are unaffected.
 *
 * A converted result is written through the surface's shared export delivery
 * rather than through a path of its own, so it carries the same manifest and
 * the same folder-or-download behaviour every other collection carries. The
 * pair that produced a result is recorded on the result itself, so choosing a
 * different conversion after a batch has run cannot mislabel what is saved.
 */

import { type ConversionAdapter, matchesSearch } from "@material-tax-reporting/surface-kernel";
import { type ReactNode, useMemo, useRef, useState } from "react";
import { CONVERTER_SCOPE_NOTE, adapterHaystack, createConverterRegistry, previewRows } from "./converter.ts";
import { FILE_DELIVERY_NOTE, type ConvertedFileRequest, convertedManifestNote } from "./exports.ts";
import { CompactSearchWithBuilder, type SearchBinding } from "./search-builder.tsx";

const PREVIEW_ROWS = 8;
const MAX_INPUT_BYTES = 512 * 1024;

type FileOutcome = {
  name: string;
  ok: boolean;
  reason: string;
  preview: string[];
  body: string | null;
  /** The pair that produced this result, kept so a later selection cannot rename it. */
  sourceType: string;
  targetType: string;
};

export function ConverterPanel({
  binding,
  onNotify,
  onSave,
  copy,
}: {
  binding: SearchBinding;
  onNotify: (kind: "success" | "error" | "progress", title: string, body: string) => void;
  onSave: (request: ConvertedFileRequest) => void;
  copy: (key: string) => string;
}): ReactNode {
  const registry = useMemo(() => createConverterRegistry(), []);
  const [selectedId, setSelectedId] = useState(registry.list()[0]?.id ?? "");
  const [outcomes, setOutcomes] = useState<FileOutcome[]>([]);
  const [running, setRunning] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const adapters = useMemo(
    () => registry.list().filter((entry) => matchesSearch(adapterHaystack(entry), binding.state)),
    [binding.state, registry],
  );
  const selected: ConversionAdapter | null =
    registry.list().find((entry) => entry.id === selectedId) ?? null;

  const run = async (files: FileList) => {
    if (!selected) return;
    const { sourceType, targetType } = selected;
    const rejected = (name: string, reason: string): FileOutcome => ({
      name,
      ok: false,
      reason,
      preview: [],
      body: null,
      sourceType,
      targetType,
    });
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setOutcomes([]);
    const progressId = onNotify;
    progressId("progress", "Converting", `Reading ${files.length} file${files.length === 1 ? "" : "s"}.`);
    const results: FileOutcome[] = [];
    for (const file of Array.from(files)) {
      if (controller.signal.aborted) {
        results.push(rejected(file.name, "The conversion was cancelled."));
        continue;
      }
      if (file.size > MAX_INPUT_BYTES) {
        results.push(rejected(file.name, `The file exceeds the ${MAX_INPUT_BYTES / 1024} KB local limit.`));
        continue;
      }
      const text = await file.text();
      const verdict = selected.validate(text);
      if (!verdict.ok) {
        results.push(rejected(file.name, verdict.reason ?? "The input was rejected."));
        continue;
      }
      const result = await selected.convert(text, controller.signal);
      if (!result.ok || result.body === undefined) {
        results.push(rejected(file.name, result.reason ?? "The conversion failed."));
        continue;
      }
      results.push({
        name: file.name,
        ok: true,
        reason: `Converted from ${sourceType} to ${targetType}.`,
        preview: previewRows(result.body, PREVIEW_ROWS),
        body: result.body,
        sourceType,
        targetType,
      });
    }
    setOutcomes(results);
    setRunning(false);
    controllerRef.current = null;
    const accepted = results.filter((outcome) => outcome.ok).length;
    onNotify(
      accepted === results.length ? "success" : "error",
      "Conversion finished",
      `${accepted} of ${results.length} file${results.length === 1 ? "" : "s"} converted. Nothing has been written yet.`,
    );
  };

  const write = (outcome: FileOutcome) => {
    if (outcome.body === null) return;
    onSave({
      sourceName: outcome.name,
      sourceType: outcome.sourceType,
      targetType: outcome.targetType,
      body: outcome.body,
    });
  };

  return (
    <section id="converter-panel" tabIndex={-1} aria-labelledby="converter-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">This site's own records</p>
          <h2 id="converter-title">{copy("converter.title")}</h2>
          <p>{copy("converter.lede")}</p>
          <p className="privacy-note">{CONVERTER_SCOPE_NOTE}</p>
        </div>
      </div>

      <CompactSearchWithBuilder {...binding} />

      <ul className="adapter-list" role="listbox" aria-label="Registered conversions">
        {adapters.map((entry) => (
          <li key={entry.id} role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={entry.id === selectedId}
              onClick={() => setSelectedId(entry.id)}
            >
              <strong>{entry.category}</strong>
              <small>
                {entry.sourceType} → {entry.targetType}
              </small>
            </button>
          </li>
        ))}
        {adapters.length === 0 && <li role="presentation">No registered conversion matches the filter.</li>}
      </ul>

      <div className="converter-actions">
        <label className="filled-button file-button">
          Choose files to convert
          <input
            type="file"
            multiple
            accept=".json,.csv,.tsv,.txt,application/json,text/csv,text/plain"
            disabled={selected === null || running}
            onChange={(event) => {
              const files = event.target.files;
              event.target.value = "";
              if (files && files.length > 0) void run(files);
            }}
          />
        </label>
        <button
          type="button"
          className="outlined-button"
          disabled={!running}
          onClick={() => controllerRef.current?.abort()}
        >
          Cancel
        </button>
      </div>
      <p className="privacy-note">{FILE_DELIVERY_NOTE}</p>

      <ul className="outcome-list">
        {outcomes.map((outcome) => (
          <li key={outcome.name} data-ok={outcome.ok}>
            <div className="notification-head">
              <strong>{outcome.name}</strong>
              <span className="status-chip">{outcome.ok ? "Converted" : "Rejected"}</span>
            </div>
            <p>{outcome.reason}</p>
            {outcome.preview.length > 0 && (
              <>
                <p className="field-label">First {outcome.preview.length} converted rows</p>
                <pre tabIndex={0} aria-label={`${outcome.name}: converted preview`}>
                  <code>{outcome.preview.join("\n")}</code>
                </pre>
                <p className="privacy-note">{convertedManifestNote(outcome.targetType)}</p>
                <button
                  type="button"
                  className="outlined-button"
                  aria-label={`Save this result: ${outcome.name}`}
                  onClick={() => write(outcome)}
                >
                  Save this result
                </button>
              </>
            )}
          </li>
        ))}
        {outcomes.length === 0 && <li>No file has been converted in this browser session.</li>}
      </ul>
    </section>
  );
}
