"use client";

/**
 * The file-converter panel.
 *
 * Each chosen file is validated, converted and previewed before anything is
 * written. A rejection names the exact reason for that file, and the other
 * files in the same batch are unaffected. The output object URL is revoked
 * immediately after the download is dispatched.
 */

import { type ConversionAdapter, matchesSearch } from "@material-tax-reporting/surface-kernel";
import { type ReactNode, useMemo, useRef, useState } from "react";
import { CONVERTER_SCOPE_NOTE, adapterHaystack, createConverterRegistry, previewRows } from "./converter.ts";
import { CompactSearchWithBuilder, type SearchBinding } from "./search-builder.tsx";

const PREVIEW_ROWS = 8;
const MAX_INPUT_BYTES = 512 * 1024;

type FileOutcome = {
  name: string;
  ok: boolean;
  reason: string;
  preview: string[];
  body: string | null;
};

export function ConverterPanel({
  binding,
  onNotify,
  copy,
}: {
  binding: SearchBinding;
  onNotify: (kind: "success" | "error" | "progress", title: string, body: string) => void;
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
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setOutcomes([]);
    const progressId = onNotify;
    progressId("progress", "Converting", `Reading ${files.length} file${files.length === 1 ? "" : "s"}.`);
    const results: FileOutcome[] = [];
    for (const file of Array.from(files)) {
      if (controller.signal.aborted) {
        results.push({ name: file.name, ok: false, reason: "The conversion was cancelled.", preview: [], body: null });
        continue;
      }
      if (file.size > MAX_INPUT_BYTES) {
        results.push({
          name: file.name,
          ok: false,
          reason: `The file exceeds the ${MAX_INPUT_BYTES / 1024} KB local limit.`,
          preview: [],
          body: null,
        });
        continue;
      }
      const text = await file.text();
      const verdict = selected.validate(text);
      if (!verdict.ok) {
        results.push({ name: file.name, ok: false, reason: verdict.reason ?? "The input was rejected.", preview: [], body: null });
        continue;
      }
      const result = await selected.convert(text, controller.signal);
      if (!result.ok || result.body === undefined) {
        results.push({ name: file.name, ok: false, reason: result.reason ?? "The conversion failed.", preview: [], body: null });
        continue;
      }
      results.push({
        name: file.name,
        ok: true,
        reason: `Converted from ${selected.sourceType} to ${selected.targetType}.`,
        preview: previewRows(result.body, PREVIEW_ROWS),
        body: result.body,
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
    if (outcome.body === null || !selected) return;
    const blob = new Blob([outcome.body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${outcome.name.replace(/\.[^.]+$/, "")}.${selected.targetType.split("-").pop() ?? "txt"}`;
      anchor.rel = "noopener";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
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
                <button type="button" className="outlined-button" onClick={() => write(outcome)}>
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
