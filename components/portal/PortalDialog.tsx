"use client";

import { useId, useRef, type ReactNode } from "react";
import { ModalLayer } from "@/components/ModalLayer";

export function PortalDialog({
  open,
  title,
  message,
  tone = "default",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busy = false,
  confirmDisabled = false,
  children,
  onConfirm,
  onCancel,
  onDismiss,
  initialFocus = "cancel",
}: {
  open: boolean;
  title: string;
  message?: string;
  tone?: "default" | "danger";
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  confirmDisabled?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  onDismiss?: () => void;
  initialFocus?: "confirm" | "cancel";
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();
  return <ModalLayer open={open} className="portal-dialog-backdrop" busy={busy} onClose={onDismiss ?? onCancel} initialFocusRef={children ? undefined : initialFocus === "confirm" ? confirmRef : cancelRef}>
    <section className="portal-dialog" data-tone={tone} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={message ? messageId : undefined}>
      <span className="portal-dialog-leaf" aria-hidden="true" />
      <span className="portal-eyebrow">Please confirm</span>
      <h2 id={titleId}>{title}</h2>
      {message && <p id={messageId}>{message}</p>}
      {children}
      <div className="portal-actions portal-dialog-actions">
        <button ref={cancelRef} type="button" className="portal-button secondary" disabled={busy} onClick={onCancel}>{cancelLabel}</button>
        <button ref={confirmRef} type="button" className={`portal-button${tone === "danger" ? " danger" : ""}`} disabled={busy || confirmDisabled} onClick={onConfirm}>{busy ? "Working..." : confirmLabel}</button>
      </div>
    </section>
  </ModalLayer>;
}
