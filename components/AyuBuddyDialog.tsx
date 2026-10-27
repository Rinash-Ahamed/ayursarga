"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import { ModalLayer } from "@/components/ModalLayer";
import AyuBuddyPanel from "@/components/AyuBuddyPanel";

export default function AyuBuddyDialog({ onClose, onBusyChange, onReady }: {
  onClose: () => void; onBusyChange: (busy: boolean) => void; onReady: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const taglineId = useId();
  useEffect(() => { onReady(); }, [onReady]);
  const updateBusy = (value: boolean) => { setBusy(value); onBusyChange(value); };
  return <ModalLayer open className="ayu-buddy-layer" busy={busy} onClose={onClose}>
    <section className="ayu-buddy-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={taglineId}>
      <header className="ayu-buddy-header">
        <Image src="/ayu-buddy.webp" alt="" width={56} height={55} sizes="56px" unoptimized />
        <div><h2 id={titleId}>I&apos;m Ayu</h2><p id={taglineId}>Your little buddy for natural wellness</p></div>
        <button type="button" className="ayu-buddy-close" aria-label="Close Ayu" disabled={busy} onClick={onClose}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </header>
      <AyuBuddyPanel busy={busy} onBusyChange={updateBusy} onNavigate={onClose} />
    </section>
  </ModalLayer>;
}
