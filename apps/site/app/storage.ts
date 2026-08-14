/**
 * Browser storage adapters for the shared surface kernel.
 *
 * The kernel deliberately performs no persistence of its own. This module
 * supplies the two ports the documentation site needs: a bounded key/value
 * store over `window.localStorage`, and an append-only history store over
 * IndexedDB so a long record list does not have to be held in one string.
 *
 * Nothing here transmits anything. Every value stays in the browser profile
 * that produced it.
 */

import type { HistoryFilter, HistoryRecord, HistoryStore, KeyValueStore } from "@material-tax-reporting/surface-kernel";

/** Largest single value this surface will write to local storage. */
export const MAX_STORED_VALUE_BYTES = 512 * 1024;

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage !== null;
  } catch {
    return false;
  }
}

/**
 * A `KeyValueStore` over `window.localStorage`.
 *
 * Reads never throw: a browser that blocks storage, a quota failure or a
 * corrupted value all resolve to `null` so a surface can fall back to its
 * shipped defaults instead of failing to render.
 */
export class LocalKeyValueStore implements KeyValueStore {
  async get(key: string): Promise<string | null> {
    if (!hasLocalStorage()) return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    if (!hasLocalStorage()) return;
    if (value.length > MAX_STORED_VALUE_BYTES) {
      throw new Error(`The value for "${key}" exceeds the ${MAX_STORED_VALUE_BYTES / 1024} KB local limit.`);
    }
    window.localStorage.setItem(key, value);
  }

  async delete(key: string): Promise<void> {
    if (!hasLocalStorage()) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* A browser that refuses to remove a key leaves the value in place. */
    }
  }

  async keys(prefix: string): Promise<string[]> {
    if (!hasLocalStorage()) return [];
    const found: string[] = [];
    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key !== null && key.startsWith(prefix)) found.push(key);
      }
    } catch {
      return found;
    }
    return found.sort();
  }
}

/** Reads a JSON record, returning null when it is absent or unreadable. */
export async function readJson<T>(store: KeyValueStore, key: string): Promise<T | null> {
  const raw = await store.get(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Writes a JSON record, reporting a quota or serialization failure by name. */
export async function writeJson(store: KeyValueStore, key: string, value: unknown): Promise<void> {
  await store.set(key, JSON.stringify(value));
}

const DATABASE_NAME = "material-tax-reporting.site";
const DATABASE_VERSION = 1;
const RECORD_STORE = "history-records";
const AT_INDEX = "by-at";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser did not expose IndexedDB, so local history cannot be kept."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RECORD_STORE)) {
        const store = database.createObjectStore(RECORD_STORE, { keyPath: "id" });
        store.createIndex(AT_INDEX, "at", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The local history database could not be opened."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("The local history write did not complete."));
    transaction.onabort = () => reject(transaction.error ?? new Error("The local history write was aborted."));
  });
}

function matchesFilter(record: HistoryRecord, filter: HistoryFilter): boolean {
  if (filter.actions && filter.actions.length > 0 && !filter.actions.includes(record.action)) return false;
  if (filter.from && record.at < filter.from) return false;
  if (filter.to && record.at > filter.to) return false;
  return true;
}

/**
 * An append-only `HistoryStore` over IndexedDB.
 *
 * `append` is the only write path. There is no update and no delete of an
 * individual record: restoring a revision writes a new record, and the only
 * removal path is the explicit prune control, which drops the oldest records
 * once the documented cap is exceeded.
 */
export class IndexedDbHistoryStore implements HistoryStore {
  #database: Promise<IDBDatabase> | null = null;

  #open(): Promise<IDBDatabase> {
    this.#database ??= openDatabase();
    return this.#database;
  }

  /** Whether this browser can keep local history at all. */
  static supported(): boolean {
    return typeof indexedDB !== "undefined";
  }

  async append(record: HistoryRecord): Promise<void> {
    const database = await this.#open();
    const transaction = database.transaction(RECORD_STORE, "readwrite");
    transaction.objectStore(RECORD_STORE).add(record);
    await transactionDone(transaction);
  }

  async read(id: string): Promise<HistoryRecord | null> {
    const database = await this.#open();
    return new Promise((resolve, reject) => {
      const request = database.transaction(RECORD_STORE, "readonly").objectStore(RECORD_STORE).get(id);
      request.onsuccess = () => resolve((request.result as HistoryRecord | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("The local history record could not be read."));
    });
  }

  /** Newest first, resuming after `afterId` when one is supplied. */
  async readBatch(filter: HistoryFilter, afterId: string | null, limit: number): Promise<HistoryRecord[]> {
    const database = await this.#open();
    return new Promise((resolve, reject) => {
      const collected: HistoryRecord[] = [];
      let resuming = afterId !== null;
      const request = database
        .transaction(RECORD_STORE, "readonly")
        .objectStore(RECORD_STORE)
        .index(AT_INDEX)
        .openCursor(null, "prev");
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || collected.length >= limit) {
          resolve(collected);
          return;
        }
        const record = cursor.value as HistoryRecord;
        if (resuming) {
          if (record.id === afterId) resuming = false;
        } else if (matchesFilter(record, filter)) {
          collected.push(record);
        }
        cursor.continue();
      };
      request.onerror = () => reject(request.error ?? new Error("The local history could not be read."));
    });
  }

  /** Total records currently kept. */
  async count(): Promise<number> {
    const database = await this.#open();
    return new Promise((resolve, reject) => {
      const request = database.transaction(RECORD_STORE, "readonly").objectStore(RECORD_STORE).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("The local history could not be counted."));
    });
  }

  /**
   * Drops the oldest records beyond `cap` and reports how many were removed.
   * This is the documented prune path and the only removal this store has.
   */
  async prune(cap: number): Promise<number> {
    const database = await this.#open();
    const total = await this.count();
    if (total <= cap) return 0;
    let toRemove = total - cap;
    const removed = toRemove;
    const transaction = database.transaction(RECORD_STORE, "readwrite");
    const request = transaction.objectStore(RECORD_STORE).index(AT_INDEX).openCursor(null, "next");
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || toRemove <= 0) return;
      cursor.delete();
      toRemove -= 1;
      cursor.continue();
    };
    await transactionDone(transaction);
    return removed;
  }

  /** Removes every record. Used only by the explicit clear control. */
  async clear(): Promise<void> {
    const database = await this.#open();
    const transaction = database.transaction(RECORD_STORE, "readwrite");
    transaction.objectStore(RECORD_STORE).clear();
    await transactionDone(transaction);
  }
}
