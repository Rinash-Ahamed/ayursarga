"use client";

import { useEffect, useRef, useState } from "react";

export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hoverQuery = window.matchMedia("(hover: hover)");
    const syncEnabled = () => setEnabled(hoverQuery.matches);
    syncEnabled();
    let frame = 0;
    let pointerX = -100;
    let pointerY = -100;
    hoverQuery.addEventListener("change", syncEnabled);

    const paint = () => {
      cursorRef.current?.style.setProperty("transform", `translate3d(${pointerX}px, ${pointerY}px, 0)`);
      frame = 0;
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    const onOver = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest("[data-hover]")) {
        cursorRef.current?.classList.add("hover");
      }
    };
    const onOut = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest("[data-hover]");
      const related = (event.relatedTarget as Element | null)?.closest?.("[data-hover]");
      if (target && target !== related) cursorRef.current?.classList.remove("hover");
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerout", onOut, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      hoverQuery.removeEventListener("change", syncEnabled);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerout", onOut);
    };
  }, []);

  if (!enabled) return null;

  return <div ref={cursorRef} className="cursor-dot" />;
}
