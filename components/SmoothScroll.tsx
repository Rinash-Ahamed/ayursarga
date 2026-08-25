"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const wheelEasing = (t: number) => 1 - Math.pow(1 - t, 4);
const anchorEasing = (t: number) => t < 0.5
  ? 4 * t * t * t
  : 1 - Math.pow(-2 * t + 2, 3) / 2;

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const supportsDesktopScroll = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const lenis = reduced || !supportsDesktopScroll ? null : new Lenis({
      duration: 0.95,
      easing: wheelEasing,
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

      const scrollTarget = target.matches("section")
        ? target.querySelector<HTMLElement>(":scope > .section-inner") ?? target
        : target;
      const navigation = document.getElementById("site-nav");
      const navigationContentHeight = navigation?.querySelector<HTMLElement>(".nav-inner")?.getBoundingClientRect().height;
      const navigationHeight = navigationContentHeight
        ? navigationContentHeight + 28
        : navigation?.getBoundingClientRect().height ?? 0;
      const destination = hash === "#hero"
        ? 0
        : Math.max(0, window.scrollY + scrollTarget.getBoundingClientRect().top - navigationHeight - 12);
      const complete = () => {
        window.history.replaceState(null, "", hash);
        target.focus({ preventScroll: true });
      };

      event.preventDefault();
      if (lenis) {
        lenis.scrollTo(destination, {
          duration: 1.25,
          easing: anchorEasing,
          onComplete: complete,
        });
      } else {
        window.scrollTo({ top: destination, behavior: reduced ? "auto" : "smooth" });
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
