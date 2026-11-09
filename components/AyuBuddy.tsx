"use client";

import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import AyuPortrait from "@/components/AyuPortrait";
import dynamic from "next/dynamic";
import { WhatsAppLauncher } from "@/components/WhatsAppBubble";
// Modal, guide, phone control and email transport stay out of the initial view.
const AyuBuddyDialog = dynamic(() => import("@/components/AyuBuddyDialog"), { ssr: false });

class AyuDialogBoundary extends Component<{ children: ReactNode; onClose: () => void; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="ayu-buddy-unavailable" role="alert"><p>Ayu is unavailable right now. You can still use the website and contact our team.</p><a href="mailto:info@ayursarga.com">info@ayursarga.com</a><button type="button" onClick={this.props.onClose}>Dismiss</button></div>;
  }
}

function AyuBuddyLauncher() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState("ayu");
  const [hovered, setHovered] = useState(false);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const keyboardNavigation = useRef(false);
  const markReady = useCallback(() => setReady(true), []);
  const handleFailure = useCallback(() => { setBusy(false); setReady(true); }, []);
  const close = () => { if (!busy) { setOpen(false); setReady(false); } };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Tab") keyboardNavigation.current = true;
    };
    const pointerdown = (event: PointerEvent) => {
      keyboardNavigation.current = false;
      setKeyboardFocused(false);
      if (event.pointerType !== "mouse") setHovered(false);
    };
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("pointerdown", pointerdown, true);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("pointerdown", pointerdown, true);
    };
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReducedMotion(media.matches);
    const visibility = () => setVisible(document.visibilityState === "visible");
    motion(); visibility();
    media.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    return () => { media.removeEventListener("change", motion); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  useEffect(() => {
    if (open || hovered || keyboardFocused || !visible || reducedMotion) return;
    const timer = window.setInterval(() => setActive(value => value === "ayu" ? "whatsapp" : "ayu"), 3_000);
    return () => window.clearInterval(timer);
  }, [open, hovered, keyboardFocused, visible, reducedMotion]);
  const ayuVisible = reducedMotion || open || active === "ayu";
  return <>
    <div className="support-launcher" data-static={reducedMotion} aria-label="Contact Ayursarga"
      onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={event => { if (event.pointerType === "mouse") setHovered(false); }}
      onFocusCapture={() => setKeyboardFocused(keyboardNavigation.current)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardFocused(false); }}>
    <button ref={launcher} className="ayu-buddy-launcher support-launcher-option" data-active={ayuVisible} aria-hidden={!ayuVisible} inert={!ayuVisible} tabIndex={ayuVisible ? 0 : -1} type="button" aria-label="Ask Ayu, your Ayursarga guide" aria-haspopup="dialog" aria-expanded={open} disabled={busy} onClick={(event) => {
      // Safari does not focus pointer-activated buttons by default. Give the
      // shared modal a reliable focus-return target before it opens.
      event.currentTarget.focus({ preventScroll: true });
      if (open) close();
      else setOpen(true);
    }}>
      <AyuPortrait />
      <span className="ayu-buddy-launcher-label">{open && !ready ? "Opening Ayu..." : "Ask Ayu"}</span>
    </button>
    <WhatsAppLauncher rotating active={reducedMotion || (!open && active === "whatsapp")} />
    </div>
    {open && <AyuDialogBoundary onFailure={handleFailure} onClose={() => { close(); launcher.current?.focus({ preventScroll: true }); }}>
      <AyuBuddyDialog onClose={close} onBusyChange={setBusy} onReady={markReady} />
    </AyuDialogBoundary>}
  </>;
}

export default function AyuBuddy() {
  // The server and client receive the same build-time value; no hydration branch.
  return process.env.NEXT_PUBLIC_AYU_ONLINE === "true" ? <AyuBuddyLauncher /> : null;
}
