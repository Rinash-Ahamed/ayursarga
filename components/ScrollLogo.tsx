"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

export default function ScrollLogo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const logo = logoRef.current;
    const footer = document.querySelector<HTMLElement>("#site-footer");
    if (!container || !logo || !footer) return;
    const desktop = window.matchMedia("(min-width: 1025px) and (prefers-reduced-motion: no-preference)");
    if (!desktop.matches) return;

    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const maximum = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const progress = Math.min(1, Math.max(0, window.scrollY / maximum));
        const footerTop = footer.getBoundingClientRect().top;
        const fadeStartY = window.innerHeight;
        const fadeFinishY = window.innerHeight * 0.72;
        const linearFade = Math.min(1, Math.max(0, (fadeStartY - footerTop) / Math.max(1, fadeStartY - fadeFinishY)));
        const footerFade = linearFade * linearFade * (3 - 2 * linearFade);
        const journeyScale = 0.72 + progress * 0.34;

        container.style.transform = "translate3d(0,0,0)";
        logo.style.transform = `scale(${journeyScale})`;
        logo.style.opacity = `${(0.48 + progress * 0.52) * (1 - footerFade)}`;
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
      container.style.removeProperty("transform");
      logo.style.removeProperty("transform");
      logo.style.removeProperty("opacity");
    };
  }, []);

  return (
    <div ref={containerRef} className="scroll-logo" aria-hidden="true">
      <div ref={logoRef} className="scroll-logo-mark">
        <span className="scroll-logo-crop">
          <Image src="/mainlogo.png" alt="" width={54} height={54} loading="eager" quality={90} sizes="54px" />
        </span>
      </div>
    </div>
  );
}
