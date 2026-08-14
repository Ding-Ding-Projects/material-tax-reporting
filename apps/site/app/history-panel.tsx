"use client";

/**
 * The local history panel.
 *
 * Restoring writes a new record; nothing earlier is rewritten. The
 * confirmation names the exact values that would be reapplied, so a restore is
 * never a blind action.
 *
 * Personal-vocabulary values never reach a record: a vocabulary change is kept
 * as key counts and lengths only, and that is what both the diff and the export
 * show.
 */

import { type HistoryAction, type HistoryRecord, HISTORY_ACTIONS, filterHistory } from "@material-tax-reporting/surface-kernel";
import { type ReactNode, useMemo, useState } from "react";
import { type HistoryApi } from "./history.ts";
import { RowSelection, type ExportRequest } from "./exports.ts";
import { CompactSearchWithBuilder, type SearchBinding } from "./search-builder.tsx";

/** The export shape for the filtered history view. */
export function historyExportRequest(records: readonly HistoryRecord[], filterDescription: string): ExportRequest {
  return {
    collection: "Local history",
    filterDescription,
    columns: [
      { key: "id", label: "Identifier" },
      { key: "revisionId", label: "Revision" },
      { key: "action", label: "Action" },
      { key: "at", label: "Recorded" },
      { key: "summary", label: "Summary" },
      { key: "diff", label: "Changed values" },
    ],
    rows: records.map((record) => ({
      id: record.id,
      revisionId: record.revisionId,
      action: record.action,
      at: record.at,
      summary: record.summary,
      diff: record.redactedDiff
        .map((entry) => `${entry.path}: ${entry.before ?? "unset"} → ${entry.after ?? "unset"}`)
        .join("; "),
    })),
    format: "json",
    redacted: ["personal-vocabulary values, kept as key counts and lengths only", "absolute paths"],
  };
}

