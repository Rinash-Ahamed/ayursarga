"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function ScrollLife() {
  useEffect(() => {
    if (!window.matchMedia("(min-width: 901px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    const context = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".family-story-media").forEach((media) => {
        gsap.fromTo(media, { scale: 1.035, yPercent: -2.5 }, {
          scale: 1.035,
          yPercent: 3,
          ease: "none",
          scrollTrigger: { trigger: media.parentElement, start: "top bottom", end: "bottom top", scrub: 0.35 },
        });
      });
    });
    return () => context.revert();
  }, []);
  return null;
}
