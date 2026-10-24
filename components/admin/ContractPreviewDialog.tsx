"use client";

import { useRef } from "react";
import { ModalLayer } from "@/components/ModalLayer";

export function ContractPreviewDialog({
  open,
  html,
  filename,
  busy,
  onDownload,
  onClose,
  heading = "Preview partner contract",
  documentTitle = "Ayursarga partner contract preview",
  description = "Review the populated hospital details before downloading the final PDF.",
  actionLabel = "Download PDF",
  busyLabel = "Preparing PDF...",
  closeLabel = "Close contract preview",
}: {
  open: boolean;
  html: string;
  filename: string;
  busy: boolean;
  onDownload: () => void;
  onClose: () => void;
  heading?: string;
  documentTitle?: string;
  description?: string;
  actionLabel?: string;
  busyLabel?: string;
  closeLabel?: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  return <ModalLayer open={open} className="portal-contract-preview-backdrop" busy={busy} onClose={onClose} initialFocusRef={closeRef}>
    <section className="portal-contract-preview" role="dialog" aria-modal="true" aria-labelledby="contract-preview-title">
      <header className="portal-contract-preview-header">
        <div>
          <h2 id="contract-preview-title">{heading}</h2>
          <p>{filename}</p>
        </div>
        <button ref={closeRef} type="button" className="portal-contract-preview-close" aria-label={closeLabel} disabled={busy} onClick={onClose}>&times;</button>
      </header>
      <iframe className="portal-contract-preview-frame" title={documentTitle} srcDoc={html} sandbox="" />
      <footer className="portal-contract-preview-actions">
        <p>{description}</p>
        <div className="portal-actions">
          <button type="button" className="portal-button secondary" disabled={busy} onClick={onClose}>Close preview</button>
          <button type="button" className="portal-button" disabled={busy} onClick={onDownload}>{busy ? busyLabel : actionLabel}</button>
        </div>
      </footer>
    </section>
  </ModalLayer>;
}
