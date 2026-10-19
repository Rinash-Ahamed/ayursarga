"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { lockDocumentScroll } from "@/utils/documentScrollLock";

const layers: HTMLElement[] = [];
const FOCUSABLE = 'a[href], button, input, textarea, select, iframe, [tabindex]:not([tabindex="-1"])';

/** Body-level layer shared by confirmations, contract preview and public login. */
export function ModalLayer({ open, className, busy = false, onClose, initialFocusRef, children }: {
  open: boolean;
  className: string;
  busy?: boolean;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ busy, onClose, initialFocusRef });
  useEffect(() => { latest.current = { busy, onClose, initialFocusRef }; }, [busy, onClose, initialFocusRef]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!open || !layer) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unlock = lockDocumentScroll();
    layers.push(layer);
    layer.style.zIndex = String(180 + layers.length);
    const isTopLayer = () => layers[layers.length - 1] === layer;
    const controls = () => Array.from(layer.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) =>
      !element.matches(':disabled, [aria-disabled="true"], [tabindex="-1"]')
      && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden",
    );
    const focusFirst = () => {
      const preferred = latest.current.initialFocusRef?.current;
      const available = controls();
      (preferred && available.includes(preferred) ? preferred : available[0] ?? layer).focus({ preventScroll: true });
    };
    const updateViewport = () => {
      const viewport = window.visualViewport;
      if (!viewport) return;
      layer.style.top = `${viewport.offsetTop}px`;
      layer.style.left = `${viewport.offsetLeft}px`;
      layer.style.width = `${viewport.width}px`;
      layer.style.height = `${viewport.height}px`;
    };
    updateViewport();
    focusFirst();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopLayer()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!latest.current.busy) latest.current.onClose();
      } else if (event.key === "Tab") {
        const items = controls();
        const first = items[0];
        const last = items[items.length - 1];
        if (!first) {
          event.preventDefault();
          layer.focus({ preventScroll: true });
        } else if (!layer.contains(document.activeElement) || document.activeElement === layer
          || (event.shiftKey && document.activeElement === first)
          || (!event.shiftKey && document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus({ preventScroll: true });
        }
      }
    };
    const containFocus = (event: FocusEvent) => {
      if (isTopLayer() && event.target instanceof Node && !layer.contains(event.target)) focusFirst();
    };
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", containFocus);
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", containFocus);
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
      const wasTopLayer = isTopLayer();
      const index = layers.indexOf(layer);
      if (index !== -1) layers.splice(index, 1);
      unlock();
      if (wasTopLayer && previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(<div ref={layerRef} className={`app-modal-layer ${className}`} tabIndex={-1} role="presentation" data-lenis-prevent onMouseDown={(event) => {
    if (event.target === event.currentTarget && layers[layers.length - 1] === event.currentTarget && !busy) onClose();
  }}>{children}</div>, document.body);
}
