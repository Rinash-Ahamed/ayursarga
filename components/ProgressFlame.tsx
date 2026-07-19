"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function ProgressFlame() {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    path.style.strokeDasharray = `${total}`;
    path.style.strokeDashoffset = `${total}`;

    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        path.style.strokeDashoffset = `${total - total * self.progress}`;
      },
    });

    return () => st.kill();
  }, []);

  return (
    <div className="progress-flame" aria-hidden="true">
      <svg viewBox="0 0 60 90" width="26" height="40">
        <path
          ref={pathRef}
          d="M30 4 C44 26 50 46 38 68 C34 76 26 76 22 68 C10 46 16 26 30 4 Z"
          fill="none"
          stroke="#A88E75"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
