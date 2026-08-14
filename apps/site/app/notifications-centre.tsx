"use client";

/**
 * The notifications centre.
 *
 * Errors are announced assertively; success, information and progress notices
 * stay polite. A progress notice is persistent and waits for its outcome rather
 * than disappearing on a timer.
 */

import {
  type Notification,
  type NotificationSeverity,
  filterNotifications,
  selectBulkScope,
} from "@material-tax-reporting/surface-kernel";
import { type ReactNode, useMemo, useState } from "react";
import { RowSelection, type ExportRequest } from "./exports.ts";
import { CompactSearchWithBuilder, type SearchBinding } from "./search-builder.tsx";
import { type NotificationsApi } from "./notifications.ts";

const KINDS: readonly NotificationSeverity[] = ["success", "info", "progress", "error"];

/** The export shape for the filtered notification view. */
export function notificationsExportRequest(
  items: readonly Notification[],
  filterDescription: string,
): ExportRequest {
  return {
    collection: "Notification history",
    filterDescription,
    columns: [
      { key: "id", label: "Identifier" },
      { key: "kind", label: "Kind" },
      { key: "title", label: "Title" },
      { key: "body", label: "Body" },
      { key: "createdAt", label: "Created" },
      { key: "read", label: "Read" },
    ],
    rows: items.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      body: item.body,
      createdAt: item.createdAt,
      read: String(item.read),
    })),
    format: "json",
  };
}

export function NotificationsCentre({
  api,
  binding,
  onClose,
  onExport,
  emoji,
  copy,
}: {
  api: NotificationsApi;
  binding: SearchBinding;
  onClose: () => void;
  onExport: (request: ExportRequest) => void;
  emoji: string | null;
  copy: (key: string) => string;
}): ReactNode {
  const [kinds, setKinds] = useState<NotificationSeverity[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selection, setSelection] = useState(new RowSelection());
  const [confirming, setConfirming] = useState<null | "dismiss-selected" | "dismiss-all">(null);

  const visible = useMemo(
    () =>
      filterNotifications(
        api.list,
        {
          kinds,
          ...(from ? { from: new Date(from).toISOString() } : {}),
          ...(to ? { to: new Date(`${to}T23:59:59.999Z`).toISOString() } : {}),
        },
        binding.state,
      ),
    [api.list, binding.state, from, kinds, to],
  );

  const visibleIds = visible.map((item) => item.id);
  const selected = selection.intersect(visibleIds);
  const filterDescription = `Search: ${binding.state.regex ? binding.state.pattern : binding.state.query || "none"}; kinds: ${kinds.join("|") || "all"}; from: ${from || "any"}; to: ${to || "any"}`;
  const pendingScope =
    confirming === "dismiss-all"
      ? selectBulkScope(api.list, { mode: "all" })
      : selectBulkScope(api.list, { mode: "selected", ids: selected });

  return (
    <aside className="history-panel" role="dialog" aria-modal="true" aria-labelledby="notifications-title">
      <div className="palette-heading">
        <div>
          <p className="eyebrow">Local activity</p>
          <h2 id="notifications-title">
            {emoji && (
              <span aria-hidden="true" className="decorative-emoji">
                {emoji}
              </span>
            )}
            {copy("notifications.title")}
          </h2>
        </div>
        <button type="button" className="icon-button" aria-label="Close notifications" onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <CompactSearchWithBuilder {...binding} />

      <fieldset className="filter-row">
        <legend>Kinds</legend>
        {KINDS.map((kind) => (
          <label key={kind} className="inline-check">
            <input
              type="checkbox"
              checked={kinds.includes(kind)}
              onChange={(event) =>
                setKinds((current) =>
                  event.target.checked ? [...current, kind] : current.filter((entry) => entry !== kind),
                )
              }
            />
            {kind}
          </label>
        ))}
      </fieldset>

      <div className="date-range">
        <label className="field-label" htmlFor="notifications-from">
          Created on or after
        </label>
        <input id="notifications-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <label className="field-label" htmlFor="notifications-to">
          Created on or before
        </label>
        <input id="notifications-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
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
          {selected.length === visibleIds.length && visibleIds.length > 0
            ? "Clear the visible selection"
            : copy("action.selectAllVisible")}
        </button>
        <span aria-live="polite">{selected.length} selected of {visible.length} shown</span>
        <button
          type="button"
          className="outlined-button"
          disabled={selected.length === 0}
          onClick={() => {
            for (const id of selected) api.markRead(id);
          }}
        >
          Mark the selection read
        </button>
        <button
          type="button"
          className="outlined-button"
          disabled={selected.length === 0}
          onClick={() => setConfirming("dismiss-selected")}
        >
          Dismiss the selection
        </button>
        <button
          type="button"
          className="outlined-button"
          disabled={api.list.length === 0}
          onClick={() => setConfirming("dismiss-all")}
        >
          Dismiss all
        </button>
        <button
          type="button"
          className="outlined-button"
          disabled={visible.length === 0}
          onClick={() => onExport(notificationsExportRequest(visible, filterDescription))}
        >
          Export the filtered view
        </button>
      </div>

      {confirming !== null && (
        <div className="confirm-box" role="alertdialog" aria-labelledby="notifications-confirm-title">
          <h3 id="notifications-confirm-title">
            Dismiss {pendingScope.length} notification{pendingScope.length === 1 ? "" : "s"}?
          </h3>
          <ul>
            {pendingScope.slice(0, 8).map((item) => (
              <li key={item.id}>{item.title}</li>
            ))}
            {pendingScope.length > 8 && <li>and {pendingScope.length - 8} more</li>}
          </ul>
          <button
            type="button"
            className="filled-button"
            onClick={() => {
              api.dismissMany(pendingScope.map((item) => item.id));
              setSelection((current) => current.clear());
              setConfirming(null);
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
          <h3>{copy("notifications.emptyTitle")}</h3>
          <p>{copy("notifications.emptyBody")}</p>
        </div>
      ) : (
        <ol className="notification-list">
          {visible.map((item) => (
            <li key={item.id} data-kind={item.kind} data-read={item.read}>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={selection.has(item.id)}
                  aria-label={`Select ${item.title}`}
                  onClick={(event) => {
                    if (event.shiftKey) {
                      event.preventDefault();
                      setSelection((current) => current.range(item.id, visibleIds));
                    }
                  }}
                  onChange={() => setSelection((current) => current.toggle(item.id))}
                />
                <span className="visually-hidden">Select</span>
              </label>
              <div>
                <div className="notification-head">
                  <strong>{item.title}</strong>
                  <span className="status-chip">{item.kind}</span>
                  <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
                </div>
                <p>{item.body}</p>
                <div className="notification-actions">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => (item.read ? api.markUnread(item.id) : api.markRead(item.id))}
                  >
                    Mark {item.read ? "unread" : "read"}
                  </button>
                  <button type="button" className="text-button" onClick={() => api.dismiss(item.id)}>
                    Dismiss
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
