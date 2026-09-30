"use client";

import { useEffect } from "react";
import Lenis from "lenis";

// Cubic easing keeps wheel input responsive while removing the sharper
// acceleration of the previous quartic curve.
const wheelEasing = (t: number) => 1 - Math.pow(1 - t, 3);
const anchorEasing = (t: number) => t < 0.5
  ? 4 * t * t * t
  : 1 - Math.pow(-2 * t + 2, 3) / 2;

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const supportsDesktopScroll = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const lenis = reduced || !supportsDesktopScroll ? null : new Lenis({
      autoRaf: true,
      duration: 1.05,
      easing: wheelEasing,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 1,
      touchMultiplier: 1,
    });

    const handleVisibilityChange = () => {
      if (!lenis) return;
      if (document.hidden) lenis.stop();
      else if (!document.documentElement.classList.contains("nav-overlay-open")) lenis.start();
    };
    if (lenis) document.addEventListener("visibilitychange", handleVisibilityChange);

    const handleScrollLock = (event: Event) => {
      if (!lenis) return;
      const locked = event instanceof CustomEvent
        ? Boolean(event.detail)
        : document.documentElement.classList.contains("nav-overlay-open");
      if (locked) lenis.stop();
      else if (!document.hidden) lenis.start();
    };
    window.addEventListener("ayursarga:scroll-lock", handleScrollLock);
    if (document.documentElement.classList.contains("nav-overlay-open")) lenis?.stop();

    const navigationOffset = () => {
      const navigation = document.getElementById("site-nav");
      const navigationContentHeight = navigation?.querySelector<HTMLElement>(".nav-inner")?.getBoundingClientRect().height;
      return navigationContentHeight
        ? navigationContentHeight + 28
        : navigation?.getBoundingClientRect().height ?? 0;
    };

    const scrollToElement = (target: HTMLElement, offset = 12, onComplete?: () => void, duration = 1.05) => {
      const destination = Math.max(0, window.scrollY + target.getBoundingClientRect().top - navigationOffset() - offset);
      if (lenis) {
        lenis.scrollTo(destination, {
          duration,
          easing: anchorEasing,
          onComplete,
        });
      } else {
        window.scrollTo({ top: destination, behavior: reduced ? "auto" : "smooth" });
        onComplete?.();
      }
    };

    const handleScrollRequest = (event: Event) => {
      const request = event as CustomEvent<{ target?: HTMLElement; offset?: number }>;
      if (!(request.detail?.target instanceof HTMLElement)) return;
      event.preventDefault();
      scrollToElement(request.detail.target, request.detail.offset);
    };
    window.addEventListener("ayursarga:scroll-to", handleScrollRequest);

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
      const destination = hash === "#hero"
        ? 0
        : Math.max(0, window.scrollY + scrollTarget.getBoundingClientRect().top - navigationOffset() - 12);
      const complete = () => {
        window.history.replaceState(null, "", hash);
        target.focus({ preventScroll: true });
      };

      event.preventDefault();
      if (hash === "#hero" && lenis) {
        lenis.scrollTo(destination, {
          duration: 1.25,
          easing: anchorEasing,
          onComplete: complete,
        });
      } else if (hash === "#hero") {
        window.scrollTo({ top: destination, behavior: reduced ? "auto" : "smooth" });
        complete();
      } else {
        scrollToElement(scrollTarget, 12, complete, 1.25);
      }
    };

    document.addEventListener("click", handleAnchorClick);

    return () => {
      if (lenis) document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("ayursarga:scroll-lock", handleScrollLock);
      window.removeEventListener("ayursarga:scroll-to", handleScrollRequest);
      document.removeEventListener("click", handleAnchorClick);
      lenis?.destroy();
    };
  }, []);

  return <>{children}</>;
}
