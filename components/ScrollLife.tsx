"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function ScrollLife() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".maternal-editorial > img, .family-story > img").forEach((image) => {
        gsap.fromTo(image, { scale: 1.06, yPercent: -3 }, {
          scale: 1.06,
          yPercent: 3,
          ease: "none",
          scrollTrigger: { trigger: image.parentElement, start: "top bottom", end: "bottom top", scrub: 0.8 },
        });
      });
    });
    return () => context.revert();
  }, []);
  return null;
}
