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
    <span className="portal-toast-mark" aria-hidden="true">{tone === "error" ? "!" : "✓"}</span>
    <p>{message}</p>
  </div>;
}
