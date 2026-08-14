"use client";

/**
 * Element locks.
 *
 * A lock guards against an accidental edit in this interface. It is not a
 * security control and it protects no stored data; `LOCK_DISCLOSURE` says so
 * and is repeated on every lock surface.
 *
 * The answer is never stored. The kernel keeps a salted key-derivation
 * verifier, and every mutation the settings grid, the palette, the appearance
 * editor or a scheduled rule performs is routed through one guarded setter.
 */

import {
  type LockRecord,
  type LockScope,
  LOCK_DISCLOSURE,
  LOCK_GRACE_MS,
  MAX_LOCK_ANSWER_LENGTH,
  MAX_LOCK_HINT_LENGTH,
  createLock,
  isMutationBlocked,
  lockExpiry,
  matchesSearch,
  systemClock,
  verifyLock,
} from "@material-tax-reporting/surface-kernel";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { appearanceLabel } from "./appearance.tsx";
import { CompactSearchWithBuilder, type SearchBinding } from "./search-builder.tsx";
import { type ExportRequest } from "./exports.ts";

export { LOCK_DISCLOSURE };

export type LocksApi = {
  locks: LockRecord[];
  /** True when a change to this scope is currently blocked. */
  blocked: (elementId: string, property?: string) => boolean;
  add: (scope: LockScope, answer: string, hint: string) => Promise<void>;
  remove: (id: string) => void;
  attempt: (id: string, answer: string) => Promise<{ ok: boolean; failures: number }>;
  clearAll: () => void;
};

/** Reads persisted locks, discarding anything that is not a lock record. */
export function validateLocks(raw: unknown): LockRecord[] {
  if (!Array.isArray(raw)) return [];
  const accepted: LockRecord[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const scope = record.scope as Record<string, unknown> | undefined;
    if (
      typeof record.id !== "string" ||
      typeof record.verifierSalt !== "string" ||
      typeof record.verifierHash !== "string" ||
      typeof record.lockedAt !== "string" ||
      !scope ||
      typeof scope.elementId !== "string"
    ) {
      continue;
    }
    accepted.push({
      id: record.id,
      scope:
        typeof scope.property === "string"
          ? { elementId: scope.elementId, property: scope.property }
          : { elementId: scope.elementId },
      verifierSalt: record.verifierSalt,
      verifierHash: record.verifierHash,
      hint: typeof record.hint === "string" ? record.hint.slice(0, MAX_LOCK_HINT_LENGTH) : "",
      lockedAt: record.lockedAt,
      unlockedUntil: typeof record.unlockedUntil === "string" ? record.unlockedUntil : null,
      failureCount: typeof record.failureCount === "number" ? record.failureCount : 0,
    });
  }
  return accepted;
}

