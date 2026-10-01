"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const OPENING_SESSION_KEY = "ayursarga-public-opening-seen";

export default function PublicOpening() {
  const [phase, setPhase] = useState<"visible" | "leaving" | "hidden">("visible");

  useEffect(() => {
    let hasOpened = false;
    try {
      hasOpened = window.sessionStorage.getItem(OPENING_SESSION_KEY) === "true";
    } catch {
      // The reveal remains safe when browser storage is unavailable.
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const compactOrTouchDevice = window.matchMedia("(max-width: 1099px), (hover: none), (pointer: coarse)").matches;
    if (!hasOpened) {
      try {
        window.sessionStorage.setItem(OPENING_SESSION_KEY, "true");
      } catch {
        // A blocked storage API should not prevent the page from opening.
      }
    }
    if (hasOpened || reducedMotion || compactOrTouchDevice) {
      document.documentElement.dataset.ayursargaOpening = "seen";
      const hideTimer = window.setTimeout(() => setPhase("hidden"), 0);
      return () => window.clearTimeout(hideTimer);
    }

    const leaveTimer = window.setTimeout(() => setPhase("leaving"), 360);
    const hideTimer = window.setTimeout(() => {
      document.documentElement.dataset.ayursargaOpening = "seen";
      setPhase("hidden");
    }, 560);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div className="public-opening" data-phase={phase} aria-hidden="true">
      <div className="public-opening-mark">
        <Image src="/mainlogo.png" alt="" width={72} height={72} priority quality={82} sizes="72px" />
        <span>Ayursarga</span>
      </div>
    </div>
  );
}