export function HistoryPanel({
  api,
  binding,
  onClose,
  onExport,
  onNotify,
  emoji,
  copy,
}: {
  api: HistoryApi;
  binding: SearchBinding;
  onClose: () => void;
  onExport: (request: ExportRequest) => void;
  onNotify: (kind: "success" | "error", title: string, body: string) => void;
  emoji: string | null;
  copy: (key: string) => string;
}): ReactNode {
  const [actions, setActions] = useState<HistoryAction[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selection, setSelection] = useState(new RowSelection());
  const [confirming, setConfirming] = useState<HistoryRecord | null>(null);

  const visible = useMemo(
    () =>
      filterHistory(
        api.records,
        {
          actions,
          ...(from ? { from: new Date(from).toISOString() } : {}),
          ...(to ? { to: new Date(`${to}T23:59:59.999Z`).toISOString() } : {}),
        },
        binding.state,
      ),
    [actions, api.records, binding.state, from, to],
  );

  const visibleIds = visible.map((record) => record.id);
  const selected = selection.intersect(visibleIds);
  const filterDescription = `Search: ${binding.state.regex ? binding.state.pattern : binding.state.query || "none"}; actions: ${actions.join("|") || "all"}; from: ${from || "any"}; to: ${to || "any"}`;

  return (
    <aside className="history-panel wide" role="dialog" aria-modal="true" aria-labelledby="history-title">
      <div className="palette-heading">
        <div>
          <p className="eyebrow">This browser only</p>
          <h2 id="history-title">
            {emoji && (
              <span aria-hidden="true" className="decorative-emoji">
                {emoji}
              </span>
            )}
            {copy("history.title")}
          </h2>
          <p>{copy("history.lede")}</p>
        </div>
        <button type="button" className="icon-button" aria-label="Close local history" onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
      </div>

      {!api.available && (
        <p className="file-status" role="alert">
          {api.unavailableReason ?? "Local history is unavailable in this browser."}
        </p>
      )}

      <CompactSearchWithBuilder {...binding} />

      <details>
        <summary>Filter by recorded action</summary>
        <div className="filter-row">
          {HISTORY_ACTIONS.map((action) => (
            <label key={action} className="inline-check">
              <input
                type="checkbox"
                checked={actions.includes(action)}
                onChange={(event) =>
                  setActions((current) =>
                    event.target.checked ? [...current, action] : current.filter((entry) => entry !== action),
                  )
                }
              />
              {action}
            </label>
          ))}
        </div>
      </details>

      <div className="date-range">
        <label className="field-label" htmlFor="history-from">
          Recorded on or after
        </label>
        <input id="history-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <label className="field-label" htmlFor="history-to">
          Recorded on or before
        </label>
        <input id="history-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
      </div>

      <div className="bulk-bar">
        <button
          type="button"
          className="outlined-button"
          onClick={() =>
            setSelection((current) =>
              selected.length === visibleIds.length
                ? current.clearVisible(visibleIds)
                : current.selectAll(visibleIds),
            )
          }
        >
          {copy("action.selectAllVisible")}
        </button>
        <span aria-live="polite">
          {selected.length} selected of {visible.length} shown; {api.total} kept, capped at {api.cap}
        </span>
        <button
          type="button"
          className="outlined-button"
          disabled={visible.length === 0}
          onClick={() =>
            onExport(
              historyExportRequest(
                selected.length > 0 ? visible.filter((record) => selection.has(record.id)) : visible,
                selected.length > 0 ? `${filterDescription}; selected rows only` : filterDescription,
              ),
            )
          }
        >
          Export {selected.length > 0 ? "the selection" : "the filtered view"}
        </button>
        <button
          type="button"
          className="outlined-button"
          onClick={() => {
            void api.prune().then((removed) =>
              onNotify(
                "success",
                "History pruned",
                removed === 0
                  ? `Nothing was removed; ${api.total} records are within the cap of ${api.cap}.`
                  : `Removed the ${removed} oldest record${removed === 1 ? "" : "s"} beyond the cap of ${api.cap}.`,
              ),
            );
          }}
        >
          Prune beyond the cap
        </button>
      </div>

      {confirming !== null && (
        <div className="confirm-box" role="alertdialog" aria-labelledby="history-confirm-title">
          <h3 id="history-confirm-title">Restore this recorded state?</h3>
          <p>{confirming.summary}</p>
          <ul>
            {confirming.redactedDiff.map((entry) => (
              <li key={entry.path}>
                <code>{entry.path}</code> would be set to {entry.after ?? "unset"} (it was{" "}
                {entry.before ?? "unset"} when this record was written).
              </li>
            ))}
            {confirming.redactedDiff.length === 0 && <li>This record carries no changed values.</li>}
          </ul>
          <p>A restore appends a new record. Nothing recorded earlier is rewritten or removed.</p>
          <button
            type="button"
            className="filled-button"
            onClick={() => {
              const target = confirming;
              setConfirming(null);
              void api.restore(target.revisionId).then((created) =>
                onNotify(
                  created === null ? "error" : "success",
                  created === null ? "Not restored" : "Restored as a new revision",
                  created === null
                    ? "The selected state could not be restored."
                    : `Recorded as revision ${created.revisionId}.`,
                ),
              );
            }}
          >
            {copy("action.confirm")}
          </button>
          <button type="button" className="outlined-button" onClick={() => setConfirming(null)}>
            {copy("action.cancel")}
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="empty-state">
          <h3>No matching entry</h3>
          <p>Personalization changes made in this browser appear here.</p>
        </div>
      ) : (
        <ol className="history-list">
          {visible.map((record) => (
            <li key={record.id}>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={selection.has(record.id)}
                  aria-label={`Select ${record.summary}`}
                  onClick={(event) => {
                    if (event.shiftKey) {
                      event.preventDefault();
                      setSelection((current) => current.range(record.id, visibleIds));
                    }
                  }}
                  onChange={() => setSelection((current) => current.toggle(record.id))}
                />
                <span className="visually-hidden">Select</span>
              </label>
              <div>
                <div className="notification-head">
                  <strong>{record.summary}</strong>
                  <span className="status-chip">{record.action}</span>
                  <time dateTime={record.at}>{new Date(record.at).toLocaleString()}</time>
                </div>
                {record.redactedDiff.length > 0 && (
                  <dl className="diff-list">
                    {record.redactedDiff.map((entry) => (
                      <div key={entry.path}>
                        <dt>{entry.path}</dt>
                        <dd>
                          <del>{entry.before ?? "unset"}</del> <ins>{entry.after ?? "unset"}</ins>
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                <button type="button" className="text-button" onClick={() => setConfirming(record)}>
                  Restore this state
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
