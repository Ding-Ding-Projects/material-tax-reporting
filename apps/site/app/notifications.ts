"use client";

/**
 * Notification state for the site.
 *
 * The reducer, the persistence rule and the filters are kernel functions. This
 * module owns only the React state, the toast timers and the persisted copy in
 * local storage.
 *
 * Progress and error notices are persistent: they stay until the reader
 * dismisses them. Success and information notices auto-dismiss from the toast
 * region and remain in the centre until they are dismissed there.
 */

import {
  type Notification,
  type NotificationSeverity,
  DEFAULT_TOAST_MS,
  createNotification,
  isPersistent,
  reduceNotifications,
} from "@material-tax-reporting/surface-kernel";
import { useCallback, useEffect, useRef, useState } from "react";

export type NotifyInput = {
  kind: NotificationSeverity;
  title: string;
  body: string;
};

export type NotificationsApi = {
  list: Notification[];
  toasts: Notification[];
  unreadCount: number;
  /** Restores a persisted list without producing toasts for old notices. */
  hydrate: (list: Notification[]) => void;
  notify: (input: NotifyInput) => string;
  resolveProgress: (id: string, outcome: NotifyInput) => void;
  dismissToast: (id: string) => void;
  markRead: (id: string) => void;
  markUnread: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  dismissMany: (ids: readonly string[]) => void;
  clearAll: () => void;
};

function nextId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `n-${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000_000).toString(36)}`;
}

export function useNotifications(persist: (list: Notification[]) => void): NotificationsApi {
  const [list, setList] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<Notification[]>([]);
  // Every scheduled dismissal is tracked so the effect below can clear it; the
  // previous implementation left a timer running after unmount.
  const timers = useRef(new Map<string, number>());

  useEffect(() => {
    const handles = timers.current;
    return () => {
      for (const handle of handles.values()) window.clearTimeout(handle);
      handles.clear();
    };
  }, []);

  const apply = useCallback(
    (updater: (current: Notification[]) => Notification[]) => {
      setList((current) => {
        const next = updater(current);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const hydrate = useCallback((restored: Notification[]) => setList(restored), []);

  const dismissToast = useCallback((id: string) => {
    const handle = timers.current.get(id);
    if (handle !== undefined) {
      window.clearTimeout(handle);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    (input: NotifyInput) => {
      const notification = createNotification({
        id: nextId(),
        kind: input.kind,
        title: input.title,
        body: input.body,
        createdAt: new Date().toISOString(),
      });
      apply((current) => reduceNotifications(current, { type: "add", notification }));
      setToasts((current) => [...current, notification]);
      if (!isPersistent(notification.kind)) {
        const handle = window.setTimeout(() => {
          timers.current.delete(notification.id);
          setToasts((current) => current.filter((item) => item.id !== notification.id));
        }, DEFAULT_TOAST_MS);
        timers.current.set(notification.id, handle);
      }
      return notification.id;
    },
    [apply],
  );

  /** Replaces a persistent progress notice with its outcome. */
  const resolveProgress = useCallback(
    (id: string, outcome: NotifyInput) => {
      dismissToast(id);
      apply((current) => reduceNotifications(current, { type: "dismiss", id }));
      notify(outcome);
    },
    [apply, dismissToast, notify],
  );

  return {
    list,
    toasts,
    unreadCount: list.filter((item) => !item.read).length,
    hydrate,
    notify,
    resolveProgress,
    dismissToast,
    markRead: (id) => apply((current) => reduceNotifications(current, { type: "mark-read", id })),
    markUnread: (id) => apply((current) => reduceNotifications(current, { type: "mark-unread", id })),
    markAllRead: () => apply((current) => reduceNotifications(current, { type: "mark-all-read" })),
    dismiss: (id) => {
      dismissToast(id);
      apply((current) => reduceNotifications(current, { type: "dismiss", id }));
    },
    dismissMany: (ids) => {
      for (const id of ids) dismissToast(id);
      apply((current) => reduceNotifications(current, { type: "dismiss-scope", ids: [...ids] }));
    },
    clearAll: () => {
      for (const item of toasts) dismissToast(item.id);
      apply((current) => reduceNotifications(current, { type: "clear" }));
    },
  };
}

/** Restores a persisted list, discarding anything that is not a notification. */
export function validateNotifications(raw: unknown): Notification[] {
  if (!Array.isArray(raw)) return [];
  const kinds = new Set<NotificationSeverity>(["success", "error", "progress", "info"]);
  const accepted: Notification[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      typeof record.title !== "string" ||
      typeof record.body !== "string" ||
      typeof record.createdAt !== "string" ||
      typeof record.kind !== "string" ||
      !kinds.has(record.kind as NotificationSeverity)
    ) {
      continue;
    }
    const kind = record.kind as NotificationSeverity;
    accepted.push({
      id: record.id,
      kind,
      title: record.title.slice(0, 200),
      body: record.body.slice(0, 800),
      createdAt: record.createdAt,
      read: record.read === true,
      persistent: isPersistent(kind),
    });
  }
  return accepted;
}