export function useLocks(options: {
  locks: LockRecord[];
  onChange: (locks: LockRecord[]) => void;
}): LocksApi {
  const { locks, onChange } = options;
  const [, setTick] = useState(0);

  // A grace period ends on a timer, and the timer is re-checked whenever the
  // tab becomes visible again so a backgrounded tab cannot stay unlocked.
  useEffect(() => {
    const refresh = () => setTick((value) => value + 1);
    const interval = window.setInterval(refresh, 15_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const blocked = useCallback(
    (elementId: string, property?: string) =>
      isMutationBlocked(locks, property === undefined ? { elementId } : { elementId, property }),
    [locks],
  );

  return {
    locks,
    blocked,
    add: async (scope, answer, hint) => {
      const record = await createLock(scope, answer, hint, systemClock);
      onChange([...locks, record]);
    },
    remove: (id) => onChange(locks.filter((record) => record.id !== id)),
    attempt: async (id, answer) => {
      const record = locks.find((entry) => entry.id === id);
      if (!record) return { ok: false, failures: 0 };
      const result = await verifyLock(record, answer, systemClock);
      onChange(locks.map((entry) => (entry.id === id ? result.record : entry)));
      return { ok: result.ok, failures: result.record.failureCount };
    },
    clearAll: () => onChange([]),
  };
}

function scopeLabel(scope: LockScope): string {
  return scope.property === undefined
    ? appearanceLabel(scope.elementId)
    : `${appearanceLabel(scope.elementId)} · ${scope.property}`;
}

/** The export shape for the locked-items list. */
export function lockExportRequest(records: readonly LockRecord[], filterDescription: string): ExportRequest {
  return {
    collection: "Element locks",
    filterDescription,
    columns: [
      { key: "id", label: "Identifier" },
      { key: "element", label: "Element" },
      { key: "property", label: "Property" },
      { key: "hint", label: "Hint" },
      { key: "lockedAt", label: "Created" },
      { key: "failureCount", label: "Incorrect attempts" },
    ],
    rows: records.map((record) => ({
      id: record.id,
      element: record.scope.elementId,
      property: record.scope.property ?? "",
      hint: record.hint,
      lockedAt: record.lockedAt,
      failureCount: String(record.failureCount),
    })),
    format: "json",
    omitted: ["the unlock answer and its verifier, which are never exported"],
  };
}

export function LockPanel({
  api,
  binding,
  onNotify,
  onExport,
  elements,
}: {
  api: LocksApi;
  binding: SearchBinding;
  onNotify: (kind: "success" | "error", title: string, body: string) => void;
  onExport: (request: ExportRequest) => void;
  elements: readonly { id: string; label: string }[];
}): ReactNode {
  const [target, setTarget] = useState(elements[0]?.id ?? "");
  const [answer, setAnswer] = useState("");
  const [hint, setHint] = useState("");
  const [attempts, setAttempts] = useState<Record<string, string>>({});

  const visible = useMemo(
    () => api.locks.filter((record) => matchesSearch(`${scopeLabel(record.scope)} ${record.hint}`, binding.state)),
    [api.locks, binding.state],
  );

  return (
    <section className="lock-panel" id="locks-setting" tabIndex={-1} aria-labelledby="locks-title">
      <div>
        <h2 id="locks-title">Element locks</h2>
        <p>{LOCK_DISCLOSURE}</p>
      </div>

      <div className="lock-create">
        <label className="field-label" htmlFor="lock-target">
          Element to lock
        </label>
        <select id="lock-target" value={target} onChange={(event) => setTarget(event.target.value)}>
          {elements.map((element) => (
            <option key={element.id} value={element.id}>
              {element.label}
            </option>
          ))}
        </select>
        <label className="field-label" htmlFor="lock-answer">
          Unlock answer
        </label>
        <input
          id="lock-answer"
          type="password"
          value={answer}
          maxLength={MAX_LOCK_ANSWER_LENGTH}
          autoComplete="off"
          onChange={(event) => setAnswer(event.target.value)}
        />
        <label className="field-label" htmlFor="lock-hint">
          Hint shown when the answer is wrong
        </label>
        <input
          id="lock-hint"
          type="text"
          value={hint}
          maxLength={MAX_LOCK_HINT_LENGTH}
          onChange={(event) => setHint(event.target.value)}
        />
        <button
          type="button"
          className="filled-button"
          disabled={answer.length === 0 || target.length === 0}
          onClick={() => {
            void api
              .add({ elementId: target }, answer, hint)
              .then(() => {
                setAnswer("");
                setHint("");
                onNotify("success", "Lock created", `${appearanceLabel(target)} now asks for an answer before it changes.`);
              })
              .catch((error: unknown) =>
                onNotify(
                  "error",
                  "Lock not created",
                  error instanceof Error ? error.message : "The lock could not be created.",
                ),
              );
          }}
        >
          Lock this element
        </button>
        <small>
          The answer is never stored. Only a salted verifier is kept, and a correct answer keeps the element
          editable for {LOCK_GRACE_MS / 60_000} minutes.
        </small>
      </div>

      <CompactSearchWithBuilder {...binding} />

      <ul className="lock-list">
        {visible.map((record) => {
          const openUntil = lockExpiry(record, systemClock);
          return (
            <li key={record.id}>
              <div>
                <strong>{scopeLabel(record.scope)}</strong>
                <small>
                  {openUntil === null
                    ? "Locked."
                    : `Unlocked until ${new Date(openUntil).toLocaleTimeString()}.`}
                  {record.failureCount > 0 &&
                    ` ${record.failureCount} incorrect attempt${record.failureCount === 1 ? "" : "s"} recorded.`}
                </small>
                {record.failureCount > 0 && record.hint.length > 0 && <small>Hint: {record.hint}</small>}
              </div>
              <div className="lock-row-actions">
                <label className="field-label" htmlFor={`lock-answer-${record.id}`}>
                  Answer
                </label>
                <input
                  id={`lock-answer-${record.id}`}
                  type="password"
                  autoComplete="off"
                  value={attempts[record.id] ?? ""}
                  maxLength={MAX_LOCK_ANSWER_LENGTH}
                  onChange={(event) =>
                    setAttempts((current) => ({ ...current, [record.id]: event.target.value }))
                  }
                />
                <button
                  type="button"
                  className="outlined-button"
                  onClick={() => {
                    void api.attempt(record.id, attempts[record.id] ?? "").then((result) => {
                      setAttempts((current) => ({ ...current, [record.id]: "" }));
                      onNotify(
                        result.ok ? "success" : "error",
                        result.ok ? "Unlocked" : "Answer not accepted",
                        result.ok
                          ? `${scopeLabel(record.scope)} is editable for ${LOCK_GRACE_MS / 60_000} minutes.`
                          : `${result.failures} incorrect attempt${result.failures === 1 ? "" : "s"} recorded. ${record.hint.length > 0 ? `Hint: ${record.hint}` : "No hint was set."}`,
                      );
                    });
                  }}
                >
                  Unlock
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={openUntil === null}
                  onClick={() => api.remove(record.id)}
                >
                  Remove lock
                </button>
              </div>
            </li>
          );
        })}
        {visible.length === 0 && <li>No lock matches the filter.</li>}
      </ul>

      <button
        type="button"
        className="outlined-button"
        disabled={visible.length === 0}
        onClick={() =>
          onExport(
            lockExportRequest(
              visible,
              `Filter: ${binding.state.regex ? binding.state.pattern : binding.state.query || "none"}`,
            ),
          )
        }
      >
        Export the locked-items list
      </button>

      <details>
        <summary>Documented reset path</summary>
        <p>
          A lock can be removed from this list while it is unlocked. If every answer is lost, clear this
          browser's site data for this page: the locks are stored with the other local preferences and are
          removed with them. Nothing else is affected, because a lock protects no stored data.
        </p>
        <button type="button" className="outlined-button" onClick={() => api.clearAll()}>
          Remove every lock in this browser
        </button>
      </details>
    </section>
  );
}
