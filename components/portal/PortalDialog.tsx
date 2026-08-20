"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function PortalDialog({
  open,
  title,
  message,
  tone = "default",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busy = false,
  children,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  tone?: "default" | "danger";
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancelRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, open]);

  if (!open) return null;

  return <div className="portal-dialog-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget && !busy) onCancel();
  }}>
    <section className="portal-dialog" role="dialog" aria-modal="true" aria-labelledby="portal-dialog-title">
      <span className="portal-dialog-leaf" aria-hidden="true" />
      <span className="portal-eyebrow">Please confirm</span>
      <h2 id="portal-dialog-title">{title}</h2>
      {message && <p>{message}</p>}
      {children}
      <div className="portal-actions portal-dialog-actions">
        <button ref={cancelRef} type="button" className="portal-button secondary" disabled={busy} onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className={`portal-button${tone === "danger" ? " danger" : ""}`} disabled={busy} onClick={onConfirm}>{busy ? "Working..." : confirmLabel}</button>
      </div>
    </section>
  </div>;
}
