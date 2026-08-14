"use client";

/**
 * Support notes.
 *
 * A note is a description of a problem, written and kept in this browser. It is
 * never transmitted: there is no endpoint, no account and no queue behind it.
 * Because such a note easily picks up something that should not be kept, the
 * kernel redacts anything shaped like an identifier, an amount or a file path
 * before the note is stored, and names the categories it replaced.
 */

import {
  type SupportTicket,
  type TicketSeverity,
  type TicketState,
  MAX_TICKET_BODY_LENGTH,
  MAX_TICKET_TITLE_LENGTH,
  TICKET_TRANSITIONS,
  advanceTicket,
  createTicket,
  filterTickets,
  systemClock,
} from "@material-tax-reporting/surface-kernel";
import { type ReactNode, useMemo, useState } from "react";
import { CompactSearchWithBuilder, type SearchBinding } from "./search-builder.tsx";
import { type ExportRequest } from "./exports.ts";

export const TICKET_PRIVACY_NOTE =
  "Support notes stay in this browser and are never transmitted. There is no support endpoint, no account and no queue behind this panel.";

const SEVERITIES: readonly TicketSeverity[] = ["low", "medium", "high"];

/** Reads persisted notes, discarding anything that is not a note. */
export function validateTickets(raw: unknown): SupportTicket[] {
  if (!Array.isArray(raw)) return [];
  const states = new Set<TicketState>(["open", "in-progress", "resolved"]);
  const severities = new Set<TicketSeverity>(SEVERITIES);
  const accepted: SupportTicket[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      typeof record.title !== "string" ||
      typeof record.body !== "string" ||
      typeof record.createdAt !== "string" ||
      typeof record.updatedAt !== "string" ||
      typeof record.state !== "string" ||
      !states.has(record.state as TicketState) ||
      typeof record.severity !== "string" ||
      !severities.has(record.severity as TicketSeverity)
    ) {
      continue;
    }
    accepted.push({
      id: record.id,
      title: record.title.slice(0, MAX_TICKET_TITLE_LENGTH),
      body: record.body.slice(0, MAX_TICKET_BODY_LENGTH),
      severity: record.severity as TicketSeverity,
      state: record.state as TicketState,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
  return accepted;
}

/** The export shape for the shared export path. */
export function ticketExportRequest(tickets: readonly SupportTicket[], filterDescription: string): ExportRequest {
  return {
    collection: "Support notes",
    filterDescription,
    columns: [
      { key: "id", label: "Identifier" },
      { key: "title", label: "Title" },
      { key: "severity", label: "Severity" },
      { key: "state", label: "State" },
      { key: "createdAt", label: "Created" },
      { key: "updatedAt", label: "Updated" },
      { key: "body", label: "Body" },
    ],
    rows: tickets.map((ticket) => ({
      id: ticket.id,
      title: ticket.title,
      severity: ticket.severity,
      state: ticket.state,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      body: ticket.body,
    })),
    format: "json",
    redacted: ["identifiers, amounts and absolute paths, removed when each note was saved"],
  };
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `t-${Date.now().toString(36)}`;
}

export function SupportNotesPanel({
  tickets,
  onChange,
  binding,
  onNotify,
  onExport,
}: {
  tickets: SupportTicket[];
  onChange: (tickets: SupportTicket[], summary: string) => void;
  binding: SearchBinding;
  onNotify: (kind: "success" | "error", title: string, body: string) => void;
  onExport: (request: ExportRequest) => void;
}): ReactNode {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<TicketSeverity>("low");
  const [editing, setEditing] = useState<string | null>(null);

  const visible = useMemo(() => filterTickets(tickets, binding.state), [tickets, binding.state]);

  const submit = () => {
    const { ticket, redacted } = createTicket({
      id: newId(),
      title,
      body,
      severity,
      createdAt: systemClock.isoNow(),
    });
    onChange([ticket, ...tickets], `Created support note "${ticket.title}"`);
    setTitle("");
    setBody("");
    onNotify(
      "success",
      "Note saved in this browser",
      redacted.length === 0
        ? "Nothing had to be removed from the note."
        : `Removed before saving: ${redacted.join(", ")}.`,
    );
  };

  return (
    <section className="utility-panel" id="tickets-panel" tabIndex={-1} aria-labelledby="tickets-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Local notes</p>
          <h2 id="tickets-title">Support notes</h2>
          <p>{TICKET_PRIVACY_NOTE}</p>
        </div>
      </div>

      <div className="ticket-form">
        <label className="field-label" htmlFor="ticket-title">
          Title
        </label>
        <input
          id="ticket-title"
          type="text"
          value={title}
          maxLength={MAX_TICKET_TITLE_LENGTH}
          onChange={(event) => setTitle(event.target.value)}
        />
        <label className="field-label" htmlFor="ticket-severity">
          Severity
        </label>
        <select
          id="ticket-severity"
          value={severity}
          onChange={(event) => setSeverity(event.target.value as TicketSeverity)}
        >
          {SEVERITIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <label className="field-label" htmlFor="ticket-body">
          What happened
        </label>
        <textarea
          id="ticket-body"
          value={body}
          maxLength={MAX_TICKET_BODY_LENGTH}
          onChange={(event) => setBody(event.target.value)}
        />
        <button type="button" className="filled-button" disabled={title.trim().length === 0} onClick={submit}>
          Save this note
        </button>
      </div>

      <CompactSearchWithBuilder {...binding} />

      <ul className="ticket-list">
        {visible.map((ticket) => (
          <li key={ticket.id}>
            <div className="ticket-head">
              <strong>{ticket.title}</strong>
              <span className="status-chip">{ticket.state}</span>
              <span className="status-chip">{ticket.severity}</span>
            </div>
            {editing === ticket.id ? (
              <>
                <label className="field-label" htmlFor={`ticket-edit-${ticket.id}`}>
                  Edit the note
                </label>
                <textarea
                  id={`ticket-edit-${ticket.id}`}
                  defaultValue={ticket.body}
                  maxLength={MAX_TICKET_BODY_LENGTH}
                  onBlur={(event) => {
                    const { ticket: rewritten, redacted } = createTicket({
                      id: ticket.id,
                      title: ticket.title,
                      body: event.target.value,
                      severity: ticket.severity,
                      createdAt: ticket.createdAt,
                    });
                    onChange(
                      tickets.map((entry) =>
                        entry.id === ticket.id
                          ? { ...rewritten, state: ticket.state, updatedAt: systemClock.isoNow() }
                          : entry,
                      ),
                      `Edited support note "${ticket.title}"`,
                    );
                    setEditing(null);
                    if (redacted.length > 0) {
                      onNotify("success", "Note updated", `Removed before saving: ${redacted.join(", ")}.`);
                    }
                  }}
                />
              </>
            ) : (
              <p>{ticket.body}</p>
            )}
            <div className="ticket-actions">
              <button type="button" className="text-button" onClick={() => setEditing(ticket.id === editing ? null : ticket.id)}>
                {editing === ticket.id ? "Stop editing" : "Edit"}
              </button>
              {TICKET_TRANSITIONS[ticket.state].map((next) => (
                <button
                  key={next}
                  type="button"
                  className="outlined-button"
                  onClick={() =>
                    onChange(
                      tickets.map((entry) =>
                        entry.id === ticket.id ? advanceTicket(entry, next, systemClock.isoNow()) : entry,
                      ),
                      `Moved support note "${ticket.title}" to ${next}`,
                    )
                  }
                >
                  Move to {next}
                </button>
              ))}
            </div>
          </li>
        ))}
        {visible.length === 0 && <li>No note matches the filter.</li>}
      </ul>

      <button
        type="button"
        className="outlined-button"
        disabled={visible.length === 0}
        onClick={() => onExport(ticketExportRequest(visible, `Filter: ${binding.state.regex ? binding.state.pattern : binding.state.query || "none"}`))}
      >
        Export the filtered notes
      </button>
    </section>
  );
}
