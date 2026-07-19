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
      <div className="hero-orbit hero-orbit-one" /><div className="hero-orbit hero-orbit-two" />
      <div className="hero-content">
        <motion.p className="eyebrow" initial={{ opacity: 0, y: 14 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ delay: .25 }}>Ayurveda, personally matched</motion.p>
        <h1>
          {["Recover naturally.", "Restore deeply.", "Return renewed."].map((line, i) => (
            <span key={line}><motion.span custom={i} initial="hidden" animate={controls} variants={lineVariants}>{i === 1 ? <em>{line}</em> : line}</motion.span></span>
          ))}
        </h1>
        <motion.p className="hero-sub" initial={{ opacity: 0, y: 20 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ delay: .82, duration: .8 }}>
          Discover your ideal Ayurvedic recovery retreat in Kerala—matched to your care, comfort and budget by people who understand the journey.
        </motion.p>
        <motion.div className="hero-ctas" initial={{ opacity: 0, y: 20 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ delay: 1, duration: .7 }}>
          <MagneticButton href="#matching" className="btn-magnetic btn-primary">Find My Retreat</MagneticButton>
          <a href="#wellness" className="btn-text" data-hover>Explore wellness paths ↓</a>
        </motion.div>
        <motion.div className="hero-trust" initial={{ opacity: 0 }} animate={ready ? { opacity: 1 } : {}} transition={{ delay: 1.2 }}>
          <span>Verified partners</span><i /><span>Doctor-guided matching</span><i /><span>Confidential booking</span>
        </motion.div>
      </div>
    </section>
  );
}
