"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function ContractPreviewDialog({
  open,
  html,
  filename,
  busy,
  onDownload,
  onClose,
}: {
  open: boolean;
  html: string;
  filename: string;
  busy: boolean;
  onDownload: () => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [busy, onClose, open]);

  if (!open) return null;

  return createPortal(<div className="portal-contract-preview-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <section className="portal-contract-preview" role="dialog" aria-modal="true" aria-labelledby="contract-preview-title">
      <header className="portal-contract-preview-header">
        <div>
          <h2 id="contract-preview-title">Preview partner contract</h2>
          <p>{filename}</p>
        </div>
        <button ref={closeRef} type="button" className="portal-contract-preview-close" aria-label="Close contract preview" disabled={busy} onClick={onClose}>&times;</button>
      </header>
      <iframe className="portal-contract-preview-frame" title="Ayursarga partner contract preview" srcDoc={html} sandbox="" />
      <footer className="portal-contract-preview-actions">
        <p>Review the populated hospital details before downloading the final PDF.</p>
        <div className="portal-actions">
          <button type="button" className="portal-button secondary" disabled={busy} onClick={onClose}>Close preview</button>
          <button type="button" className="portal-button" disabled={busy} onClick={onDownload}>{busy ? "Preparing PDF..." : "Download PDF"}</button>
        </div>
      </footer>
    </section>
  </div>, document.body);
}
