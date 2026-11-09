"use client";

import { useEffect } from "react";

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Wheel, touch and keyboard scrolling stay entirely browser-native.
    // Only explicit section navigation requests use smooth scrolling.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const navigationOffset = () => {
      const navigation = document.getElementById("site-nav");
      const navigationContentHeight = navigation?.querySelector<HTMLElement>(".nav-inner")?.getBoundingClientRect().height;
      return navigationContentHeight
        ? navigationContentHeight + 28
        : navigation?.getBoundingClientRect().height ?? 0;
    };

    const scrollToElement = (target: HTMLElement, offset = 12, onComplete?: () => void) => {
      const destination = Math.max(0, window.scrollY + target.getBoundingClientRect().top - navigationOffset() - offset);
      window.scrollTo({ top: destination, behavior: reducedMotion.matches ? "auto" : "smooth" });
      onComplete?.();
    };

    const handleScrollRequest = (event: Event) => {
      const request = event as CustomEvent<{ target?: HTMLElement; offset?: number }>;
      if (!(request.detail?.target instanceof HTMLElement)) return;
      event.preventDefault();
      scrollToElement(request.detail.target, request.detail.offset);
    };
    window.addEventListener("ayursarga:scroll-to", handleScrollRequest);

    const handleAnchorClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
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
      if (hash === "#hero") {
        window.scrollTo({ top: destination, behavior: reducedMotion.matches ? "auto" : "smooth" });
        complete();
      } else {
        scrollToElement(scrollTarget, 12, complete);
      }
    };

    document.addEventListener("click", handleAnchorClick);

    return () => {
      window.removeEventListener("ayursarga:scroll-to", handleScrollRequest);
      document.removeEventListener("click", handleAnchorClick);
    };
  }, []);

  return <>{children}</>;
}
