"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import MagneticButton from "./MagneticButton";

export default function Hero({ ready }: { ready: boolean }) {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !glowRef.current) return;
    const moveX = gsap.quickTo(glowRef.current, "x", { duration: 1.2, ease: "power3.out" });
    const moveY = gsap.quickTo(glowRef.current, "y", { duration: 1.2, ease: "power3.out" });
    const onMove = (event: PointerEvent) => {
      moveX((event.clientX / window.innerWidth - 0.5) * 40);
      moveY((event.clientY / window.innerHeight - 0.5) * 30);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <section id="hero">
      <div className="hero-glow" ref={glowRef} /><div className="hero-rays" />
      <div className="hero-content">
        <motion.p className="eyebrow" initial={{ opacity: 0, y: 14 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.25 }}>Ayurvedic care, guided with trust</motion.p>
        <h1>
          {["Ayurvedic care,", "personally guided."].map((line, index) => (
            <span key={line}><motion.span
              initial={{ y: "115%" }}
              animate={{ y: ready ? "0%" : "115%" }}
              transition={{ duration: 1.05, delay: 0.28 + index * 0.12, ease: [0.22, 1, 0.36, 1] }}
            >{index === 1 ? <em>{line}</em> : line}</motion.span></span>
          ))}
        </h1>
        <motion.p className="hero-sub" initial={{ opacity: 0, y: 20 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.82, duration: 0.8 }}>
          Discover approved Ayurvedic hospitals, compare suitable wellness services and request care with human guidance whenever you need it.
        </motion.p>
        <motion.div className="hero-ctas" initial={{ opacity: 0, y: 20 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ delay: 1, duration: 0.7 }}>
          <MagneticButton href="/app" className="btn-magnetic btn-primary hero-search-button">Search for Centers</MagneticButton>
          <div className="hero-support-actions">
            <MagneticButton href="#contact" className="btn-magnetic btn-secondary">Talk to Ayursarga</MagneticButton>
            <a href="#matching" className="btn-text">Help Me Choose &darr;</a>
          </div>
        </motion.div>
        <motion.div className="hero-trust" initial={{ opacity: 0 }} animate={ready ? { opacity: 1 } : {}} transition={{ delay: 1.2 }}>
          <span>Approved hospital partners</span><i /><span>Hospital-confirmed appointments</span><i /><span>Secure account access</span>
        </motion.div>
      </div>
    </section>
  );
}
