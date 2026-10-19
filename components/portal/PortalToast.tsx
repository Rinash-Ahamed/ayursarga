"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { createToastNotification, expireStaleToasts, getServerToasts, getVisibleToasts, observeToast, subscribeToToasts, toastNotificationForSource, type ToastNotification, type ToastTone } from "@/utils/toastNotifications";

export function PortalToast({ message, tone = "success", notification, source }: {
  message?: string | null;
  tone?: ToastTone;
  notification?: ToastNotification | null;
  source?: object | null;
}) {
  const event = useMemo(() => {
    if (!message) return null;
    if (notification) return notification;
    return source ? toastNotificationForSource(source, message) : createToastNotification(message);
  }, [message, notification, source]);
  useEffect(() => {
    if (event && message) return observeToast(event, tone, message);
  }, [event, message, tone]);
  return null;
}

/** One persistent renderer; page updates cannot restart a completed animation. */
export function PortalToastViewport() {
  const toasts = useSyncExternalStore(subscribeToToasts, getVisibleToasts, getServerToasts);
  useEffect(() => {
    document.addEventListener("visibilitychange", expireStaleToasts);
    window.addEventListener("pageshow", expireStaleToasts);
    window.addEventListener("focus", expireStaleToasts);
    return () => {
      document.removeEventListener("visibilitychange", expireStaleToasts);
      window.removeEventListener("pageshow", expireStaleToasts);
      window.removeEventListener("focus", expireStaleToasts);
    };
  }, []);
  return <div id="portal-toast-viewport" className="portal-toast-viewport" aria-label="Notifications">
    {toasts.map((toast) => <div key={toast.id} className="portal-toast" data-tone={toast.tone} role={toast.tone === "error" ? "alert" : "status"} aria-live={toast.tone === "error" ? "assertive" : "polite"} style={{ animationDuration: `${toast.duration}ms` }}>
      <span className="portal-toast-mark" aria-hidden="true">{toast.tone === "error" || toast.tone === "warning" ? <svg viewBox="0 0 16 16"><path d="M8 3v6"/><circle cx="8" cy="12" r=".5" fill="currentColor" stroke="none"/></svg> : <svg viewBox="0 0 16 16"><path d="m3 8.5 3.5 3.5 6.5-8"/></svg>}</span>
      <p>{toast.message}</p>
    </div>)}
  </div>;
}
