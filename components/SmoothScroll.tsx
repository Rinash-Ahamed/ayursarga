"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = reduced ? null : new Lenis({
      duration: 0.72,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 1,
      touchMultiplier: 1,
    });

    lenis?.on("scroll", ScrollTrigger.update);

    const handleAnchorClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link) return;
      const hash = link.getAttribute("href");
      if (!hash || hash === "#") return;
      const target = document.querySelector<HTMLElement>(hash);
      if (!target) return;

      const content = target.querySelector<HTMLElement>(":scope > .section-inner") ?? target;
      const navigationHeight = document.getElementById("site-nav")?.getBoundingClientRect().height ?? 0;
      const contentRect = content.getBoundingClientRect();
      const availableHeight = Math.max(window.innerHeight - navigationHeight, 0);
      const centeredSpace = contentRect.height < availableHeight
        ? (availableHeight - contentRect.height) / 2
        : 16;
      const destination = window.scrollY + contentRect.top - navigationHeight - centeredSpace;
      const scrollTop = Math.max(0, destination);
      const complete = () => {
        window.history.replaceState(null, "", hash);
        target.focus({ preventScroll: true });
      };

      event.preventDefault();
      if (lenis) {
        lenis.scrollTo(scrollTop, { duration: 1.05, onComplete: complete });
      } else {
        window.scrollTo({ top: scrollTop, behavior: "auto" });
        complete();
      }
    };

    document.addEventListener("click", handleAnchorClick);

    // GSAP supplies seconds; Lenis expects milliseconds. Both stay synced to
    // the display's native requestAnimationFrame cadence (60/90/120/144 Hz).
    const tick = lenis ? (time: number) => lenis.raf(time * 1000) : null;
    if (tick) {
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    }

    return () => {
      if (tick) gsap.ticker.remove(tick);
      document.removeEventListener("click", handleAnchorClick);
      lenis?.destroy();
    };
  }, []);

  return <>{children}</>;
}
