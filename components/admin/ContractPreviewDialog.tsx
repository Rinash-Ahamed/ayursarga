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
    const scrollY = window.scrollY;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overscrollBehavior = "none";
    closeRef.current?.focus();

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
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
