"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

export default function ScrollLogo() {
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const logo = logoRef.current;
    if (!logo) return;
    const desktop = window.matchMedia("(min-width: 901px) and (prefers-reduced-motion: no-preference)");
    if (!desktop.matches) return;

    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const maximum = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const progress = Math.min(1, Math.max(0, window.scrollY / maximum));
        const scale = 0.72 + progress * 0.34;
        logo.style.transform = `scale(${scale})`;
        logo.style.opacity = `${0.48 + progress * 0.52}`;
        frame = 0;
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="scroll-logo" aria-hidden="true">
      <div ref={logoRef} className="scroll-logo-mark">
        <Image src="/mainlogo.png" alt="" width={54} height={54} loading="eager" quality={90} sizes="54px" />
      </div>
    </div>
  );
}
