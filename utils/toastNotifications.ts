"use client";

export type ToastTone = "success" | "error" | "warning" | "info";
export type ToastNotification = Readonly<{ id: number; message: string; createdAt: number }>;
type VisibleToast = ToastNotification & { tone: ToastTone; expiresAt: number; duration: number };

let sequence = 0;
const consumed = new WeakSet<ToastNotification>();
const observers = new WeakMap<ToastNotification, number>();
const sources = new WeakMap<object, ToastNotification>();
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const EMPTY: readonly VisibleToast[] = [];
let visible: readonly VisibleToast[] = EMPTY;

export function createToastNotification(message: string): ToastNotification {
  return { id: ++sequence, message, createdAt: Date.now() };
}

/** Persistent error objects keep their identity when an auth form remounts. */
export function toastNotificationForSource(source: object, message: string) {
  const previous = sources.get(source);
  if (previous?.message === message) return previous;
  const event = createToastNotification(message);
  const occurredAt = (source as { occurredAt?: unknown }).occurredAt;
  const notification = typeof occurredAt === "number" && Number.isFinite(occurredAt)
    ? { ...event, createdAt: Math.min(event.createdAt, occurredAt) }
    : event;
  sources.set(source, notification);
  return notification;
}

function notify() { listeners.forEach((listener) => listener()); }

function removeToast(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  const next = visible.filter((toast) => toast.id !== id);
  if (next.length === visible.length) return;
  visible = next;
  notify();
}

export function publishToast(notification: ToastNotification, tone: ToastTone, message = notification.message) {
  if (consumed.has(notification)) return;
  consumed.add(notification);
  const expiresAt = notification.createdAt + (tone === "error" ? 8_000 : 6_000);
  const duration = expiresAt - Date.now();
  if (duration <= 0) return;
  visible = [...visible, { ...notification, message, tone, expiresAt, duration }];
  timers.set(notification.id, setTimeout(() => removeToast(notification.id), duration));
  notify();
}

export function observeToast(notification: ToastNotification, tone: ToastTone, message: string) {
  observers.set(notification, (observers.get(notification) ?? 0) + 1);
  publishToast(notification, tone, message);
  return () => {
    observers.set(notification, Math.max(0, (observers.get(notification) ?? 1) - 1));
    // React Strict Mode reconnects effects immediately. A real unmount or clear
    // removes the toast, but reconnecting cannot restart its original lifetime.
    queueMicrotask(() => {
      if (!observers.get(notification)) removeToast(notification.id);
    });
  };
}

/** Timers can be throttled in a background tab; never replay on tab return. */
export function expireStaleToasts() {
  const now = Date.now();
  visible.filter((toast) => toast.expiresAt <= now).forEach((toast) => removeToast(toast.id));
}

export function subscribeToToasts(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const getVisibleToasts = () => visible;
export const getServerToasts = () => EMPTY;
