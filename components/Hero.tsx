"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { gsap } from "gsap";
import MagneticButton from "./MagneticButton";

const CORE_VALUES = [
  { title: "Care", description: "Mother and baby always come first." },
  { title: "Authenticity", description: "Ayurveda practiced responsibly." },
  { title: "Trust", description: "Honest, transparent and accountable." },
  { title: "Excellence", description: "Quality care, every day." },
  { title: "Growth", description: "Growing together, creating impact." },
] as const;

export default function Hero({ ready }: { ready: boolean }) {
  const glowRef = useRef<HTMLDivElement>(null);
  const [activeValue, setActiveValue] = useState(0);
  const shouldReduceMotion = useReducedMotion();

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

  useEffect(() => {
    if (shouldReduceMotion) return;
    const interval = window.setInterval(() => {
      setActiveValue((current) => (current + 1) % CORE_VALUES.length);
    }, 3600);
    return () => window.clearInterval(interval);
  }, [shouldReduceMotion]);

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
          <a href="#search-centers" className="hero-search-button">Search for Centers</a>
          <div className="hero-support-actions">
            <MagneticButton href="#contact" className="btn-magnetic btn-secondary">Talk to Ayursarga</MagneticButton>
            <a href="#matching" className="btn-text">Help Me Choose &darr;</a>
          </div>
        </motion.div>
        <motion.div className="hero-values" initial={{ opacity: 0 }} animate={ready ? { opacity: 1 } : {}} transition={{ delay: 1.2 }}>
          <div className="hero-value-slider" aria-label={CORE_VALUES.map((value) => `${value.title}: ${value.description}`).join(" ")}>
            <div className="hero-value-copy" aria-live="off">
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  className="hero-value-slide"
                  key={CORE_VALUES[activeValue].title}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.38, ease: [0.22, 1, 0.36, 1] }}
                >
                  <strong>{CORE_VALUES[activeValue].title}</strong>
                  <p>{CORE_VALUES[activeValue].description}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="hero-value-dots" aria-label="Choose a core value">
              {CORE_VALUES.map((value, index) => <button
                type="button"
                key={value.title}
                className={index === activeValue ? "active" : ""}
                aria-label={`Show ${value.title}`}
                aria-pressed={index === activeValue}
                onClick={() => setActiveValue(index)}
              />)}
            </div>
          </div>
          <p className="hero-tagline">Nurturing Mothers. Preserving Tradition. Building Trust.</p>
        </motion.div>
      </div>
    </section>
  );
}
