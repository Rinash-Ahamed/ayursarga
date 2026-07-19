"use client";

import { useEffect, useRef } from "react";
import { motion, useAnimation } from "framer-motion";
import { gsap } from "gsap";
import MagneticButton from "./MagneticButton";

const lineVariants = {
  hidden: { y: "115%" },
  visible: (i: number) => ({ y: "0%", transition: { duration: 1.05, delay: 0.28 + i * 0.12, ease: [0.22, 1, 0.36, 1] } }),
};

export default function Hero({ ready }: { ready: boolean }) {
  const controls = useAnimation();
  const glowRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ready) controls.start("visible"); }, [ready, controls]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !glowRef.current) return;
    const moveX = gsap.quickTo(glowRef.current, "x", { duration: 1.2, ease: "power3.out" });
    const moveY = gsap.quickTo(glowRef.current, "y", { duration: 1.2, ease: "power3.out" });
    const onMove = (e: MouseEvent) => {
      moveX((e.clientX / window.innerWidth - .5) * 40);
      moveY((e.clientY / window.innerHeight - .5) * 30);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <section id="hero">
      <div className="hero-glow" ref={glowRef} /><div className="hero-rays" />
      <div className="hero-orbit hero-orbit-one" aria-hidden="true">
        <svg className="hero-orbit-art hero-lotus-art" viewBox="0 0 200 200" role="presentation">
          <circle className="orbit-art-halo" cx="100" cy="100" r="78" />
          <path className="orbit-art-fill" d="M100 128C72 102 73 67 100 39C127 67 128 102 100 128Z" />
          <path d="M98 133C63 129 42 105 43 72C74 76 96 99 98 133Z" />
          <path d="M102 133C137 129 158 105 157 72C126 76 104 99 102 133Z" />
          <path d="M93 139C62 149 35 139 20 114C47 102 78 112 93 139Z" />
          <path d="M107 139C138 149 165 139 180 114C153 102 122 112 107 139Z" />
          <path d="M37 151C75 163 125 163 163 151" />
        </svg>
      </div>
      <div className="hero-orbit hero-orbit-two" aria-hidden="true">
        <svg className="hero-orbit-art hero-sun-art" viewBox="0 0 200 200" role="presentation">
          <circle className="orbit-art-halo" cx="100" cy="100" r="78" />
          <g className="sun-rays">
            {Array.from({ length: 12 }).map((_, index) => (
              <path key={index} transform={`rotate(${index * 30} 100 100)`} d="M100 25V42" />
            ))}
          </g>
          <circle className="orbit-art-fill" cx="100" cy="93" r="34" />
          <path d="M38 120C56 110 73 110 91 120C109 130 127 130 162 112" />
          <path d="M38 137C56 127 73 127 91 137C109 147 127 147 162 129" />
          <path d="M51 154C75 146 102 149 125 157" />
        </svg>
      </div>
      <div className="hero-content">
        <motion.p className="eyebrow" initial={{ opacity: 0, y: 14 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ delay: .25 }}>Ayurveda, personally matched</motion.p>
        <h1>
          {["Recover naturally.", "Restore deeply.", "Return renewed."].map((line, i) => (
            <span key={line}><motion.span custom={i} initial="hidden" animate={controls} variants={lineVariants}>{i === 1 ? <em>{line}</em> : line}</motion.span></span>
          ))}
        </h1>
        <motion.p className="hero-sub" initial={{ opacity: 0, y: 20 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ delay: .82, duration: .8 }}>
          Discover your ideal Ayurvedic recovery retreat in Kerala - matched to your care, comfort and budget by people who understand the journey.
        </motion.p>
        <motion.div className="hero-ctas" initial={{ opacity: 0, y: 20 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ delay: 1, duration: .7 }}>
          <MagneticButton href="#matching" className="btn-magnetic btn-primary">Find My Retreat</MagneticButton>
          <a href="#wellness" className="btn-text" data-hover>Explore wellness paths &darr;</a>
        </motion.div>
        <motion.div className="hero-trust" initial={{ opacity: 0 }} animate={ready ? { opacity: 1 } : {}} transition={{ delay: 1.2 }}>
          <span>Verified partners</span><i /><span>Doctor-guided matching</span><i /><span>Confidential booking</span>
        </motion.div>
      </div>
    </section>
  );
}
