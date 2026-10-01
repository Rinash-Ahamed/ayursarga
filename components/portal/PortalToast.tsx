"use client";

import { useLayoutEffect, useRef } from "react";

type PortalToastTone = "success" | "error" | "info";

export function PortalToast({ message, tone = "success" }: {
  message?: string | null;
  tone?: PortalToastTone;
}) {
  const toastRef = useRef<HTMLDivElement>(null);

  // Restart the lifetime whenever the parent reports an action, even when the
  // resulting message text is identical to the previous notification.
  useLayoutEffect(() => {
    const toast = toastRef.current;
    if (!toast || !message) return;
    toast.style.animation = "none";
    void toast.offsetWidth;
    toast.style.removeProperty("animation");
  });

  if (!message) return null;
  return <div
    ref={toastRef}
    key={`${tone}:${message}`}
    className="portal-toast"
    data-tone={tone}
    role={tone === "error" ? "alert" : "status"}
    aria-live={tone === "error" ? "assertive" : "polite"}
  >
    <span className="portal-toast-mark" aria-hidden="true">{tone === "error" ? <svg viewBox="0 0 16 16"><path d="M8 3v6"/><circle cx="8" cy="12" r=".5" fill="currentColor" stroke="none"/></svg> : <svg viewBox="0 0 16 16"><path d="m3 8.5 3.5 3.5 6.5-8"/></svg>}</span>
    <p>{message}</p>
  </div>;
}
