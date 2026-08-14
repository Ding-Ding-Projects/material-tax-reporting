"use client";

/**
 * Local history for every personalization change.
 *
 * The record shape, the redaction pass, the filter and the append-only restore
 * rule are kernel functions. This module owns the IndexedDB-backed store, the
 * React state and the diff builders.
 *
 * Two rules are load-bearing:
 *   - restoring a recorded state appends a NEW record and never rewrites an
 *     earlier one; and
 *   - personal-vocabulary values are never written to a record. Only the key
 *     count and the key and value lengths are kept.
 */

import {
  type DiffEntry,
  type HistoryAction,
  type HistoryFilter,
  type HistoryRecord,
  type RedactionRules,
  DEFAULT_HISTORY_CAP,
  DEFAULT_REDACTION_RULES,
  redactRecord,
  restoreAsNewRevision,
  systemClock,
} from "@material-tax-reporting/surface-kernel";
import { useCallback, useEffect, useRef, useState } from "react";
import { IndexedDbHistoryStore } from "./storage.ts";

/** Records kept before the visible prune control has anything to remove. */
export const SITE_HISTORY_CAP = DEFAULT_HISTORY_CAP;

/** Most records read into the browser at once. */
const READ_LIMIT = 500;

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `h-${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000_000).toString(36)}`;
}

/** Renders a value for a diff without ever printing a vocabulary value. */
export function describeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.slice(0, 200);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value).slice(0, 200);
}

/** Builds a diff between two flat records. */
export function diffRecords(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  prefix = "",
): DiffEntry[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const entries: DiffEntry[] = [];
  for (const key of keys) {
    const from = describeValue(before[key]);
    const to = describeValue(after[key]);
    if (from === to) continue;
    entries.push({ path: `${prefix}${key}`, before: from, after: to });
  }
  return entries;
}

/**
 * The only description a vocabulary change may carry: how many replacements
 * were accepted and how long the keys and values were. Never the text itself.
 */
export function vocabularyShape(map: Record<string, string>): DiffEntry[] {
  const keys = Object.keys(map);
  const keyLengths = keys.map((key) => key.length);
  const valueLengths = Object.values(map).map((value) => value.length);
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  return [
    { path: "vocabulary.replacementCount", before: null, after: String(keys.length) },
    {
      path: "vocabulary.keyLengthTotal",
      before: null,
      after: String(sum(keyLengths)),
    },
    {
      path: "vocabulary.valueLengthTotal",
      before: null,
      after: String(sum(valueLengths)),
    },
  ];
}

export type HistoryApi = {
  available: boolean;
  unavailableReason: string | null;
  records: HistoryRecord[];
  total: number;
  cap: number;
  record: (action: HistoryAction, summary: string, diff: DiffEntry[]) => void;
  restore: (revisionId: string) => Promise<HistoryRecord | null>;
  prune: () => Promise<number>;
  clear: () => Promise<void>;
  reload: (filter?: HistoryFilter) => Promise<void>;
};

export function useHistory(options: {
  redaction?: Partial<RedactionRules>;
  onError?: (message: string) => void;
}): HistoryApi {
  const storeRef = useRef<IndexedDbHistoryStore | null>(null);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);

  // The caller supplies a fresh callback and redaction rule set on every
  // render. Holding both in refs keeps the loader and the writer stable, so the
  // initial read runs once instead of on every render.
  const onErrorRef = useRef(options.onError);
  onErrorRef.current = options.onError;
  const redactionRef = useRef<RedactionRules>({ ...DEFAULT_REDACTION_RULES, ...options.redaction });
  redactionRef.current = { ...DEFAULT_REDACTION_RULES, ...options.redaction };

  if (storeRef.current === null && IndexedDbHistoryStore.supported()) {
    storeRef.current = new IndexedDbHistoryStore();
  }

  const reload = useCallback(async (filter: HistoryFilter = {}) => {
    const store = storeRef.current;
    if (!store) {
      setUnavailableReason("This browser did not expose IndexedDB, so local history cannot be kept.");
      return;
    }
    try {
      const [batch, count] = await Promise.all([
        store.readBatch(filter, null, READ_LIMIT),
        store.count(),
      ]);
      setRecords(batch);
      setTotal(count);
      setUnavailableReason(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The local history could not be read.";
      setUnavailableReason(message);
      onErrorRef.current?.(message);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const record = useCallback((action: HistoryAction, summary: string, diff: DiffEntry[]) => {
    const store = storeRef.current;
    if (!store) return;
    const entry = redactRecord(
      {
        id: newId(),
        revisionId: newId(),
        action,
        at: systemClock.isoNow(),
        actorSurface: "site",
        summary,
        redactedDiff: diff,
      },
      redactionRef.current,
    );
    void store
      .append(entry)
      .then(() => {
        setRecords((current) => [entry, ...current].slice(0, READ_LIMIT));
        setTotal((current) => current + 1);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "The local history record could not be written.";
        setUnavailableReason(message);
        onErrorRef.current?.(message);
      });
  }, []);

  const restore = useCallback(
    async (revisionId: string) => {
      const store = storeRef.current;
      if (!store) return null;
      try {
        const created = restoreAsNewRevision(records, revisionId);
        await store.append(created);
        setRecords((current) => [created, ...current].slice(0, READ_LIMIT));
        setTotal((current) => current + 1);
        return created;
      } catch (error) {
        const message = error instanceof Error ? error.message : "The selected state could not be restored.";
        setUnavailableReason(message);
        onErrorRef.current?.(message);
        return null;
      }
    },
    [records],
  );

  const prune = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return 0;
    const removed = await store.prune(SITE_HISTORY_CAP);
    await reload();
    return removed;
  }, [reload]);

  const clear = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    await store.clear();
    await reload();
  }, [reload]);

  return {
    available: storeRef.current !== null && unavailableReason === null,
    unavailableReason,
    records,
    total,
    cap: SITE_HISTORY_CAP,
    record,
    restore,
    prune,
    clear,
    reload,
  };
}
