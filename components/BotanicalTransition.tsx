"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type Tone = "cream" | "cream-to-forest" | "forest-to-cream";

const LEAVES = [
  { x: 205, y: 78, r: -34, flip: 1 },
  { x: 330, y: 62, r: 28, flip: -1 },
  { x: 485, y: 83, r: -30, flip: 1 },
  { x: 650, y: 59, r: 30, flip: -1 },
  { x: 805, y: 77, r: -32, flip: 1 },
  { x: 955, y: 55, r: 29, flip: -1 },
] as const;

export default function BotanicalTransition({ tone = "cream", reverse = false }: { tone?: Tone; reverse?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const stem = container.querySelector<SVGPathElement>(".botanical-stem");
    const leaves = Array.from(container.querySelectorAll<SVGPathElement>(".botanical-leaf"));
    const veins = Array.from(container.querySelectorAll<SVGPathElement>(".botanical-vein"));
    if (!stem) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      gsap.set(stem, { strokeDashoffset: 0, opacity: .9 });
      gsap.set(leaves, { opacity: 1, scale: 1 });
      gsap.set(veins, { strokeDashoffset: 0, opacity: 1 });
      return;
    }

    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: container,
          start: "top 94%",
          end: "bottom 48%",
          scrub: true,
          invalidateOnRefresh: true,
        },
      });

      timeline
        .fromTo(stem, { strokeDashoffset: 1, opacity: .25 }, { strokeDashoffset: 0, opacity: .9, duration: 1 }, 0)
        .fromTo(leaves, { opacity: 0, scale: .18 }, { opacity: 1, scale: 1, duration: .16, stagger: .12 }, .16)
        .fromTo(veins, { strokeDashoffset: 1, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: .13, stagger: .12 }, .22);
    }, container);

    return () => context.revert();
  }, []);

  return (
    <div ref={containerRef} className={`botanical-transition ${tone}${reverse ? " reverse" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 1200 150" preserveAspectRatio="none" focusable="false">
        <path className="botanical-stem" pathLength="1" d="M-20 106 C165 104 190 62 350 75 S610 108 760 69 S1010 48 1220 74" />
        {LEAVES.map((leaf) => (
          <g key={leaf.x} className="botanical-branch" transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.r}) scale(${leaf.flip} 1)`}>
            <path className="botanical-leaf" d="M0 0 C13 -26 42 -29 61 -16 C45 4 20 10 0 0 Z" />
            <path className="botanical-vein" pathLength="1" d="M4 -1 C22 -8 39 -13 56 -16" />
          </g>
        ))}
      </svg>
    </div>
  );
}
