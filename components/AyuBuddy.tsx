"use client";

import { Component, useCallback, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
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
  const launcher = useRef<HTMLButtonElement>(null);
  const markReady = useCallback(() => setReady(true), []);
  const handleFailure = useCallback(() => { setBusy(false); setReady(true); }, []);
  const close = () => { if (!busy) { setOpen(false); setReady(false); } };
  return <>
    <button ref={launcher} className="ayu-buddy-launcher" type="button" aria-label="Ask Ayu, your Ayursarga guide" aria-haspopup="dialog" aria-expanded={open} disabled={busy} onClick={(event) => {
      // Safari does not focus pointer-activated buttons by default. Give the
      // shared modal a reliable focus-return target before it opens.
      event.currentTarget.focus({ preventScroll: true });
      if (open) close();
      else setOpen(true);
    }}>
      <Image src="/ayu-buddy.webp" alt="" width={72} height={71} sizes="72px" unoptimized />
      <span>{open && !ready ? "Opening Ayu..." : "Ask Ayu"}</span>
    </button>
    {open && <AyuDialogBoundary onFailure={handleFailure} onClose={() => { close(); launcher.current?.focus({ preventScroll: true }); }}>
      <AyuBuddyDialog onClose={close} onBusyChange={setBusy} onReady={markReady} />
    </AyuDialogBoundary>}
  </>;
}

export default function AyuBuddy() {
  // The server and client receive the same build-time value; no hydration branch.
  return process.env.NEXT_PUBLIC_AYU_ONLINE === "true" ? <AyuBuddyLauncher /> : null;
}
