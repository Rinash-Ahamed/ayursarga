"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

export default function ScrollLogo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const logo = logoRef.current;
    const footerLogo = document.querySelector<HTMLElement>("[data-scroll-logo-target]");
    const footerIdentity = footerLogo?.closest<HTMLElement>(".footer-identity");
    if (!container || !logo || !footerLogo || !footerIdentity) return;
    const desktop = window.matchMedia("(min-width: 1025px) and (prefers-reduced-motion: no-preference)");
    if (!desktop.matches) return;

    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const maximum = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const progress = Math.min(1, Math.max(0, window.scrollY / maximum));
        const target = footerLogo.getBoundingClientRect();
        const targetCenterY = target.top + target.height / 2;
        const identityTop = window.scrollY + footerIdentity.getBoundingClientRect().top;
        const dockStartScroll = Math.min(maximum - 1, identityTop - window.innerHeight * 0.72);
        const dockingDistance = Math.max(1, maximum - dockStartScroll);
        const linearDock = Math.min(1, Math.max(0, (window.scrollY - dockStartScroll) / dockingDistance));
        const dock = linearDock * linearDock * (3 - 2 * linearDock);
        const baseCenterX = 24 + 27;
        const baseCenterY = window.innerHeight / 2;
        const targetCenterX = target.left + target.width / 2;
        const translateX = (targetCenterX - baseCenterX) * dock;
        const translateY = (targetCenterY - baseCenterY) * dock;
        const journeyScale = 0.72 + progress * 0.34;
        const targetScale = target.width / 54;
        const scale = journeyScale + (targetScale - journeyScale) * dock;

        container.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
        logo.style.transform = `scale(${scale})`;
        logo.style.opacity = `${0.48 + progress * 0.52 + dock * (0.52 - progress * 0.52)}`;
        footerLogo.style.opacity = `${1 - dock}`;
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
      footerLogo.style.removeProperty("opacity");
    };
  }, []);

  return (
    <div ref={containerRef} className="scroll-logo" aria-hidden="true">
      <div ref={logoRef} className="scroll-logo-mark">
        <Image src="/mainlogo.png" alt="" width={54} height={54} loading="eager" quality={90} sizes="54px" />
      </div>
    </div>
  );
}
